"""Shared price-model pieces: area target encoding, features and model settings."""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

SMOOTH = 30  # target-encoding smoothing: areas with few sales are pulled towards the average
FEATURES = ["area_value", "area_type_value", "area_sales_log", "is_villa", "offplan", "bedrooms", "log_sqft"]
PARAMS = dict(max_iter=400, learning_rate=0.06, max_leaf_nodes=31, min_samples_leaf=40,
              l2_regularization=1.0, random_state=42)


def area_encoding(train: pd.DataFrame) -> dict:
    """Smoothed mean log price-per-sqft per area and per (area, type), learned from `train` only."""
    y = np.log(train.ppsf)
    t = train.assign(y=y)
    global_mean = y.mean()
    g = t.groupby("area").y.agg(["mean", "count"])
    area_value = (g["mean"] * g["count"] + global_mean * SMOOTH) / (g["count"] + SMOOTH)
    type_mean = t.groupby("type").y.mean()
    gt = t.groupby(["area", "type"]).y.agg(["mean", "count"])
    prior = np.array([type_mean[k] for k in gt.index.get_level_values("type")])
    area_type_value = (gt["mean"] * gt["count"] + prior * SMOOTH) / (gt["count"] + SMOOTH)
    return {"global": float(global_mean), "type_mean": type_mean.to_dict(), "area": area_value.to_dict(),
            "area_type": area_type_value.to_dict(), "sales": g["count"].to_dict()}


def features(d: pd.DataFrame, enc: dict) -> pd.DataFrame:
    X = pd.DataFrame(index=d.index)
    X["area_value"] = d.area.map(enc["area"]).fillna(enc["global"])
    X["area_type_value"] = [enc["area_type"].get(k, enc["type_mean"][k[1]]) for k in zip(d.area, d.type)]
    X["area_sales_log"] = np.log1p(d.area.map(enc["sales"]).fillna(0))
    X["is_villa"] = (d.type == "Villa").astype(int)
    X["offplan"] = d.offplan
    X["bedrooms"] = d.bedrooms
    X["log_sqft"] = np.log(d.sqft)
    return X[FEATURES]


def fit(train: pd.DataFrame):
    """Fit encoding + model on `train`; returns (encoding, model)."""
    enc = area_encoding(train)
    model = HistGradientBoostingRegressor(**PARAMS).fit(features(train, enc), np.log(train.ppsf))
    return enc, model


def predict_ppsf(enc: dict, model, d: pd.DataFrame) -> np.ndarray:
    return np.exp(model.predict(features(d, enc)))
