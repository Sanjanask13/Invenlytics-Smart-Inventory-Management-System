from datetime import datetime
import uuid

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from database import db
from models.billing_model import BillItem
from models.inventory_model import Inventory
from models.prediction_model import Prediction
from models.product_model import Product
from models.sales_model import Sale
from models.store_model import Store
from services.billing_service import get_product_by_barcode_payload
from services.tenant_service import (
    merchant_login_required,
    resolve_merchant_context,
    resolve_store_id,
)

product_bp = Blueprint("product", __name__)


def generate_barcode():
    return uuid.uuid4().hex[:12]


def _serialize_product(product):
    latest_inventory = (
        Inventory.query.filter_by(product_id=product.product_id)
        .order_by(Inventory.date.desc(), Inventory.inventory_id.desc())
        .first()
    )
    stock_left = latest_inventory.inventory_level if latest_inventory else 0

    return {
        "product_id": product.product_id,
        "name": product.product_name,
        "store_id": product.store_id,
        "supplier_name": product.supplier_name,
        "supplier_email": product.supplier_email,
        "barcode": product.barcode,
        "product_name": product.product_name,
        "category": product.category,
        "price": float(product.selling_price or 0),
        "cost_price": float(product.cost_price or 0),
        "selling_price": float(product.selling_price or 0),
        "competitor_price": float(product.competitor_price or 0),
        "threshold": product.threshold,
        "stock": stock_left,
        "stock_left": stock_left,
    }


def _build_products_query(store_id=None, search=None):
    query = Product.query

    if store_id:
        query = query.filter(Product.store_id == store_id)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Product.product_name.ilike(search_term),
                Product.product_id.ilike(search_term),
                Product.category.ilike(search_term),
            )
        )

    return query.order_by(Product.product_name.asc())


@product_bp.route("/add-product", methods=["POST"])
@merchant_login_required
def add_product():
    data = request.get_json(silent=True) or {}
    product_id = str(data.get("product_id") or "").strip()
    product_name = str(data.get("product_name") or "").strip()
    category = str(data.get("category") or "").strip()
    supplier_name = str(data.get("supplier_name") or "").strip() or None
    supplier_email = str(data.get("supplier_email") or "").strip() or None

    if not product_id:
        return jsonify({"error": "product_id is required"}), 400
    if not product_name:
        return jsonify({"error": "product_name is required"}), 400
    if not category:
        return jsonify({"error": "category is required"}), 400

    try:
        cost_price = float(data.get("cost_price"))
    except (TypeError, ValueError):
        return jsonify({"error": "cost_price must be a valid number"}), 400

    try:
        selling_price_raw = data.get("selling_price", data.get("price"))
        selling_price = float(selling_price_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "selling_price must be a valid number"}), 400

    if cost_price <= 0:
        return jsonify({"error": "cost_price must be greater than 0"}), 400
    if selling_price <= 0:
        return jsonify({"error": "selling_price must be greater than 0"}), 400

    competitor_price_raw = data.get("competitor_price")
    if competitor_price_raw in (None, ""):
        competitor_price = None
    else:
        try:
            competitor_price = float(competitor_price_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "competitor_price must be a valid number"}), 400

    try:
        initial_stock = int(data.get("initial_stock", 0) or 0)
        threshold = int(data.get("threshold", 50) or 50)
    except (TypeError, ValueError):
        return jsonify({"error": "initial_stock and threshold must be integers"}), 400

    if initial_stock < 0:
        return jsonify({"error": "initial_stock cannot be negative"}), 400
    if threshold < 0:
        return jsonify({"error": "threshold cannot be negative"}), 400

    try:
        merchant, store_id = resolve_merchant_context()
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    if Product.query.get(product_id):
        return jsonify({"error": "product_id already exists"}), 400

    store = Store.query.get(store_id)
    if not store:
        store = Store(store_id=store_id, merchant_id=merchant.merchant_id)
        db.session.add(store)
        db.session.flush()

    barcode = generate_barcode()

    while Product.query.filter_by(barcode=barcode).first():
        barcode = generate_barcode()

    new_product = Product(
        product_id=product_id,
        store_id=store_id,
        barcode=barcode,
        product_name=product_name,
        category=category,
        cost_price=cost_price,
        selling_price=selling_price,
        competitor_price=competitor_price,
        threshold=threshold,
        supplier_name=supplier_name,
        supplier_email=supplier_email,
    )

    try:
        db.session.add(new_product)
        db.session.flush()

        inventory = Inventory(
            product_id=new_product.product_id,
            date=datetime.now().date(),
            inventory_level=initial_stock,
            units_sold=0,
            units_ordered=0,
            discount=0,
            weather="Normal",
            holiday=0,
            season="Normal",
        )

        db.session.add(inventory)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Unable to add product. Check duplicate values and store details."}), 400
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Unable to add product right now"}), 500

    return jsonify({
        "message": "Product added successfully",
        "product": _serialize_product(new_product),
    }), 201


