jfrom __future__ import annotations

import random
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import app  # noqa: E402
from database import db  # noqa: E402
from models.billing_model import Bill, BillItem  # noqa: E402
from models.inventory_model import Inventory  # noqa: E402
from models.merchant_model import Merchant  # noqa: E402
from models.prediction_model import Prediction  # noqa: E402
from models.product_model import Product  # noqa: E402
from models.sales_model import Sale  # noqa: E402
from models.store_model import Store  # noqa: E402


RANDOM_SEED = 42
STORE_ID = "S001"
MERCHANT_EMAIL = "demo.merchant@invenlytics.com"


@dataclass(frozen=True)
class ProductSeed:
    product_id: str
    product_name: str
    category: str
    supplier_name: str
    supplier_email: str
    stock: int
    threshold: int
    frequency_weight: int
    allow_loss: bool


PRODUCT_CATALOG = [
    ProductSeed("P001", "Full Cream Milk 1L", "Dairy", "Fresh Supply Co", "orders@freshsupplyco.com", 220, 45, 9, False),
    ProductSeed("P002", "Toned Milk 500ml", "Dairy", "Fresh Supply Co", "support@freshsupplyco.com", 180, 40, 8, False),
    ProductSeed("P003", "Curd Cup 400g", "Dairy", "ABC Traders", "sales@abctraders.in", 140, 35, 6, False),
    ProductSeed("P004", "Paneer Block 200g", "Dairy", "Daily Dairy Hub", "contact@dailydairyhub.com", 110, 28, 5, False),
    ProductSeed("P005", "Basmati Rice 5kg", "Grocery", "Grain House Ltd", "orders@grainhouse.in", 160, 38, 8, False),
    ProductSeed("P006", "Wheat Flour 10kg", "Grocery", "Home Harvest Foods", "hello@homeharvestfoods.com", 150, 32, 7, False),
    ProductSeed("P007", "Sunflower Oil 1L", "Grocery", "Pure Essentials Supply", "care@pureessentialsupply.com", 170, 30, 8, False),
    ProductSeed("P008", "Mustard Oil 1L", "Grocery", "Pure Essentials Supply", "orders@pureessentialsupply.com", 120, 24, 5, True),
    ProductSeed("P009", "Sugar 1kg", "Grocery", "Metro Wholesale Mart", "trade@metrowholesalemart.com", 260, 50, 8, False),
    ProductSeed("P010", "Toor Dal 1kg", "Grocery", "Grain House Ltd", "sales@grainhouse.in", 145, 36, 6, False),
    ProductSeed("P011", "Instant Noodles Pack", "Snacks", "SnackLine Distributors", "support@snackline.in", 300, 70, 10, False),
    ProductSeed("P012", "Potato Chips 100g", "Snacks", "SnackLine Distributors", "orders@snackline.in", 280, 65, 9, True),
    ProductSeed("P013", "Salted Biscuits", "Snacks", "Happy Basket Foods", "hello@happybasketfoods.com", 230, 48, 7, False),
    ProductSeed("P014", "Chocolate Cookies", "Snacks", "Happy Basket Foods", "sales@happybasketfoods.com", 190, 42, 6, False),
    ProductSeed("P015", "Orange Juice 1L", "Snacks", "City Beverage Depot", "trade@citybeveragedepot.com", 135, 30, 4, True),
    ProductSeed("P016", "Shampoo 180ml", "Personal Care", "CarePlus Distribution", "orders@careplusdist.com", 125, 26, 5, False),
    ProductSeed("P017", "Bath Soap Pack", "Personal Care", "CarePlus Distribution", "support@careplusdist.com", 210, 44, 6, False),
    ProductSeed("P018", "Toothpaste 150g", "Personal Care", "Urban Essentials LLP", "sales@urbanessentialsllp.com", 185, 34, 5, False),
    ProductSeed("P019", "Hair Oil 200ml", "Personal Care", "Urban Essentials LLP", "hello@urbanessentialsllp.com", 95, 22, 3, True),
    ProductSeed("P020", "Face Wash 100ml", "Personal Care", "Glow Retail Supply", "care@glowretailsupply.com", 90, 20, 3, False),
]


COMBO_GROUPS = [
    ("P001", "P011", "P012"),
    ("P005", "P007"),
    ("P009", "P010"),
    ("P016", "P018"),
    ("P013", "P015"),
]


def random_barcode(product_id: str) -> str:
    suffix = "".join(str(random.randint(0, 9)) for _ in range(8))
    return f"{product_id[-3:]}{suffix}"[:12]


