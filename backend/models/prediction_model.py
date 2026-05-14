from database import db

class Prediction(db.Model):
    __tablename__ = "predictions"

    prediction_id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.String(20), db.ForeignKey("products.product_id"))
    predicted_demand = db.Column(db.Float)
    prediction_date = db.Column(db.Date)