@product_bp.route("/products/<store_id>", methods=["GET"])
@merchant_login_required
def get_products(store_id):
    search = (request.args.get("search") or "").strip()
    try:
        store_id = resolve_store_id(store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    try:
        current_app.logger.info(
            "Fetching products for store_id=%s with search=%s",
            store_id,
            search,
        )
        products = _build_products_query(store_id=store_id, search=search).all()
        payload = [_serialize_product(product) for product in products]
        current_app.logger.info(
            "Fetched %s products for store_id=%s with search=%s",
            len(payload),
            store_id,
            search,
        )
        return jsonify(payload), 200
    except Exception as exc:
        current_app.logger.exception(
            "Failed to fetch products for store_id=%s with search=%s",
            store_id,
            search,
        )
        return jsonify({
            "error": "Unable to open products right now",
            "details": str(exc),
        }), 500


@product_bp.route("/products", methods=["GET"])
@merchant_login_required
def get_all_products():
    search = (request.args.get("search") or "").strip()
    try:
        _, store_id = resolve_merchant_context()
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    try:
        current_app.logger.info(
            "Fetching products via /products for store_id=%s with search=%s",
            store_id,
            search,
        )

        products = _build_products_query(
            store_id=store_id,
            search=search or None,
        ).all()

        payload = [_serialize_product(product) for product in products]
        current_app.logger.info(
            "Fetched %s products from /products with search=%s",
            len(payload),
            search,
        )
        return jsonify(payload), 200
    except Exception as exc:
        current_app.logger.exception("Failed to fetch products from /products")
        return jsonify({
            "error": "Unable to open products right now",
            "details": str(exc),
        }), 500


@product_bp.route("/search-product", methods=["GET"])
@merchant_login_required
def search_product():
    query = (request.args.get("query") or "").strip()
    try:
        _, store_id = resolve_merchant_context()
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    if not query:
        return jsonify([]), 200

    try:
        search_query = Product.query.filter(
            or_(
                Product.barcode.ilike(f"%{query}%"),
                Product.product_name.ilike(f"%{query}%")
            )
        )

        if store_id:
            search_query = search_query.filter(Product.store_id == store_id)

        products = (
            search_query
            .order_by(Product.product_name.asc())
            .limit(5)
            .all()
        )

        return jsonify([
            {
                "product_id": product.product_id,
                "name": product.product_name,
                "barcode": product.barcode,
                "price": round(float(product.selling_price or 0), 2),
                "cost_price": round(float(product.cost_price or 0), 2),
                "selling_price": round(float(product.selling_price or 0), 2),
            }
            for product in products
        ]), 200
    except Exception:
        return jsonify({
            "error": "Unable to search products right now"
        }), 500


@product_bp.route("/product/<product_id>", methods=["GET"])
@merchant_login_required
def get_product(product_id):
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    try:
        resolve_store_id(product.store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    return jsonify(_serialize_product(product)), 200


@product_bp.route("/product/<product_id>", methods=["PUT"])
@merchant_login_required
def update_product(product_id):
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    try:
        resolve_store_id(product.store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    data = request.get_json(silent=True) or {}

    if "product_name" in data:
        product.product_name = data["product_name"]
    if "category" in data:
        product.category = data["category"]
    if "cost_price" in data:
        product.cost_price = float(data["cost_price"])
    if "selling_price" in data:
        product.selling_price = float(data["selling_price"])
    elif "price" in data:
        product.selling_price = float(data["price"])
    if "competitor_price" in data:
        competitor_price = data["competitor_price"]
        product.competitor_price = float(competitor_price) if competitor_price not in (None, "") else None
    if "threshold" in data:
        product.threshold = int(data["threshold"])
    if "store_id" in data:
        try:
            product.store_id = resolve_store_id(data["store_id"])
        except PermissionError as exc:
            return jsonify({"error": str(exc)}), 403
    if "supplier_name" in data:
        product.supplier_name = str(data.get("supplier_name") or "").strip() or None
    if "supplier_email" in data:
        product.supplier_email = str(data.get("supplier_email") or "").strip() or None

    db.session.commit()

    return jsonify({
        "message": "Product updated successfully",
        "product": _serialize_product(product),
    }), 200


@product_bp.route("/scan-barcode", methods=["POST"])
@merchant_login_required
def scan_barcode():
    data = request.get_json(silent=True) or {}
    barcode = (data.get("barcode") or "").strip()

    if not barcode:
        return jsonify({"error": "Barcode is required"}), 400

    try:
        _, store_id = resolve_merchant_context()
        product_payload = get_product_by_barcode_payload(barcode, store_id=store_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    return jsonify({
        "message": "Product fetched successfully",
        "product": product_payload,
    }), 200


@product_bp.route("/update-stock", methods=["POST"])
@merchant_login_required
def update_stock():
    data = request.get_json(silent=True) or {}
    product_id = data.get("product_id")
    stock_level = data.get("stock_level")

    if not product_id:
        return jsonify({"error": "Product is required"}), 400

    if stock_level in (None, ""):
        return jsonify({"error": "Stock level is required"}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    try:
        resolve_store_id(product.store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    new_stock_level = int(stock_level)
    if new_stock_level < 0:
        return jsonify({"error": "Stock level cannot be negative"}), 400

    last_inventory = (
        Inventory.query.filter_by(product_id=product_id)
        .order_by(Inventory.date.desc(), Inventory.inventory_id.desc())
        .first()
    )

    previous_stock = last_inventory.inventory_level if last_inventory else 0
    units_ordered = max(new_stock_level - previous_stock, 0)

    inventory = Inventory(
        product_id=product_id,
        date=datetime.now().date(),
        inventory_level=new_stock_level,
        units_sold=0,
        units_ordered=units_ordered,
        discount=last_inventory.discount if last_inventory and last_inventory.discount is not None else 0,
        weather=last_inventory.weather if last_inventory and last_inventory.weather else "Normal",
        holiday=last_inventory.holiday if last_inventory and last_inventory.holiday is not None else 0,
        season=last_inventory.season if last_inventory and last_inventory.season else "Normal",
    )

    db.session.add(inventory)
    db.session.commit()

    return jsonify({
        "message": "Stock level updated successfully",
        "product": _serialize_product(product),
    }), 200


@product_bp.route("/delete-product/<product_id>", methods=["DELETE"])
@merchant_login_required
def delete_product(product_id):
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    try:
        resolve_store_id(product.store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    bill_history_exists = BillItem.query.filter_by(product_id=product_id).first()
    if bill_history_exists:
        return jsonify({
            "error": "Cannot delete product with billing history. Keep it for invoice records."
        }), 400

    Inventory.query.filter_by(product_id=product_id).delete()
    Prediction.query.filter_by(product_id=product_id).delete()
    Sale.query.filter_by(product_id=product_id).delete()
    db.session.delete(product)
    db.session.commit()

    return jsonify({"message": "Product deleted"}), 200
