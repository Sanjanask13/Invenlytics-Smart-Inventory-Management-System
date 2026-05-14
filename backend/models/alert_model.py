from database import db

class Alert(db.Model):
    __tablename__ = "alerts"

    alert_id = db.Column(db.Integer, primary_key=True)
    merchant_id = db.Column(db.Integer, db.ForeignKey("merchants.merchant_id"))
    product_id = db.Column(db.String(20))
    alert_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime)