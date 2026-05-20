from datetime import date, datetime, timedelta
from math import ceil

from flask import Blueprint, jsonify, request
from ml_models.apriori_model import train_apriori_from_bills
from models.billing_model import Bill
from models.inventory_model import Inventory
from models.prediction_model import Prediction
from models.product_model import Product
from models.sales_model import Sale
from models.store_model import Store
from database import db
from sqlalchemy import func
from ml_models.xgb_model import predict_demand
from services.tenant_service import (
    get_current_merchant,
    merchant_login_required,
    resolve_store_id,
)

analytics_bp = Blueprint("analytics", __name__)


def get_merchant_products(merchant_id, store_id=None):
    stores = Store.query.filter_by(merchant_id=merchant_id).all()
    store_ids = [store.store_id for store in stores]

    if store_id and store_id not in store_ids:
        store_ids.append(store_id)

    if not store_ids:
        return []

    return Product.query.filter(Product.store_id.in_(store_ids)).all()


def get_store_products(store_id):
    return Product.query.filter_by(store_id=store_id).all()


def _get_latest_inventory(product_id):
    return (
        Inventory.query.filter_by(product_id=product_id)
        .order_by(Inventory.date.desc(), Inventory.inventory_id.desc())
        .first()
    )


def _get_latest_prediction(product_id):
    return (
        Prediction.query.filter_by(product_id=product_id)
        .order_by(Prediction.prediction_date.desc(), Prediction.prediction_id.desc())
        .first()
    )


def _resolve_prev_demand(product_id):
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

    latest_prediction = _get_latest_prediction(product_id)
    if latest_prediction:
        return float(latest_prediction.predicted_demand)

    return 0.0


def _estimate_predicted_demand(product, latest_inventory):
    current_stock = latest_inventory.inventory_level if latest_inventory else 0
    latest_discount = (
        float(latest_inventory.discount)
        if latest_inventory and latest_inventory.discount is not None
        else 0.0
    )

    model_input = {
        "Date": date.today().strftime("%Y-%m-%d"),
        "Product ID": product.product_id,
        "Category": product.category,
        "Inventory Level": current_stock,
        "Price": float(product.price or 0),
        "Discount": latest_discount,
        "Prev_Demand": _resolve_prev_demand(product.product_id),
    }

    try:
        return float(predict_demand(model_input))
    except (FileNotFoundError, ValueError):
        pass
    except Exception:
        pass

    latest_prediction = _get_latest_prediction(product.product_id)
    if latest_prediction:
        return float(latest_prediction.predicted_demand)

    recent_inventory = (
        Inventory.query.filter_by(product_id=product.product_id)
        .order_by(Inventory.date.desc(), Inventory.inventory_id.desc())
        .limit(5)
        .all()
    )
    recent_sales = [row.units_sold or 0 for row in recent_inventory]
    if recent_sales:
        return float(sum(recent_sales) / len(recent_sales))

    return 0.0


def _get_recent_average_units_sold(product_id, limit=5):
    recent_inventory = (
        Inventory.query.filter_by(product_id=product_id)
        .order_by(Inventory.date.desc(), Inventory.inventory_id.desc())
        .limit(limit)
        .all()
    )
    recent_sales = [row.units_sold or 0 for row in recent_inventory]
    if not recent_sales:
        return 0.0
    return float(sum(recent_sales) / len(recent_sales))


def _build_top_combos(store_id, product_name_map):
    rules = train_apriori_from_bills(store_id=store_id)
    if rules.empty:
        return []

    combos = []
    seen = set()

    for _, row in rules.iterrows():
        product_ids = tuple(sorted(set(row["antecedents"]) | set(row["consequents"])))
        if len(product_ids) < 2 or product_ids in seen:
            continue

        seen.add(product_ids)
        combos.append({
            "product_ids": list(product_ids),
            "products": [product_name_map.get(product_id, product_id) for product_id in product_ids],
            "support": round(float(row["support"]), 4),
            "confidence": round(float(row["confidence"]), 4),
            "lift": round(float(row["lift"]), 4),
        })

    combos.sort(
        key=lambda item: (item["lift"], item["confidence"], item["support"]),
        reverse=True,
    )
    return combos[:5]


