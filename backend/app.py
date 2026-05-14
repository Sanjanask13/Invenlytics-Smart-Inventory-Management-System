from flask import Flask
from flask_cors import CORS
from flask import Blueprint, request, jsonify
from config import Config
from database import db
from models.merchant_model import Merchant
from models.store_model import Store
from models.product_model import Product
from models.inventory_model import Inventory
from models.prediction_model import Prediction
from models.alert_model import Alert
from models.billing_model import Bill, BillItem
from models.order_model import Order
from routes.auth_routes import auth_bp
from routes.product_routes import product_bp
from routes.prediction_routes import prediction_bp
from routes.analytics_routes import analytics_bp
from routes.admin_routes import admin_bp
from routes.sales_routes import sales_bp
from routes.order_routes import order_bp
from sqlalchemy import inspect, text


app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = app.config["SECRET_KEY"]

CORS(
    app,
    supports_credentials=True,
    resources={
        r"/*": {
            "origins": [
                "http://localhost:3000",
                "http://127.0.0.1:3000"
            ]
        }
    }
)

db.init_app(app)


def ensure_product_barcode_column():
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()

    if "products" not in tables:
        return

    product_columns = {column["name"] for column in inspector.get_columns("products")}

    if "barcode" not in product_columns:
        db.session.execute(text("ALTER TABLE products ADD COLUMN barcode VARCHAR(100)"))
        db.session.commit()


def ensure_product_supplier_column():
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()

    if "products" not in tables:
        return

    product_columns = {column["name"] for column in inspector.get_columns("products")}

    if "supplier_name" not in product_columns:
        db.session.execute(text("ALTER TABLE products ADD COLUMN supplier_name VARCHAR(150)"))
        db.session.commit()

    if "supplier_email" not in product_columns:
        db.session.execute(text("ALTER TABLE products ADD COLUMN supplier_email VARCHAR(120)"))
        db.session.commit()


def ensure_product_cost_price_column():
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()

    if "products" not in tables:
        return

    product_columns = {column["name"] for column in inspector.get_columns("products")}

    if "cost_price" not in product_columns:
        db.session.execute(text("ALTER TABLE products ADD COLUMN cost_price FLOAT"))
        db.session.execute(text("UPDATE products SET cost_price = price WHERE cost_price IS NULL"))
        db.session.commit()


def ensure_product_selling_price_column():
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()

    if "products" not in tables:
        return

    product_columns = {column["name"] for column in inspector.get_columns("products")}

    if "selling_price" not in product_columns:
        db.session.execute(text("ALTER TABLE products ADD COLUMN selling_price FLOAT"))

        if "price" in product_columns:
            db.session.execute(text("UPDATE products SET selling_price = price WHERE selling_price IS NULL"))

        db.session.commit()


def ensure_sales_profit_columns():
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()

    if "sales" not in tables:
        return

    sales_columns = {column["name"] for column in inspector.get_columns("sales")}

    if "profit" not in sales_columns:
        db.session.execute(text("ALTER TABLE sales ADD COLUMN profit FLOAT"))
        db.session.commit()

    if "is_loss" not in sales_columns:
        db.session.execute(text("ALTER TABLE sales ADD COLUMN is_loss BOOLEAN DEFAULT FALSE"))
        db.session.execute(text("UPDATE sales SET is_loss = FALSE WHERE is_loss IS NULL"))
        db.session.commit()

app.register_blueprint(auth_bp)
app.register_blueprint(product_bp)
app.register_blueprint(prediction_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(sales_bp)
app.register_blueprint(order_bp)

with app.app_context():
    db.create_all()
    ensure_product_barcode_column()
    ensure_product_supplier_column()
    ensure_product_cost_price_column()
    ensure_product_selling_price_column()
    ensure_sales_profit_columns()

print(app.url_map)

@app.route("/")
def home():
    return {"message": "Invenlytics backend running"}

if __name__ == "__main__":
    app.run(debug=True)
