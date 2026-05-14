from database import db

class Inventory(db.Model):
    __tablename__ = "inventory"

    inventory_id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.String(20), db.ForeignKey("products.product_id"))
    date = db.Column(db.Date)
    inventory_level = db.Column(db.Integer)
    units_sold = db.Column(db.Integer)
    units_ordered = db.Column(db.Integer)
    discount = db.Column(db.Float)
    weather = db.Column(db.String(50))
    holiday = db.Column(db.Integer)
    season = db.Column(db.String(50))


   