def _build_pricing_suggestions(products):
    suggestions = []

    for product in products:
        if product.competitor_price is None or product.price is None:
            continue

        if float(product.competitor_price) < float(product.price):
            suggested_price = round(float(product.competitor_price), 2)
            suggestions.append({
                "product_id": product.product_id,
                "product_name": product.product_name,
                "current_price": round(float(product.price), 2),
                "competitor_price": round(float(product.competitor_price), 2),
                "suggested_price": suggested_price,
                "suggestion": "Reduce price to stay competitive with the market",
            })

    return suggestions


def _build_demand_suggestions(products):
    suggestions = []

    for product in products:
        latest_inventory = _get_latest_inventory(product.product_id)
        current_stock = int(latest_inventory.inventory_level or 0) if latest_inventory else 0
        threshold = int(product.threshold or 0)
        predicted_demand = _estimate_predicted_demand(product, latest_inventory)
        target_stock = max(threshold, ceil(float(predicted_demand or 0)))
        suggested_restock = max(target_stock - current_stock, 0)

        if predicted_demand <= 0:
            continue

        if predicted_demand > current_stock and suggested_restock > 0:
            suggestions.append({
                "product_id": product.product_id,
                "product_name": product.product_name,
                "current_stock": current_stock,
                "threshold": threshold,
                "predicted_demand": round(float(predicted_demand), 2),
                "suggested_restock": int(suggested_restock),
                "suggestion": "Increase stock because forecasted demand is likely to push this product below safe coverage",
            })

    suggestions.sort(key=lambda item: item["suggested_restock"], reverse=True)
    return suggestions


def _build_current_understock_products(products):
    understock_products = []

    for product in products:
        latest_inventory = _get_latest_inventory(product.product_id)
        current_stock = int(latest_inventory.inventory_level or 0) if latest_inventory else 0
        threshold = int(product.threshold or 0)

        if current_stock < threshold:
            understock_products.append({
                "product_id": product.product_id,
                "product_name": product.product_name,
                "stock": current_stock,
                "threshold": threshold,
            })

    understock_products.sort(
        key=lambda item: (item["stock"] - item["threshold"], item["stock"]),
    )
    return understock_products


def _build_discount_suggestions(products):
    suggestions = []

    for product in products:
        latest_inventory = _get_latest_inventory(product.product_id)
        if not latest_inventory:
            continue

        current_stock = int(latest_inventory.inventory_level or 0)
        average_units_sold = _get_recent_average_units_sold(product.product_id)
        current_discount = float(latest_inventory.discount or 0)
        threshold = int(product.threshold or 0)

        is_slow_moving = average_units_sold <= 2 and current_stock > max(threshold, 0)
        if not is_slow_moving:
            continue

        suggested_discount = round(min(max(current_discount + 5, 10), 30), 2)
        suggestions.append({
            "product_id": product.product_id,
            "product_name": product.product_name,
            "current_stock": current_stock,
            "average_units_sold": round(average_units_sold, 2),
            "current_discount": round(current_discount, 2),
            "suggested_discount": suggested_discount,
            "suggestion": "Increase discount to move slow-selling inventory",
        })

    suggestions.sort(
        key=lambda item: (item["current_stock"], -item["average_units_sold"]),
        reverse=True,
    )
    return suggestions


def _aggregate_top_products(store_id, start_date, limit=5):
    rows = (
        db.session.query(
            Product.product_id.label("product_id"),
            Product.product_name.label("product_name"),
            func.sum(Sale.quantity).label("total_quantity"),
            func.sum(Sale.profit).label("total_profit"),
        )
        .join(Sale, Sale.product_id == Product.product_id)
        .filter(
            Product.store_id == store_id,
            Sale.date >= start_date,
        )
        .group_by(Product.product_id, Product.product_name)
        .order_by(
            func.sum(Sale.quantity).desc(),
            func.sum(Sale.profit).desc(),
        )
        .limit(limit)
        .all()
    )

    return [
        {
            "product_id": row.product_id,
            "product_name": row.product_name,
            "total_quantity": int(row.total_quantity or 0),
            "total_profit": round(float(row.total_profit or 0), 2),
        }
        for row in rows
    ]