def season_for_month(month: int) -> str:
    if month in (12, 1, 2):
        return "Winter"
    if month in (3, 4, 5):
        return "Spring"
    if month in (6, 7, 8):
        return "Summer"
    return "Autumn"


def weather_for_category(category: str) -> str:
    weather_map = {
        "Dairy": "Cloudy",
        "Grocery": "Sunny",
        "Snacks": "Rainy",
        "Personal Care": "Sunny",
    }
    return weather_map.get(category, "Normal")


def ensure_demo_merchant_and_store() -> tuple[Merchant, Store]:
    merchant = Merchant.query.filter_by(email=MERCHANT_EMAIL).first()
    if merchant is None:
        merchant = Merchant(
            shop_name="Invenlytics Demo Mart",
            owner_name="Demo Owner",
            email=MERCHANT_EMAIL,
            password="demo-password",
            region="Bangalore",
            created_at=datetime.utcnow() - timedelta(days=120),
        )
        db.session.add(merchant)
        db.session.flush()

    store = Store.query.get(STORE_ID)
    if store is None:
        store = Store(store_id=STORE_ID, merchant_id=merchant.merchant_id)
        db.session.add(store)
    else:
        store.merchant_id = merchant.merchant_id

    db.session.flush()
    return merchant, store


def clear_existing_store_data(store_id: str) -> None:
    # Clear dependent records first so reseeding does not hit FK or duplicate-key issues.
    BillItem.query.delete(synchronize_session=False)
    Bill.query.delete(synchronize_session=False)
    Prediction.query.delete(synchronize_session=False)
    Sale.query.delete(synchronize_session=False)
    Inventory.query.delete(synchronize_session=False)
    Product.query.delete(synchronize_session=False)
    db.session.commit()


def create_products(store_id: str) -> dict[str, dict[str, float | int | str | bool]]:
    product_state: dict[str, dict[str, float | int | str | bool]] = {}
    products: list[Product] = []
    inventory_rows: list[Inventory] = []

    for index, seed in enumerate(PRODUCT_CATALOG, start=1):
        cost_price = round(random.uniform(20, 100), 2)
        if seed.allow_loss and index % 2 == 0:
            margin_factor = random.uniform(0.85, 0.98)
        else:
            margin_factor = random.uniform(1.08, 1.35)
        selling_price = round(cost_price * margin_factor, 2)
        competitor_factor = random.uniform(0.9, 1.12)
        competitor_price = round(selling_price * competitor_factor, 2)

        product = Product(
            product_id=seed.product_id,
            store_id=store_id,
            barcode=random_barcode(seed.product_id),
            product_name=seed.product_name,
            category=seed.category,
            cost_price=cost_price,
            selling_price=selling_price,
            competitor_price=competitor_price,
            threshold=seed.threshold,
            supplier_name=seed.supplier_name,
            supplier_email=seed.supplier_email,
        )
        products.append(product)

        inventory_rows.append(Inventory(
            product_id=seed.product_id,
            date=(date.today() - timedelta(days=31)),
            inventory_level=seed.stock,
            units_sold=0,
            units_ordered=seed.stock,
            discount=0.0,
            weather=weather_for_category(seed.category),
            holiday=0,
            season=season_for_month((date.today() - timedelta(days=31)).month),
        ))

        product_state[seed.product_id] = {
            "product_name": seed.product_name,
            "category": seed.category,
            "barcode": product.barcode,
            "supplier_name": seed.supplier_name,
            "supplier_email": seed.supplier_email,
            "cost_price": cost_price,
            "selling_price": selling_price,
            "stock": seed.stock,
            "threshold": seed.threshold,
            "frequency_weight": seed.frequency_weight,
        }

    db.session.add_all(products)
    db.session.commit()
    db.session.add_all(inventory_rows)
    db.session.commit()

    return product_state


def weighted_product_ids() -> list[str]:
    weighted_ids: list[str] = []
    for seed in PRODUCT_CATALOG:
        weighted_ids.extend([seed.product_id] * seed.frequency_weight)
    return weighted_ids


