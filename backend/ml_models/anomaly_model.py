import pickle
from pathlib import Path

import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


MODEL_PATH = Path(__file__).with_name("anomaly_model.pkl")


def train_anomaly_model(data_path):
    df = pd.read_csv(data_path)
    df = df[[
        "Inventory Level",
        "Price",
        "Discount",
        "Units Sold",
    ]]
    df = df.dropna()

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df)

    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42,
    )
    model.fit(X_scaled)

    with MODEL_PATH.open("wb") as file_obj:
        pickle.dump((model, scaler), file_obj)

    print("Anomaly model trained and saved!")


def detect_anomaly(data):
    with MODEL_PATH.open("rb") as file_obj:
        model, scaler = pickle.load(file_obj)

    df = pd.DataFrame([data])
    X_scaled = scaler.transform(df)
    result = model.predict(X_scaled)

    if result[0] == -1:
        return "Anomaly Detected"
    return "Normal"


def test_anomaly():
    sample_normal = {
        "Inventory Level": 200,
        "Price": 120,
        "Discount": 10,
        "Units Sold": 20,
    }

    sample_anomaly = {
        "Inventory Level": 5,
        "Price": 5000,
        "Discount": 90,
        "Units Sold": 200,
    }

    print("\nNormal Test:", detect_anomaly(sample_normal))
    print("Anomaly Test:", detect_anomaly(sample_anomaly))


if __name__ == "__main__":
    train_anomaly_model("../../dataset/inventory_data.csv")
    test_anomaly()