def _aggregate_profit_products(store_id):
    rows = (
        db.session.query(
            Product.product_id.label("product_id"),
            Product.product_name.label("product_name"),
            func.sum(Sale.quantity).label("total_quantity"),
            func.sum(Sale.profit).label("total_profit"),
        )
        .join(Sale, Sale.product_id == Product.product_id)
        .filter(Product.store_id == store_id)
        .group_by(Product.product_id, Product.product_name)
        .all()
    )

    aggregated_rows = [
        {
            "product_id": row.product_id,
            "product_name": row.product_name,
            "total_quantity": int(row.total_quantity or 0),
            "total_profit": round(float(row.total_profit or 0), 2),
        }
        for row in rows
    ]

    profit_products = sorted(
        [row for row in aggregated_rows if row["total_profit"] > 0],
        key=lambda item: item["total_profit"],
        reverse=True,
    )
    loss_products = sorted(
        [row for row in aggregated_rows if row["total_profit"] < 0],
        key=lambda item: item["total_profit"],
    )

    return profit_products, loss_products


@analytics_bp.route("/reorder-recommendations/<int:merchant_id>")
@merchant_login_required
def reorder_recommendations(merchant_id):
    current_merchant = get_current_merchant()
    if not current_merchant or current_merchant.merchant_id != merchant_id:
        return jsonify({"error": "Merchant access denied"}), 403

    try:
        store_id = resolve_store_id((request.args.get("store_id") or "").strip() or None)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    products = get_merchant_products(merchant_id, store_id=store_id)

    try:
        safety_buffer = int(request.args.get("safety_buffer", 0) or 0)
    except ValueError:
        return jsonify({"error": "safety_buffer must be an integer"}), 400

    if safety_buffer < 0:
        return jsonify({"error": "safety_buffer must be 0 or greater"}), 400

    recommendations = []

    for product in products:
        latest_inventory = _get_latest_inventory(product.product_id)
        current_stock = int(latest_inventory.inventory_level or 0) if latest_inventory else 0
        threshold = int(product.threshold or 0)
        predicted_demand = _estimate_predicted_demand(product, latest_inventory)
        target_stock = max(threshold, ceil(float(predicted_demand or 0))) + safety_buffer
        recommended_reorder = max(
            target_stock - current_stock,
            0,
        )

        if current_stock > threshold and recommended_reorder <= 0:
            continue

        recommendations.append({
            "product_id": product.product_id,
            "product_name": product.product_name,
            "current_stock": current_stock,
            "threshold": threshold,
            "predicted_demand": round(float(predicted_demand or 0), 2),
            "recommended_reorder": int(recommended_reorder),
            "supplier_name": product.supplier_name,
            "supplier_email": product.supplier_email,
        })

    recommendations.sort(key=lambda item: item["recommended_reorder"], reverse=True)

    return jsonify(recommendations), 200


