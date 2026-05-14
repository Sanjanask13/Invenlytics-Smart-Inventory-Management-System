from database import db


class Bill(db.Model):
    __tablename__ = "bills"

    bill_id = db.Column(db.Integer, primary_key=True)
    bill_no = db.Column(db.String(30), unique=True, nullable=False)
    store_id = db.Column(db.String(20), db.ForeignKey("stores.store_id"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False)
    total_items = db.Column(db.Integer, default=0)
    total_amount = db.Column(db.Float, default=0.0)


class BillItem(db.Model):
    __tablename__ = "bill_items"

    bill_item_id = db.Column(db.Integer, primary_key=True)
    bill_id = db.Column(db.Integer, db.ForeignKey("bills.bill_id"), nullable=False)
    product_id = db.Column(db.String(20), db.ForeignKey("products.product_id"), nullable=False)
    barcode = db.Column(db.String(20), nullable=True)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    discount = db.Column(db.Float, default=0.0)
    line_total = db.Column(db.Float, nullable=False)
    predicted_demand = db.Column(db.Float, nullable=True)
