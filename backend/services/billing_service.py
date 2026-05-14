from datetime import datetime

from database import db
from ml_models.anomaly_model import detect_anomaly
from ml_models.xgb_model import predict_demand
from models.billing_model import Bill, BillItem
from models.inventory_model import Inventory
from models.prediction_model import Prediction
from models.product_model import Product
from models.sales_model import Sale


def resolve_prev_demand(product_id):
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


def lookup_product_by_barcode(barcode):
    return Product.query.filter_by(barcode=barcode).first()


def build_bill_response(bill, items_payload):
    predictions = [
        {
            "product_id": item["product_id"],
            "product_name": item["product_name"],
            "predicted_demand": item.get("predicted_demand"),
        }
        for item in items_payload
    ]

    return {
        "bill_id": bill.bill_id,
        "invoice_no": bill.bill_no,
        "created_at": bill.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "total_items": bill.total_items,
        "total_amount": round(float(bill.total_amount or 0), 2),
        "items": items_payload,
        "predictions": predictions,
    }


def _normalize_item(raw_item):
    product_id = str(raw_item.get("product_id") or "").strip()
    barcode = str(raw_item.get("barcode") or "").strip()

    if not product_id and not barcode:
        raise ValueError("Each bill item requires product_id or barcode")

    quantity = raw_item.get("quantity", 1)
    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        raise ValueError("quantity must be an integer")

    if quantity <= 0:
        raise ValueError("quantity must be greater than 0")

    discount = raw_item.get("discount", 0)
    try:
        discount = float(discount)
    except (TypeError, ValueError):
        raise ValueError("discount must be a number")

    if discount < 0:
        raise ValueError("discount must be 0 or greater")
    if discount > 100:
        raise ValueError("discount must be 100 or less")

    price = raw_item.get("price")
    if price in (None, ""):
        price = None
    else:
        try:
            price = float(price)
        except (TypeError, ValueError):
            raise ValueError("price must be a number")

        if price < 0:
            raise ValueError("price must be 0 or greater")

    return {
        "product_id": product_id,
        "barcode": barcode,
        "quantity": quantity,
        "discount": discount,
        "price": price,
    }


def _resolve_product(normalized_item, store_id=None):
    product = None
    if normalized_item["product_id"]:
        product = Product.query.get(normalized_item["product_id"])
    elif normalized_item["barcode"]:
        product = lookup_product_by_barcode(normalized_item["barcode"])

    if not product:
        raise ValueError("Product not found")
    if store_id and product.store_id != store_id:
        raise ValueError("Product not found")
    if product.price is None:
        raise ValueError(f"Product price is missing for {product.product_id}")
    if not product.category:
        raise ValueError(f"Product category is missing for {product.product_id}")

    return product


def get_product_by_barcode_payload(barcode, store_id=None):
    product = lookup_product_by_barcode(barcode)
    if not product:
        raise ValueError("Product not found for this barcode")
    if store_id and product.store_id != store_id:
        raise ValueError("Product not found for this barcode")

    last_inventory = (
        Inventory.query.filter_by(product_id=product.product_id)
        .order_by(Inventory.date.desc(), Inventory.inventory_id.desc())
        .first()
    )

    return {
        "product_id": product.product_id,
        "barcode": product.barcode,
        "product_name": product.product_name,
        "category": product.category,
        "price": float(product.price or 0),
        "stock_left": last_inventory.inventory_level if last_inventory else 0,
    }


