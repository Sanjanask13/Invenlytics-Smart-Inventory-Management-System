from datetime import datetime

from flask import Blueprint, request, jsonify, session
from models.merchant_model import Merchant
from models.store_model import Store
from database import db
import bcrypt
from services.tenant_service import ensure_default_store

auth_bp = Blueprint("auth", __name__)

# REGISTER
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    # Check if user already exists
    existing = Merchant.query.filter_by(email=data["email"]).first()
    if existing:
        return jsonify({"error": "Email already exists"}), 400

    # Hash password
    hashed_pw = bcrypt.hashpw(data["password"].encode("utf-8"), bcrypt.gensalt())

    new_merchant = Merchant(
        shop_name=data["shop_name"],
        owner_name=data["owner_name"],
        email=data["email"],
        password=hashed_pw.decode("utf-8"),
        region=data["region"],
        created_at=datetime.utcnow()
    )

    db.session.add(new_merchant)
    db.session.commit()
    store = ensure_default_store(new_merchant)

    return jsonify({
        "message": "Merchant registered successfully",
        "merchant": {
            **new_merchant.to_dict(),
            "store_id": store.store_id,
        }
    })



    # LOGIN
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    merchant = Merchant.query.filter_by(email=data["email"]).first()

    if not merchant:
        return jsonify({"error": "User not found"}), 404

    if not bcrypt.checkpw(data["password"].encode("utf-8"), merchant.password.encode("utf-8")):
        return jsonify({"error": "Invalid password"}), 401

    store = (
        Store.query.filter_by(merchant_id=merchant.merchant_id)
        .order_by(Store.store_id.asc())
        .first()
    ) or ensure_default_store(merchant)

    session["merchant_id"] = merchant.merchant_id
    session["store_id"] = store.store_id

    return jsonify({
        "message": "Login successful",
        "token": f"merchant-session-{merchant.merchant_id}",
        "merchant": {
            **merchant.to_dict(),
            "store_id": store.store_id,
        }
    })


@auth_bp.route("/session", methods=["GET"])
def merchant_session():
    merchant_id = session.get("merchant_id")
    if not merchant_id:
        return jsonify({"error": "Merchant login required"}), 401

    merchant = Merchant.query.get(merchant_id)
    if not merchant:
        session.clear()
        return jsonify({"error": "Merchant session expired"}), 401

    store = (
        Store.query.filter_by(merchant_id=merchant.merchant_id)
        .order_by(Store.store_id.asc())
        .first()
    ) or ensure_default_store(merchant)
    session["store_id"] = store.store_id

    return jsonify({
        "merchant": {
            **merchant.to_dict(),
            "store_id": store.store_id,
        }
    }), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.pop("merchant_id", None)
    session.pop("store_id", None)
    return jsonify({"message": "Logged out successfully"}), 200
