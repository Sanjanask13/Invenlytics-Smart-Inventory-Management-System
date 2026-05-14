from functools import wraps

from flask import jsonify, request, session

from database import db
from models.merchant_model import Merchant
from models.store_model import Store


def merchant_login_required(route_handler):
    @wraps(route_handler)
    def wrapper(*args, **kwargs):
        merchant = get_current_merchant()
        if not merchant:
            return jsonify({"error": "Merchant login required"}), 401
        return route_handler(*args, **kwargs)

    return wrapper


def get_current_merchant():
    merchant_id = session.get("merchant_id")
    if not merchant_id:
        return None

    merchant = Merchant.query.get(merchant_id)
    if not merchant:
        session.pop("merchant_id", None)
        session.pop("store_id", None)
        return None

    return merchant


def ensure_default_store(merchant):
    existing_store = (
        Store.query.filter_by(merchant_id=merchant.merchant_id)
        .order_by(Store.store_id.asc())
        .first()
    )
    if existing_store:
        return existing_store

    base_store_id = f"S{merchant.merchant_id:03d}"
    candidate_store_id = base_store_id
    suffix = 1

    while Store.query.get(candidate_store_id):
        candidate_store_id = f"{base_store_id}-{suffix}"
        suffix += 1

    store = Store(store_id=candidate_store_id, merchant_id=merchant.merchant_id)
    db.session.add(store)
    db.session.commit()
    return store


def get_authorized_store_ids(merchant=None):
    merchant = merchant or get_current_merchant()
    if not merchant:
        return []

    stores = Store.query.filter_by(merchant_id=merchant.merchant_id).order_by(Store.store_id.asc()).all()
    if not stores:
        stores = [ensure_default_store(merchant)]

    return [store.store_id for store in stores]


def resolve_store_id(requested_store_id=None, merchant=None):
    merchant = merchant or get_current_merchant()
    if not merchant:
        raise PermissionError("Merchant login required")

    authorized_store_ids = get_authorized_store_ids(merchant)

    normalized_store_id = (requested_store_id or "").strip()
    if normalized_store_id:
        if normalized_store_id not in authorized_store_ids:
            raise PermissionError("Store access denied")
        session["store_id"] = normalized_store_id
        return normalized_store_id

    session_store_id = (session.get("store_id") or "").strip()
    if session_store_id in authorized_store_ids:
        return session_store_id

    default_store_id = authorized_store_ids[0]
    session["store_id"] = default_store_id
    return default_store_id


def resolve_merchant_context():
    merchant = get_current_merchant()
    if not merchant:
        raise PermissionError("Merchant login required")

    store_id = resolve_store_id(
        request.headers.get("X-Store-Id")
        or request.args.get("store_id")
        or ((request.get_json(silent=True) or {}).get("store_id"))
        or session.get("store_id"),
        merchant=merchant,
    )
    return merchant, store_id