def process_bill(items, sale_date=None, store_id=None):
    if not items:
        raise ValueError("At least one bill item is required")

    if sale_date is None:
        sale_date = datetime.now()

    normalized_items = [_normalize_item(item) for item in items]

    prepared_items = []
    total_items = 0
    total_amount = 0.0

    for item in normalized_items:
        product = _resolve_product(item, store_id=store_id)
        last_inventory = (
            Inventory.query.filter_by(product_id=product.product_id)
            .order_by(Inventory.date.desc(), Inventory.inventory_id.desc())
            .first()
        )

        previous_inventory = last_inventory.inventory_level if last_inventory else 0
        if item["quantity"] > previous_inventory:
            raise ValueError(f"Insufficient stock::{product.product_id}::{previous_inventory}")

        prev_demand = resolve_prev_demand(product.product_id)
        unit_price = (
            float(item["price"])
            if item["price"] is not None
            else float(product.price)
        )
        unit_cost = float(product.cost_price or 0)
        line_total = max(
            unit_price * item["quantity"] * (1 - (item["discount"] / 100)),
            0.0,
        )
        profit = (unit_price - unit_cost) * item["quantity"]

        prepared_items.append({
            "product": product,
            "quantity": item["quantity"],
            "discount": item["discount"],
            "unit_price": unit_price,
            "unit_cost": unit_cost,
            "line_total": line_total,
            "profit": profit,
            "is_loss": profit < 0,
            "prev_demand": prev_demand,
            "previous_inventory": previous_inventory,
            "new_inventory": previous_inventory - item["quantity"],
            "last_inventory": last_inventory,
        })

        total_items += item["quantity"]
        total_amount += line_total

    bill = Bill(
        bill_no=f"INV-{sale_date.strftime('%Y%m%d%H%M%S%f')}",
        store_id=store_id,
        created_at=sale_date,
        total_items=total_items,
        total_amount=total_amount,
    )
    db.session.add(bill)
    db.session.flush()

    invoice_items = []
    anomaly_warnings = []

    for prepared in prepared_items:
        product = prepared["product"]

        sale = Sale(
            product_id=product.product_id,
            quantity=prepared["quantity"],
            date=sale_date.date(),
            profit=prepared["profit"],
            is_loss=prepared["is_loss"],
        )
        db.session.add(sale)

        inventory = Inventory(
            product_id=product.product_id,
            date=sale_date.date(),
            inventory_level=prepared["new_inventory"],
            units_sold=prepared["quantity"],
            units_ordered=0,
            discount=prepared["discount"],
            weather=prepared["last_inventory"].weather if prepared["last_inventory"] and prepared["last_inventory"].weather else None,
            holiday=prepared["last_inventory"].holiday if prepared["last_inventory"] and prepared["last_inventory"].holiday is not None else 0,
            season=prepared["last_inventory"].season if prepared["last_inventory"] and prepared["last_inventory"].season else None,
        )
        db.session.add(inventory)

        model_input = {
            "Date": sale_date.strftime("%Y-%m-%d"),
            "Product ID": product.product_id,
            "Category": product.category,
            "Inventory Level": prepared["new_inventory"],
            "Price": prepared["unit_price"],
            "Discount": prepared["discount"],
            "Prev_Demand": prepared["prev_demand"],
        }

        predicted_demand = float(predict_demand(model_input))

        anomaly_input = {
            "Inventory Level": prepared["new_inventory"],
            "Price": prepared["unit_price"],
            "Discount": prepared["discount"],
            "Units Sold": prepared["quantity"],
        }
        anomaly_status = "Normal"
        try:
            anomaly_status = detect_anomaly(anomaly_input)
        except FileNotFoundError:
            anomaly_status = "Model unavailable"
        except Exception:
            anomaly_status = "Detection failed"

        prediction = Prediction(
            product_id=product.product_id,
            predicted_demand=predicted_demand,
            prediction_date=sale_date.date(),
        )
        db.session.add(prediction)

        bill_item = BillItem(
            bill_id=bill.bill_id,
            product_id=product.product_id,
            barcode=product.barcode,
            quantity=prepared["quantity"],
            unit_price=prepared["unit_price"],
            discount=prepared["discount"],
            line_total=prepared["line_total"],
            predicted_demand=predicted_demand,
        )
        db.session.add(bill_item)

        if anomaly_status == "Anomaly Detected":
            anomaly_warnings.append({
                "product_id": product.product_id,
                "product_name": product.product_name,
                "message": (
                    f"Unusual transaction detected for {product.product_name}. "
                    "Please review quantity, discount, price, or remaining stock."
                ),
            })

        invoice_items.append({
            "product_id": product.product_id,
            "product_name": product.product_name,
            "barcode": product.barcode,
            "category": product.category,
            "quantity": prepared["quantity"],
            "unit_price": round(prepared["unit_price"], 2),
            "discount": round(prepared["discount"], 2),
            "line_total": round(prepared["line_total"], 2),
            "profit": round(prepared["profit"], 2),
            "is_loss": prepared["is_loss"],
            "stock_after_sale": prepared["new_inventory"],
            "prev_demand": round(prepared["prev_demand"], 2),
            "predicted_demand": round(predicted_demand, 2),
            "anomaly_status": anomaly_status,
        })

    db.session.flush()

    return {
        "bill": bill,
        "invoice": build_bill_response(bill, invoice_items),
        "has_anomaly": bool(anomaly_warnings),
        "anomaly_warnings": anomaly_warnings,
    }
