from datetime import datetime

from flask import Blueprint, current_app, jsonify, request

from database import db
from models.billing_model import Bill, BillItem
from models.product_model import Product
from services.billing_service import preview_bill_confirmation, process_bill
from services.tenant_service import merchant_login_required, resolve_merchant_context, resolve_store_id

sales_bp = Blueprint("sales", __name__)


def _parse_bill_date(raw_date):
    try:
        return (
            datetime.strptime(raw_date, "%Y-%m-%d")
            if raw_date
            else datetime.now()
        )
    except ValueError:
        raise ValueError("date must be in YYYY-MM-DD format")


def _serialize_bill_row(bill):
    item_count = BillItem.query.filter_by(bill_id=bill.bill_id).count()
    return {
        "bill_id": bill.bill_id,
        "invoice_no": bill.bill_no,
        "store_id": bill.store_id,
        "created_at": bill.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "total_items": int(bill.total_items or 0),
        "line_count": int(item_count or 0),
        "total_amount": round(float(bill.total_amount or 0), 2),
    }


@sales_bp.route("/create-bill", methods=["POST"])
@merchant_login_required
def create_bill():
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    confirmation_accepted = bool(data.get("confirmation_accepted"))
    try:
        _, store_id = resolve_merchant_context()
    except PermissionError as exc:
        return jsonify({"success": False, "error": str(exc)}), 403
    current_app.logger.info("Received /create-bill request for store %s with %s items", store_id, len(items))

    if not items:
        current_app.logger.warning("Rejected /create-bill request because cart was empty")
        return jsonify({
            "success": False,
            "error": "Cart is empty. Add at least one item before generating a bill."
        }), 400

    try:
        sale_date = _parse_bill_date(data.get("date"))
    except ValueError as exc:
        current_app.logger.warning("Rejected /create-bill request: %s", str(exc))
        return jsonify({"success": False, "error": str(exc)}), 400

    try:
        preview = preview_bill_confirmation(items=items, sale_date=sale_date, store_id=store_id)
        if preview["requires_confirmation"] and not confirmation_accepted:
            current_app.logger.info("Bill for store %s requires confirmation", store_id)
            return jsonify({
                "success": False,
                "requires_confirmation": True,
                "warning": "Please confirm this suspicious bill before it is generated.",
                "confirmation_warnings": preview["warnings"],
            }), 409

        result = process_bill(items=items, sale_date=sale_date, store_id=store_id)
        db.session.commit()
        current_app.logger.info("Bill %s created successfully", result["bill"].bill_id)
        return jsonify({
            "success": True,
            "bill_id": result["bill"].bill_id,
            "message": "Bill created successfully",
            "invoice": result["invoice"],
            "predictions": result["invoice"].get("predictions", []),
            "has_anomaly": result["has_anomaly"],
            "warning": "Anomaly detected in this transaction. Please review the bill." if result["has_anomaly"] else None,
            "anomaly_warnings": result["anomaly_warnings"],
        }), 201
    except ValueError as exc:
        db.session.rollback()
        message = str(exc)
        current_app.logger.warning("Billing validation failed: %s", message)
        if message.startswith("Insufficient stock::"):
            _, product_id, stock_left = message.split("::", 2)
            return jsonify({
                "success": False,
                "error": "Insufficient stock",
                "product_id": product_id,
                "stock_left": int(stock_left),
            }), 400
        if message == "Product not found":
            return jsonify({"success": False, "error": message}), 404
        return jsonify({"success": False, "error": message}), 400
    except FileNotFoundError:
        db.session.rollback()
        current_app.logger.exception("XGBoost pipeline file not found during billing")
        return jsonify({
            "success": False,
            "error": "Trained XGBoost pipeline not found. Train the model before billing predictions."
        }), 500
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Billing failed")
        return jsonify({
            "success": False,
            "error": "Billing failed",
            "details": str(exc),
        }), 500