def choose_bill_products(weighted_ids: list[str], current_stock: dict[str, int]) -> list[str]:
    available_weighted_ids = [product_id for product_id in weighted_ids if current_stock[product_id] > 0]
    if not available_weighted_ids:
        return []

    if random.random() < 0.45:
        combo = random.choice(COMBO_GROUPS)
        combo_products = [product_id for product_id in combo if current_stock[product_id] > 0]
        if len(combo_products) >= 2:
            return combo_products[: random.randint(2, len(combo_products))]

    line_count = random.choices([1, 2, 3], weights=[0.45, 0.4, 0.15], k=1)[0]
    chosen: list[str] = []
    seen = set()
    for _ in range(line_count * 3):
        product_id = random.choice(available_weighted_ids)
        if product_id in seen:
            continue
        seen.add(product_id)
        chosen.append(product_id)
        if len(chosen) == line_count:
            break
    return chosen


def create_sales_and_inventory(store_id: str, product_state: dict[str, dict[str, float | int | str | bool]]) -> tuple[int, int]:
    current_stock = {
        product_id: int(state["stock"])
        for product_id, state in product_state.items()
    }
    weighted_ids = weighted_product_ids()
    today = date.today()
    bill_counter = 0
    sale_counter = 0

    for day_offset in range(30, 0, -1):
        sale_day = today - timedelta(days=day_offset)
        bills_today = random.choices([1, 2, 3], weights=[0.45, 0.45, 0.10], k=1)[0]

        for bill_index in range(bills_today):
            bill_products = choose_bill_products(weighted_ids, current_stock)
            if not bill_products:
                continue

            created_at = datetime.combine(
                sale_day,
                datetime.min.time(),
            ) + timedelta(hours=9 + bill_index * 2, minutes=random.randint(0, 45))

            bill = Bill(
                bill_no=f"DEMO-{sale_day.strftime('%Y%m%d')}-{bill_counter + 1:03d}",
                store_id=store_id,
                created_at=created_at,
                total_items=0,
                total_amount=0.0,
            )
            db.session.add(bill)
            db.session.flush()

            bill_total_amount = 0.0
            bill_total_items = 0

            for product_id in bill_products:
                state = product_state[product_id]
                max_quantity = min(10, current_stock[product_id])
                if max_quantity <= 0:
                    continue

                quantity = random.randint(1, max_quantity)
                selling_price = float(state["selling_price"])
                cost_price = float(state["cost_price"])
                discount = round(random.choice([0, 0, 0, 5, 10, 15]), 2)
                line_total = round(max(selling_price * quantity - discount, 0.0), 2)
                profit = round((selling_price - cost_price) * quantity, 2)

                sale = Sale(
                    product_id=product_id,
                    quantity=quantity,
                    date=sale_day,
                    profit=profit,
                    is_loss=profit < 0,
                )
                db.session.add(sale)

                bill_item = BillItem(
                    bill_id=bill.bill_id,
                    product_id=product_id,
                    barcode=str(state["barcode"]),
                    quantity=quantity,
                    unit_price=selling_price,
                    discount=discount,
                    line_total=line_total,
                    predicted_demand=None,
                )
                db.session.add(bill_item)

                current_stock[product_id] -= quantity
                inventory_snapshot = Inventory(
                    product_id=product_id,
                    date=sale_day,
                    inventory_level=current_stock[product_id],
                    units_sold=quantity,
                    units_ordered=0,
                    discount=discount,
                    weather=weather_for_category(str(state["category"])),
                    holiday=1 if sale_day.weekday() in (5, 6) else 0,
                    season=season_for_month(sale_day.month),
                )
                db.session.add(inventory_snapshot)

                bill_total_items += quantity
                bill_total_amount += line_total
                sale_counter += 1

            if bill_total_items == 0:
                db.session.delete(bill)
                continue

            bill.total_items = bill_total_items
            bill.total_amount = round(bill_total_amount, 2)
            bill_counter += 1

    return bill_counter, sale_counter


def seed_demo_data() -> None:
    random.seed(RANDOM_SEED)

    with app.app_context():
        merchant, store = ensure_demo_merchant_and_store()
        clear_existing_store_data(store.store_id)
        product_state = create_products(store.store_id)
        bill_count, sale_count = create_sales_and_inventory(store.store_id, product_state)
        db.session.commit()

        profitable_products = sum(
            1 for state in product_state.values() if float(state["selling_price"]) >= float(state["cost_price"])
        )
        loss_products = len(product_state) - profitable_products

        print("Demo data seeded successfully.")
        print(f"Merchant: {merchant.shop_name} ({merchant.email})")
        print(f"Store ID: {store.store_id}")
        print(f"Products created: {len(product_state)}")
        print(f"Bills created: {bill_count}")
        print(f"Sales records created: {sale_count}")
        print(f"Profitable products: {profitable_products}")
        print(f"Loss-making products: {loss_products}")


if __name__ == "__main__":
    seed_demo_data()
