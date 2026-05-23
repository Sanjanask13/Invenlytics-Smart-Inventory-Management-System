import pickle
from pathlib import Path

import pandas as pd
import xgboost as xgb

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

try:
    from ml_models.preprocess_utils import preprocess_date
except ImportError:
    from preprocess_utils import preprocess_date


MODEL_PATH = Path(__file__).with_name("xgb_pipeline.pkl")
FEATURE_COLUMNS = [
    "Product ID",
    "Category",
    "Inventory Level",
    "Price",
    "Discount",
    "Date",
]


def _prepare_training_frame(df, target_column):
    required_columns = FEATURE_COLUMNS + [target_column]
    missing_columns = [column for column in required_columns if column not in df.columns]
    if missing_columns:
        raise ValueError(
            "Missing required training columns: " + ", ".join(sorted(missing_columns))
        )

    prepared = df[required_columns].copy()
    prepared[target_column] = pd.to_numeric(prepared[target_column], errors="coerce")
    prepared["Inventory Level"] = pd.to_numeric(prepared["Inventory Level"], errors="coerce")
    prepared["Price"] = pd.to_numeric(prepared["Price"], errors="coerce")
    prepared["Discount"] = pd.to_numeric(prepared["Discount"], errors="coerce")
    prepared = prepared.dropna(
        subset=[
            "Product ID",
            "Category",
            "Date",
            target_column,
            "Inventory Level",
            "Price",
            "Discount",
        ]
    )

    prepared = preprocess_date(prepared)
    prepared = prepared.dropna(subset=["Day", "Month", "Year"])
    prepared = prepared.sort_values(by=["Product ID", "Year", "Month", "Day"])

    # Use the previous observed demand value as a lag feature.
    prepared["Prev_Demand"] = prepared.groupby("Product ID")[target_column].shift(1)
    prepared = prepared.dropna()

    if len(prepared) < 2:
        raise ValueError(
            "Not enough historical rows to train the model after deriving previous-demand features"
        )

    return prepared


def _fit_pipeline(df, target_column):
    prepared = _prepare_training_frame(df, target_column)

    X = prepared.drop(columns=[target_column])
    y = prepared[target_column]

    categorical_cols = ["Product ID", "Category"]
    numeric_cols = [
        "Inventory Level",
        "Price",
        "Discount",
        "Day",
        "Month",
        "Year",
        "Prev_Demand",
    ]

    numeric_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="mean"))
    ])

    categorical_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore")),
    ])

    preprocessor = ColumnTransformer([
        ("categorical", categorical_transformer, categorical_cols),
        ("numeric", numeric_transformer, numeric_cols),
    ])

    model = xgb.XGBRegressor(
        objective="reg:squarederror",
        n_estimators=150,
        learning_rate=0.08,
        random_state=42,
    )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("model", model),
    ])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    mse = mean_squared_error(y_test, y_pred)
    rmse = mse ** 0.5
    r2 = r2_score(y_test, y_pred)

    with MODEL_PATH.open("wb") as file_obj:
        pickle.dump(pipeline, file_obj)

    print("===== XGBoost Evaluation =====")
    print("MAE:", mae)
    print("RMSE:", rmse)
    print("R2 Score:", r2)
    print("===============")
    print("\nModel trained and saved!")

    return {
        "rows_used": int(len(prepared)),
        "mae": float(mae),
        "rmse": float(rmse),
        "r2": float(r2),
        "model_path": str(MODEL_PATH),
    }


def train_pipeline(data_path, target_column="Demand Forecast"):
    df = pd.read_csv(data_path)
    return _fit_pipeline(df, target_column)


def train_pipeline_from_dataframe(df, target_column):
    return _fit_pipeline(df, target_column)


def predict_demand(data):
    with MODEL_PATH.open("rb") as file_obj:
        model = pickle.load(file_obj)

    df = pd.DataFrame([data])
    df = preprocess_date(df)
    prediction = model.predict(df)

    return float(prediction[0])


def test_prediction():
    sample_input = {
        "Date": "12/09/2022",
        "Product ID": "P0001",
        "Category": "Groceries",
        "Inventory Level": 231,
        "Price": 135.47,
        "Discount": 33.5,
        "Prev_Demand": 95,
    }

    result = predict_demand(sample_input)
    print("\nPredicted Demand:", result)


if __name__ == "__main__":
    train_pipeline("../../dataset/inventory_data.csv")
    test_prediction()
