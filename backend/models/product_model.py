from database import db


class Product(db.Model):
    __tablename__ = "products"

    product_id = db.Column(db.String(20), primary_key=True)
    store_id = db.Column(db.String(20), db.ForeignKey("stores.store_id"))
    barcode = db.Column(db.String(12), unique=True, nullable=False)
    product_name = db.Column(db.String(150))
    category = db.Column(db.String(100))
    cost_price = db.Column(db.Float, nullable=False, default=0.0)
    selling_price = db.Column(db.Float, nullable=False, default=0.0)
    competitor_price = db.Column(db.Float)
    threshold = db.Column(db.Integer, default=50)
    supplier_name = db.Column(db.String(150), nullable=True)
    supplier_email = db.Column(db.String(120), nullable=True)

    @property
    def price(self):
        return self.selling_price

    @price.setter
    def price(self, value):
        self.selling_price = value
