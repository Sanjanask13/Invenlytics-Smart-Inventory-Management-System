from database import db

class Merchant(db.Model):
    __tablename__ = "merchants"

    merchant_id = db.Column(db.Integer, primary_key=True)
    shop_name = db.Column(db.String(150))
    owner_name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(255))
    region = db.Column(db.String(100))
    created_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            "merchant_id": self.merchant_id,
            "shop_name": self.shop_name,
            "owner_name": self.owner_name,
            "email": self.email,
            "region": self.region
        }