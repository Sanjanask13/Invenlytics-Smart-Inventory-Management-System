from datetime import datetime

from flask import Blueprint, jsonify, request

from database import db
from models.order_model import Order
from models.product_model import Product
from services.order_service import send_order_email
from services.tenant_service import merchant_login_required, resolve_store_id

order_bp = Blueprint("order", __name__)


def _serialize_order(order, product_name=None):
    return {
        "id": order.id,
        "product_id": order.product_id,
        "product_name": product_name,
        "supplier_name": order.supplier_name,
        "supplier_email": order.supplier_email,
        "quantity": int(order.quantity or 0),
        "status": order.status,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


@order_bp.route("/send-order", methods=["POST"])
@merchant_login_required
def send_order():
    data = request.get_json(silent=True) or {}

    product_id = str(data.get("product_id") or "").strip()
    supplier_email = str(data.get("supplier_email") or "").strip()
    supplier_name = str(data.get("supplier_name") or "").strip()
    product_name = str(data.get("product_name") or "").strip()
    quantity_raw = data.get("quantity")

    if not product_id:
        return jsonify({"error": "product_id is required"}), 400
    if not supplier_email:
        return jsonify({"error": "supplier_email is required"}), 400
    if not supplier_name:
        return jsonify({"error": "supplier_name is required"}), 400
    if not product_name:
        return jsonify({"error": "product_name is required"}), 400
    if quantity_raw in (None, ""):
        return jsonify({"error": "quantity is required"}), 400

    try:
        quantity = int(quantity_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "quantity must be an integer"}), 400

    if quantity <= 0:
        return jsonify({"error": "quantity must be greater than 0"}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    try:
        resolve_store_id(product.store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    try:
        result = send_order_email(
            supplier_email=supplier_email,
            supplier_name=supplier_name,
            product_name=product_name,
            quantity=quantity,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 500
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:
        return jsonify({
            "error": "Failed to send order email",
            "details": str(exc),
        }), 500

    order = Order(
        product_id=product_id,
        supplier_name=supplier_name,
        supplier_email=supplier_email,
        quantity=quantity,
        status="sent",
        created_at=datetime.utcnow(),
    )
    db.session.add(order)
    db.session.commit()

    result["order"] = _serialize_order(order, product_name=product.product_name)
    return jsonify(result), 200


@order_bp.route("/cancel-order", methods=["POST"])
@merchant_login_required
def cancel_order():
    data = request.get_json(silent=True) or {}
    order_id = data.get("id")

    if order_id in (None, ""):
        return jsonify({"error": "id is required"}), 400

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    product = Product.query.get(order.product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    try:
        resolve_store_id(product.store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    order.status = "cancelled"
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Order cancelled successfully",
        "order": _serialize_order(order, product_name=product.product_name if product else None),
    }), 200


@order_bp.route("/orders/<store_id>", methods=["GET"])
@merchant_login_required
def get_orders(store_id):
    try:
        store_id = resolve_store_id(store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    rows = (
        db.session.query(Order, Product.product_name)
        .join(Product, Product.product_id == Order.product_id)
        .filter(Product.store_id == store_id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .all()
    )

    return jsonify([
        _serialize_order(order, product_name=product_name)
        for order, product_name in rows
    ]), 200
