from database import db

class Store(db.Model):
    __tablename__ = "stores"

    store_id = db.Column(db.String(20), primary_key=True)
    merchant_id = db.Column(db.Integer, db.ForeignKey("merchants.merchant_id"))