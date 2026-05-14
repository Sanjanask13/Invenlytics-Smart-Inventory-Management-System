import pandas as pd

def preprocess_date(df):
    df = df.copy()

    df['Date'] = pd.to_datetime(df['Date'], dayfirst=True, errors='coerce')

    df['Day'] = df['Date'].dt.day
    df['Month'] = df['Date'].dt.month
    df['Year'] = df['Date'].dt.year

    df = df.drop(columns=['Date'])

    return df