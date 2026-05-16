# Invenlytics

Invenlytics is a full-stack inventory intelligence platform for small retail stores. It combines inventory management, billing, sales tracking, demand prediction, reorder recommendations, market-basket insights, and a lightweight admin panel in a single project.

## What the project does

- Merchant registration and login with session-based access control
- Store-scoped product and inventory management
- Barcode-based billing flow
- Sales, bill history, and invoice retrieval
- Demand prediction using an XGBoost pipeline
- Reorder recommendations based on stock, thresholds, and predicted demand
- Business insights such as profit trends, slow-moving stock suggestions, and bundle recommendations using Apriori
- Supplier ordering workflow with SMTP email support or demo-mode simulation
- Admin login and merchant management dashboard

## Tech stack

### Frontend

- React 19
- React Router
- Axios
- Recharts
- CRA (`react-scripts`)

### Backend

- Flask
- Flask-CORS
- Flask-SQLAlchemy
- PostgreSQL
- bcrypt

### Machine learning

- pandas
- scikit-learn
- xgboost
- mlxtend

## Repository structure

```text
invenlytics/
|- backend/
|  |- app.py
|  |- config.py
|  |- database.py
|  |- models/
|  |- routes/
|  |- services/
|  `- ml_models/
|- frontend/
|  |- package.json
|  |- public/
|  `- src/
|- dataset/
`- README.md
```

## Architecture overview

### Frontend pages

- `WelcomePage`: landing page
- `Login` and `Register`: merchant auth
- `Dashboard`: profit, top products, and forecast summaries
- `Products`: add, edit, search, stock update, delete
- `BarcodeScanner`: barcode lookup, cart building, bill creation, invoice view
- `Predictions`: single-product prediction and model retraining
- `ReorderRecommendations`: reorder list and supplier ordering workflow
- `Discussion`: insight cards for pricing, demand, discount, and bundle suggestions
- `AdminLogin` and `AdminDashboard`: admin access and merchant management

### Backend modules

- `routes/auth_routes.py`: merchant register/login/session/logout
- `routes/product_routes.py`: product CRUD, product search, barcode lookup, stock updates
- `routes/sales_routes.py`: billing, bill history, invoice, sales creation
- `routes/prediction_routes.py`: product demand prediction and live retraining
- `routes/analytics_routes.py`: dashboard metrics, forecast summaries, reorder recommendations, insights
- `routes/order_routes.py`: supplier order send/cancel/list
- `routes/admin_routes.py`: admin auth, merchant list/detail/delete

### Data model highlights

- `Merchant` owns one or more `Store` records
- `Store` contains `Product` records
- `Inventory` stores stock snapshots and sales context over time
- `Sale`, `Bill`, and `BillItem` support transactional history
- `Prediction` stores forecast history
- `Order` stores supplier order activity

## Key product flows

### 1. Merchant onboarding

Merchant signs up, backend creates the merchant, and a default store is provisioned automatically.

### 2. Product and stock management

Merchant adds a product with pricing, threshold, supplier info, and opening stock. Inventory snapshots are used later for forecasting and analytics.

### 3. Barcode billing

Cashier scans a product barcode, adds items to a cart, creates a bill, and the system updates sales and inventory records.

### 4. Prediction and analytics

The app uses product, inventory, discount, and historical demand signals to estimate demand and highlight:

- understock risk
- overstock risk
- predicted profit
- reorder quantity
- discount opportunities
- market-basket combinations

### 5. Supplier ordering

Recommended items can be turned into supplier orders. If SMTP credentials are missing, the backend simulates email sending in demo mode instead of failing.

## Environment configuration

Backend reads configuration from environment variables in `backend/config.py`.

### Backend environment variables

```env
DATABASE_URL=postgresql://postgres:Database@localhost/invenlytics_db
SECRET_KEY=invenlytics-dev-secret
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@example.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=your-email@example.com
```

### Frontend runtime assumption

The frontend is currently hardcoded to call:

```text
http://localhost:5000
```

in `frontend/src/services/api.js`.

## Local setup

### 1. Clone and open the project

```bash
git clone <your-repo-url>
cd invenlytics
```

### 2. Create the PostgreSQL database

Create a database named `invenlytics_db` or point `DATABASE_URL` to an existing PostgreSQL database.

### 3. Set up the backend

Create and activate a virtual environment, then install the required packages.

Suggested package list based on current imports:

```bash
pip install flask flask-cors flask-sqlalchemy psycopg2-binary bcrypt pandas scikit-learn xgboost mlxtend
```

Run the backend:

```bash
cd backend
python app.py
```

The Flask API will start on `http://localhost:5000`.

### 4. Set up the frontend

```bash
cd frontend
npm install
npm start
```

The frontend will start on `http://localhost:3000`.

## Demo data

The repository includes:

- `dataset/inventory_data.csv`

## Main API endpoints

### Auth

- `POST /register`
- `POST /login`
- `GET /session`
- `POST /logout`

### Products and inventory

- `POST /add-product`
- `GET /products/<store_id>`
- `GET /products`
- `GET /search-product`
- `GET /product/<product_id>`
- `PUT /product/<product_id>`
- `POST /scan-barcode`
- `POST /update-stock`
- `DELETE /delete-product/<product_id>`

### Sales and billing

- `POST /create-bill`
- `POST /add-sale`
- `GET /billing`
- `GET /bill-history`
- `GET /sales-history`
- `GET /invoice/<bill_id>`

### Prediction and analytics

- `POST /predict-product`
- `POST /retrain-model`
- `GET /dashboard/<store_id>`
- `GET /predictions/<store_id>`
- `GET /insights/<store_id>`
- `GET /reorder-recommendations/<merchant_id>`

### Orders

- `POST /send-order`
- `POST /cancel-order`
- `GET /orders/<store_id>`

### Admin

- `POST /admin/login`
- `GET /admin/session`
- `POST /admin/logout`
- `GET /admin/users`
- `GET /admin/user/<id>`
- `DELETE /admin/user/<id>`
- `GET /admin/top-merchants`

## Current repo notes

- `backend/requriements.txt` exists but is empty and misspelled. Setup currently depends on manual package installation.
- The backend applies a few schema-fix helpers at startup for columns like `barcode`, supplier fields, pricing fields, and sales profit fields.
- Merchant auth is session-based on the backend, while the frontend also stores a lightweight token-like value in local storage for route protection.

## Good next improvements

- Add a proper `backend/requirements.txt`
- Add `.env.example` files for frontend and backend
- Replace hardcoded frontend API base URL with environment-based config
- Add database migrations with Alembic or Flask-Migrate
- Add automated tests for routes and forecasting flows
- Document default admin seed or create one if missing

## Summary

This project already covers a strong end-to-end retail workflow: onboarding, catalog management, billing, inventory history, ML-backed forecasting, reorder planning, supplier communication, and admin oversight. With a cleaned setup path and a small amount of documentation polish, it is very presentable as a portfolio or academic full-stack analytics project.
