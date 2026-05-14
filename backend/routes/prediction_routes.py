from datetime import datetime

import pandas as pd
from flask import Blueprint, jsonify, request
from sqlalchemy import func

from database import db
from ml_models.xgb_model import predict_demand, train_pipeline_from_dataframe
from models.inventory_model import Inventory
from models.prediction_model import Prediction
from models.product_model import Product
from models.sales_model import Sale
from services.tenant_service import merchant_login_required, resolve_store_id

prediction_bp = Blueprint("prediction", __name__)

REQUIRED_FIELDS = {
    "date",
    "product_id",
    "inventory_level",
    "discount",
}
OPTIONAL_FIELDS = {"prev_demand", "merchant_id", "category", "price", "cost_price"}
IGNORED_LEGACY_FIELDS = {
    "holiday",
    "region",
    "season",
    "store_id",
    "units_ordered",
    "units_sold",
    "weather",
}
ALLOWED_FIELDS = REQUIRED_FIELDS | OPTIONAL_FIELDS | IGNORED_LEGACY_FIELDS


def _parse_date(raw_date):
    try:
        return datetime.strptime(raw_date, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValueError("date must be in YYYY-MM-DD format")


def _parse_float(raw_value, field_name, allow_zero=True):
    try:
        value = float(raw_value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a number")

    if value < 0 or (not allow_zero and value == 0):
        comparator = "greater than 0" if not allow_zero else "0 or greater"
        raise ValueError(f"{field_name} must be {comparator}")

    return value


def _parse_int(raw_value, field_name):
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be an integer")

    if value < 0:
        raise ValueError(f"{field_name} must be 0 or greater")

    return value


def _resolve_prev_demand(product_id, provided_prev_demand):
    if provided_prev_demand not in (None, ""):
        return _parse_float(provided_prev_demand, "prev_demand")

    latest_sale_snapshot = (
        Inventory.query.filter(
            Inventory.product_id == product_id,
            Inventory.units_sold.isnot(None),
            Inventory.units_sold > 0,
        )
        .order_by(Inventory.date.desc(), Inventory.inventory_id.desc())
        .first()
    )
    if latest_sale_snapshot:
        return float(latest_sale_snapshot.units_sold)

    latest_prediction = (
        Prediction.query.filter_by(product_id=product_id)
        .order_by(Prediction.prediction_date.desc(), Prediction.prediction_id.desc())
        .first()
    )
    if latest_prediction:
        return float(latest_prediction.predicted_demand)

    return 0.0


def _validate_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object")

    unknown_fields = sorted(set(payload.keys()) - ALLOWED_FIELDS)
    if unknown_fields:
        raise ValueError(
            "Unexpected fields: " + ", ".join(unknown_fields)
        )

    missing_fields = sorted(field for field in REQUIRED_FIELDS if field not in payload)
    if missing_fields:
        raise ValueError(
            "Missing required fields: " + ", ".join(missing_fields)
        )

    parsed_date = _parse_date(payload["date"])
    product_id = str(payload["product_id"]).strip()
    category = str(payload.get("category") or "").strip()

    if not product_id:
        raise ValueError("product_id is required")
    inventory_level = _parse_int(payload["inventory_level"], "inventory_level")
    discount = _parse_float(payload["discount"], "discount")
    prev_demand = _resolve_prev_demand(product_id, payload.get("prev_demand"))

    price = payload.get("price")
    if price not in (None, ""):
        price = _parse_float(price, "price", allow_zero=False)
    else:
        price = None

    cost_price = payload.get("cost_price")
    if cost_price not in (None, ""):
        cost_price = _parse_float(cost_price, "cost_price", allow_zero=False)
    else:
        cost_price = None

    merchant_id = payload.get("merchant_id")
    if merchant_id not in (None, ""):
        merchant_id = _parse_int(merchant_id, "merchant_id")
    else:
        merchant_id = None

    return {
        "date": parsed_date,
        "product_id": product_id,
        "category": category,
        "inventory_level": inventory_level,
        "price": price,
        "cost_price": cost_price,
        "discount": discount,
        "prev_demand": prev_demand,
        "merchant_id": merchant_id,
    }


def _enrich_product_prediction_data(data, product):
    if not data["category"]:
        data["category"] = (product.category or "").strip()
    if not data["category"]:
        raise ValueError("category is missing for this product")

    if data["price"] is None:
        data["price"] = float(product.price) if product.price is not None else None
    if data["price"] is None:
        raise ValueError("price is missing for this product")

    if data["cost_price"] is None:
        data["cost_price"] = float(product.cost_price) if product.cost_price is not None else None
    if data["cost_price"] is None:
        raise ValueError("cost_price is missing for this product")

    if product.category and product.category != data["category"]:
        raise ValueError("category does not match the product master data")

    if product.price is not None and round(float(product.price), 2) != round(data["price"], 2):
        raise ValueError("price does not match the product master data")


def _build_model_input(data):
    return {
        "Date": data["date"].strftime("%Y-%m-%d"),
        "Product ID": data["product_id"],
        "Category": data["category"],
        "Inventory Level": data["inventory_level"],
        "Price": data["price"],
        "Discount": data["discount"],
        "Prev_Demand": data["prev_demand"],
    }


def _build_live_training_dataframe():
    sales_totals = {
        (row.product_id, row.date): float(row.total_quantity or 0)
        for row in (
            db.session.query(
                Sale.product_id.label("product_id"),
                Sale.date.label("date"),
                func.sum(Sale.quantity).label("total_quantity"),
            )
            .filter(Sale.date.isnot(None))
            .group_by(Sale.product_id, Sale.date)
            .all()
        )
    }

    inventory_rows = (
        db.session.query(Inventory, Product)
        .join(Product, Product.product_id == Inventory.product_id)
        .filter(
            Inventory.date.isnot(None),
            Product.category.isnot(None),
        )
        .order_by(Inventory.product_id.asc(), Inventory.date.asc(), Inventory.inventory_id.asc())
        .all()
    )

    dataset_rows = []
    for inventory, product in inventory_rows:
        category = (product.category or "").strip()
        if not category:
            continue

        price = product.price
        if price is None:
            continue

        demand_value = sales_totals.get(
            (inventory.product_id, inventory.date),
            float(inventory.units_sold or 0),
        )

        dataset_rows.append({
            "Product ID": inventory.product_id,
            "Category": category,
            "Inventory Level": int(inventory.inventory_level or 0),
            "Price": float(price),
            "Discount": float(inventory.discount or 0),
            "Date": inventory.date.isoformat(),
            "Demand Forecast": float(demand_value),
        })

    if not dataset_rows:
        raise ValueError("No inventory and sales history is available for retraining")

    return pd.DataFrame(dataset_rows)


@prediction_bp.route("/predict-product", methods=["POST"])
@merchant_login_required
def predict_product():
    payload = request.get_json(silent=True)

    try:
        data = _validate_payload(payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    product = Product.query.get(data["product_id"])
    if not product:
        return jsonify({"error": "Product not found"}), 404
    try:
        resolve_store_id(product.store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    try:
        _enrich_product_prediction_data(data, product)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    model_input = _build_model_input(data)

    try:
        predicted_demand = float(predict_demand(model_input))
    except FileNotFoundError:
        return jsonify({
            "error": "Trained XGBoost pipeline not found. Train the model before predicting."
        }), 500
    except Exception as exc:
        return jsonify({
            "error": "Prediction failed",
            "details": str(exc)
        }), 500

    expected_profit = predicted_demand * (float(data["price"]) - float(data["cost_price"]))

    if predicted_demand > data["inventory_level"]:
        stock_risk = "under"
    elif data["inventory_level"] > predicted_demand * 1.5:
        stock_risk = "over"
    else:
        stock_risk = "normal"

    return jsonify({
        "product_id": data["product_id"],
        "product_name": product.product_name,
        "predicted_demand": round(predicted_demand, 2),
        "expected_profit": round(expected_profit, 2),
        "stock_risk": stock_risk,
        "model_input": model_input,
    }), 200


@prediction_bp.route("/retrain-model", methods=["POST"])
@merchant_login_required
def retrain_model():
    try:
        training_df = _build_live_training_dataframe()
        metrics = train_pipeline_from_dataframe(training_df, target_column="Demand Forecast")
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({
            "error": "Model retraining failed",
            "details": str(exc),
        }), 500

    return jsonify({
        "message": "XGBoost model retrained successfully",
        "rows_used": metrics["rows_used"],
        "rmse": round(metrics["rmse"], 4),
        "r2": round(metrics["r2"], 4),
        "model_path": metrics["model_path"],
    }), 200