@analytics_bp.route("/dashboard/<store_id>", methods=["GET"])
@merchant_login_required
def dashboard(store_id):
    try:
        store_id = resolve_store_id(store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    products = get_store_products(store_id)
    if not products:
        return jsonify({
            "store_id": store_id,
            "weekly_top_products": [],
            "monthly_top_products": [],
            "total_profit": 0.0,
            "profit_products": [],
            "loss_products": [],
            "understock_products": [],
        }), 200

    total_profit = (
        db.session.query(func.sum(Sale.profit))
        .join(Product, Product.product_id == Sale.product_id)
        .filter(Product.store_id == store_id)
        .scalar()
        or 0.0
    )
    today = date.today()
    last_7_days = today - timedelta(days=7)
    last_30_days = today - timedelta(days=30)

    weekly_top_products = _aggregate_top_products(store_id, last_7_days, limit=5)
    monthly_top_products = _aggregate_top_products(store_id, last_30_days, limit=5)
    profit_products, loss_products = _aggregate_profit_products(store_id)
    understock_products = _build_current_understock_products(products)

    return jsonify({
        "store_id": store_id,
        "weekly_top_products": weekly_top_products,
        "monthly_top_products": monthly_top_products,
        "total_profit": round(float(total_profit), 2),
        "profit_products": profit_products,
        "loss_products": loss_products,
        "understock_products": understock_products,
    }), 200


@analytics_bp.route("/predictions/<store_id>", methods=["GET"])
@merchant_login_required
def predictions_overview(store_id):
    try:
        store_id = resolve_store_id(store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    products = get_store_products(store_id)

    if not products:
        return jsonify({
            "store_id": store_id,
            "next_week_top_products": [],
            "next_month_top_products": [],
            "profit_prediction": [],
            "loss_prediction": [],
            "understock_risk": [],
            "overstock_risk": [],
        }), 200

    forecast_rows = []

    for product in products:
        latest_inventory = _get_latest_inventory(product.product_id)
        current_stock = latest_inventory.inventory_level if latest_inventory else 0
        predicted_demand = _estimate_predicted_demand(product, latest_inventory)
        predicted_profit = float(predicted_demand or 0) * float(
            (product.selling_price or 0) - (product.cost_price or 0)
        )

        row = {
            "product_id": product.product_id,
            "product_name": product.product_name,
            "threshold": int(product.threshold or 0),
            "current_stock": int(current_stock or 0),
            "predicted_demand": round(float(predicted_demand or 0), 2),
            "next_week_demand": round(float((predicted_demand or 0) * 7), 2),
            "next_month_demand": round(float((predicted_demand or 0) * 30), 2),
            "predicted_profit": round(float(predicted_profit or 0), 2),
            "selling_price": round(float(product.selling_price or 0), 2),
            "cost_price": round(float(product.cost_price or 0), 2),
        }
        forecast_rows.append(row)

    next_week_top_products = sorted(
        forecast_rows,
        key=lambda item: item["predicted_demand"],
        reverse=True,
    )[:5]

    next_month_top_products = sorted(
        forecast_rows,
        key=lambda item: item["next_month_demand"],
        reverse=True,
    )[:5]

    profit_prediction = sorted(
        [
            {
                "product_id": item["product_id"],
                "product_name": item["product_name"],
                "predicted_demand": item["predicted_demand"],
                "predicted_profit": item["predicted_profit"],
            }
            for item in forecast_rows
        ],
        key=lambda item: item["predicted_profit"],
        reverse=True,
    )

    loss_prediction = [
        {
            "product_id": item["product_id"],
            "product_name": item["product_name"],
            "predicted_demand": item["predicted_demand"],
            "predicted_profit": item["predicted_profit"],
        }
        for item in forecast_rows
        if item["predicted_profit"] < 0
    ]

    understock_risk = [
        {
            "product_id": item["product_id"],
            "product_name": item["product_name"],
            "stock": item["current_stock"],
            "threshold": item["threshold"],
            "predicted_demand": item["predicted_demand"],
        }
        for item in forecast_rows
        if item["current_stock"] >= item["threshold"]
        and item["predicted_demand"] > item["current_stock"]
    ]
    understock_risk.sort(
        key=lambda item: item["predicted_demand"] - item["stock"],
        reverse=True,
    )

    overstock_risk = [
        {
            "product_id": item["product_id"],
            "product_name": item["product_name"],
            "stock": item["current_stock"],
            "predicted_demand": item["predicted_demand"],
        }
        for item in forecast_rows
        if item["current_stock"] > (item["predicted_demand"] * 1.5)
    ]

    return jsonify({
        "store_id": store_id,
        "next_week_top_products": next_week_top_products,
        "next_month_top_products": next_month_top_products,
        "profit_prediction": profit_prediction,
        "loss_prediction": loss_prediction,
        "understock_risk": understock_risk,
        "overstock_risk": overstock_risk,
    }), 200


@analytics_bp.route("/insights/<store_id>", methods=["GET"])
@merchant_login_required
def insights(store_id):
    try:
        store_id = resolve_store_id(store_id)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403

    products = get_store_products(store_id)
    product_ids = [product.product_id for product in products]
    product_name_map = {
        product.product_id: product.product_name
        for product in products
    }

    if not product_ids:
        return jsonify({
            "store_id": store_id,
            "overall_profit": 0.0,
            "top_combos": [],
            "pricing_suggestions": [],
            "demand_suggestions": [],
            "discount_suggestions": [],
        }), 200

    overall_profit = (
        db.session.query(func.sum(Sale.profit))
        .filter(Sale.product_id.in_(product_ids))
        .scalar()
        or 0.0
    )

    return jsonify({
        "store_id": store_id,
        "overall_profit": round(float(overall_profit), 2),
        "top_combos": _build_top_combos(store_id, product_name_map),
        "pricing_suggestions": _build_pricing_suggestions(products),
        "demand_suggestions": _build_demand_suggestions(products),
        "discount_suggestions": _build_discount_suggestions(products),
    }), 200
