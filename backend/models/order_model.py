from database import db


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.String(20), db.ForeignKey("products.product_id"), nullable=False)
    supplier_name = db.Column(db.String(150), nullable=False)
    supplier_email = db.Column(db.String(120), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="sent")
    created_at = db.Column(db.DateTime, nullable=False)