@sales_bp.route("/add-sale", methods=["POST"])
@merchant_login_required
def add_sale():
    data = request.get_json(silent=True) or {}
    items = [{
        "product_id": str(data.get("product_id") or "").strip(),
        "quantity": data.get("quantity", 1),
        "discount": data.get("discount", 0),
        "price": data.get("price"),
    }]
    current_app.logger.info("Received /add-sale request for product %s", items[0]["product_id"])

    try:
        sale_date = _parse_bill_date(data.get("date"))
    except ValueError as exc:
        current_app.logger.warning("Rejected /add-sale request: %s", str(exc))
        return jsonify({"success": False, "error": str(exc)}), 400

    try:
        _, store_id = resolve_merchant_context()
    except PermissionError as exc:
        return jsonify({"success": False, "error": str(exc)}), 403

    try:
        result = process_bill(
            items=items,
            sale_date=sale_date,
            store_id=store_id,
        )
        db.session.commit()
        current_app.logger.info("Single-sale bill %s created successfully", result["bill"].bill_id)
        return jsonify({
            "success": True,
            "bill_id": result["bill"].bill_id,
            "message": "Bill created successfully",
            "invoice": result["invoice"],
            "predictions": result["invoice"].get("predictions", []),
            "has_anomaly": result["has_anomaly"],
            "warning": "Anomaly detected in this transaction. Please review the bill." if result["has_anomaly"] else None,
            "anomaly_warnings": result["anomaly_warnings"],
        }), 201
    except ValueError as exc:
        db.session.rollback()
        message = str(exc)
        current_app.logger.warning("Single-sale billing validation failed: %s", message)
        if message.startswith("Insufficient stock::"):
            _, product_id, stock_left = message.split("::", 2)
            return jsonify({
                "success": False,
                "error": "Insufficient stock",
                "product_id": product_id,
                "stock_left": int(stock_left),
            }), 400
        if message == "Product not found":
            return jsonify({"success": False, "error": message}), 404
        return jsonify({"success": False, "error": message}), 400
    except FileNotFoundError:
        db.session.rollback()
        current_app.logger.exception("XGBoost pipeline file not found during single-sale billing")
        return jsonify({
            "success": False,
            "error": "Trained XGBoost pipeline not found. Train the model before billing predictions."
        }), 500
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Single-sale billing failed")
        return jsonify({
            "success": False,
            "error": "Billing failed",
            "details": str(exc),
        }), 500


@sales_bp.route("/billing", methods=["GET"])
@merchant_login_required
def billing():
    try:
        _, store_id = resolve_merchant_context()
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    try:
        products = Product.query.filter_by(store_id=store_id).order_by(Product.product_name.asc()).all()
        recent_bills = (
            Bill.query.filter(Bill.store_id == store_id)
            .order_by(Bill.created_at.desc(), Bill.bill_id.desc())
            .limit(20)
            .all()
        )

        product_payload = [
            {
                "product_id": product.product_id,
                "product_name": product.product_name,
                "barcode": product.barcode,
                "category": product.category,
                "price": round(float(product.price or 0), 2),
            }
            for product in products
        ]

        bill_payload = [_serialize_bill_row(bill) for bill in recent_bills]

        return jsonify({
            "store_id": store_id,
            "products": product_payload,
            "bill_history": bill_payload,
            "counts": {
                "products": len(product_payload),
                "recent_bills": len(bill_payload),
            },
        }), 200
    except Exception as exc:
        current_app.logger.exception("Failed to load billing data")
        return jsonify({
            "error": "Unable to load billing data right now",
            "details": str(exc),
        }), 500


@sales_bp.route("/bill-history", methods=["GET"])
@merchant_login_required
def bill_history():
    try:
        _, store_id = resolve_merchant_context()
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    try:
        bills = (
            Bill.query
            .filter(Bill.store_id == store_id)
            .order_by(Bill.created_at.desc(), Bill.bill_id.desc())
            .limit(100)
            .all()
        )
        payload = [_serialize_bill_row(bill) for bill in bills]

        return jsonify(payload), 200
    except Exception as exc:
        current_app.logger.exception("Failed to load bill history")
        return jsonify({
            "error": "Unable to load bill history",
            "details": str(exc),
        }), 500


@sales_bp.route("/sales-history", methods=["GET"])
@merchant_login_required
def sales_history():
    return bill_history()


@sales_bp.route("/invoice/<int:bill_id>", methods=["GET"])
@merchant_login_required
def get_invoice(bill_id):
    try:
        bill = Bill.query.get(bill_id)
        if not bill:
            return jsonify({"error": "Invoice not found"}), 404
        try:
            resolve_store_id(bill.store_id)
        except PermissionError as exc:
            return jsonify({"error": str(exc)}), 403

        items = BillItem.query.filter_by(bill_id=bill.bill_id).all()
        invoice_items = []

        for item in items:
            product = Product.query.get(item.product_id)
            invoice_items.append({
                "product_id": item.product_id,
                "product_name": product.product_name if product else None,
                "category": product.category if product else None,
                "barcode": item.barcode,
                "quantity": item.quantity,
                "unit_price": round(float(item.unit_price or 0), 2),
                "discount": round(float(item.discount or 0), 2),
                "line_total": round(float(item.line_total or 0), 2),
                "predicted_demand": round(float(item.predicted_demand), 2) if item.predicted_demand is not None else None,
            })

        return jsonify({
            "bill_id": bill.bill_id,
            "invoice_no": bill.bill_no,
            "store_id": bill.store_id,
            "created_at": bill.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "total_items": int(bill.total_items or 0),
            "total_amount": round(float(bill.total_amount or 0), 2),
            "items": invoice_items,
            "predictions": [
                {
                    "product_id": item["product_id"],
                    "product_name": item["product_name"],
                    "predicted_demand": item["predicted_demand"],
                }
                for item in invoice_items
            ],
        }), 200
    except Exception as exc:
        current_app.logger.exception("Failed to load invoice %s", bill_id)
        return jsonify({
            "error": "Unable to load invoice",
            "details": str(exc),
        }), 500
