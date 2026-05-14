'''
import pickle
import pandas as pd

# Load model once
model = pickle.load(open("ml_models/xgb_pipeline.pkl", "rb"))

def predict_demand(data):
    df = pd.DataFrame([data])
    prediction = model.predict(df)
    return float(prediction[0])
    '''
import pickle
import pandas as pd
from ml_models.preprocess_utils import preprocess_date


# Load model once
model = pickle.load(open("ml_models/xgb_pipeline.pkl", "rb"))

def predict_demand(data):
    df = pd.DataFrame([data])

    df = preprocess_date(df)

    prediction = model.predict(df)
    return float(prediction[0])
