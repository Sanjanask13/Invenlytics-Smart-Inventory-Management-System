import bcrypt
from functools import wraps
from flask import Blueprint, request, jsonify, session
from database import db
from models.merchant_model import Merchant
from models.store_model import Store
from models.product_model import Product
from models.sales_model import Sale
from models.billing_model import Bill
from models.alert_model import Alert
from models.prediction_model import Prediction
from models.inventory_model import Inventory
from sqlalchemy import func
from models.admin_model import Admin


admin_bp = Blueprint("admin", __name__)


def admin_login_required(route_handler):
    @wraps(route_handler)
    def wrapped(*args, **kwargs):
        if not session.get("admin_id"):
            return jsonify({"error": "Admin authentication required"}), 401
        return route_handler(*args, **kwargs)
    return wrapped


def _check_admin_password(admin, password):
    stored_password = admin.password or ""
    password = password or ""

    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored_password.encode("utf-8"))
    except ValueError:
        return stored_password == password

@admin_bp.route("/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    admin = Admin.query.filter_by(email=email).first()

    if not admin:
        return jsonify({"error": "Admin not found"}), 404

    if not _check_admin_password(admin, password):
        return jsonify({"error": "Invalid password"}), 401

    session["admin_id"] = admin.admin_id
    session["admin_email"] = admin.email

    return jsonify({
        "message": "Admin login success",
        "admin": {
            "admin_id": admin.admin_id,
            "name": admin.name,
            "email": admin.email
        }
    })


@admin_bp.route("/admin/session", methods=["GET"])
def admin_session():
    if not session.get("admin_id"):
        return jsonify({"authenticated": False}), 401

    admin = Admin.query.get(session["admin_id"])
    if not admin:
        session.clear()
        return jsonify({"authenticated": False}), 401

    return jsonify({
        "authenticated": True,
        "admin": {
            "admin_id": admin.admin_id,
            "name": admin.name,
            "email": admin.email
        }
    })


@admin_bp.route("/admin/logout", methods=["POST"])
@admin_login_required
def admin_logout():
    session.clear()
    return jsonify({"message": "Admin logged out"})

def _build_user_summary(merchant):
    return {
        "merchant_id": merchant.merchant_id,
        "shop_name": merchant.shop_name,
        "owner_name": merchant.owner_name,
        "email": merchant.email,
        "region": merchant.region,
        "created_at": merchant.created_at.isoformat() if merchant.created_at else None
    }


@admin_bp.route("/admin/users", methods=["GET"])
@admin_login_required
def get_users():
    merchants = Merchant.query.order_by(Merchant.merchant_id.asc()).all()
    return jsonify([_build_user_summary(merchant) for merchant in merchants])


@admin_bp.route("/admin/user/<int:id>", methods=["GET"])
@admin_login_required
def get_user_details(id):
    merchant = Merchant.query.get(id)
    if not merchant:
        return jsonify({"error": "User not found"}), 404

    stores = Store.query.filter_by(merchant_id=id).all()
    store_ids = [store.store_id for store in stores]

    if store_ids:
        total_products = (
            db.session.query(func.count(Product.product_id))
            .filter(Product.store_id.in_(store_ids))
            .scalar()
            or 0
        )
    else:
        total_products = 0

    if store_ids:
        total_sales = (
            db.session.query(func.count(Sale.sale_id))
            .join(Product, Product.product_id == Sale.product_id)
            .filter(Product.store_id.in_(store_ids))
            .scalar()
            or 0
        )
        total_revenue = (
            db.session.query(func.sum(Bill.total_amount))
            .filter(Bill.store_id.in_(store_ids))
            .scalar()
            or 0.0
        )
    else:
        total_sales = 0
        total_revenue = 0.0

    return jsonify({
        "user": _build_user_summary(merchant),
        "summary": {
            "total_products": int(total_products),
            "total_sales": int(total_sales),
            "total_revenue": round(float(total_revenue), 2),
        }
    })


@admin_bp.route("/admin/user/<int:id>", methods=["DELETE"])
@admin_login_required
def delete_user(id):
    merchant = Merchant.query.get(id)
    if not merchant:
        return jsonify({"error": "User not found"}), 404

    stores = Store.query.filter_by(merchant_id=id).all()
    store_ids = [store.store_id for store in stores]

    if store_ids:
        products = Product.query.filter(Product.store_id.in_(store_ids)).all()
        product_ids = [product.product_id for product in products]
    else:
        products = []
        product_ids = []

    if product_ids:
        Sale.query.filter(Sale.product_id.in_(product_ids)).delete(synchronize_session=False)
        Inventory.query.filter(Inventory.product_id.in_(product_ids)).delete(synchronize_session=False)
        Prediction.query.filter(Prediction.product_id.in_(product_ids)).delete(synchronize_session=False)
        Alert.query.filter(Alert.product_id.in_(product_ids)).delete(synchronize_session=False)
        Product.query.filter(Product.product_id.in_(product_ids)).delete(synchronize_session=False)

    if store_ids:
        Store.query.filter(Store.store_id.in_(store_ids)).delete(synchronize_session=False)

    Alert.query.filter_by(merchant_id=id).delete(synchronize_session=False)
    db.session.delete(merchant)
    db.session.commit()

    return jsonify({"message": "User deleted successfully"})

# TOP merchants by product sales
@admin_bp.route("/admin/top-merchants")
@admin_login_required
def top_merchants():
    result = db.session.query(
        Inventory.product_id,
        func.sum(Inventory.units_sold).label("total_sold")
    ).group_by(Inventory.product_id) \
     .order_by(func.sum(Inventory.units_sold).desc()) \
     .limit(5).all()

    return jsonify([
        {"product_id": r[0], "total_sold": r[1]}
        for r in result
    ])
