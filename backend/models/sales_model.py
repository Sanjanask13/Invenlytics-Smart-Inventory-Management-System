from database import db


class Sale(db.Model):
    __tablename__ = "sales"

    sale_id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.String(20))
    quantity = db.Column(db.Integer)
    date = db.Column(db.Date)
    profit = db.Column(db.Float, nullable=True)
    is_loss = db.Column(db.Boolean, default=False, nullable=False)
