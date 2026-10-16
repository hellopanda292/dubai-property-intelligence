"""Cleaning rules for Dubai Land Department (DLD) open data.

Every rule is explicit so the numbers on the website can be traced back to the raw CSVs.
"""
import re
from pathlib import Path

import numpy as np
import pandas as pd

SQM_TO_SQFT = 10.7639
SALE_PROCEDURES = {"Sell - Pre registration", "Sale", "Delayed Sell", "Sale On Payment Plan"}
ROMAN = {"I", "II", "III", "IV", "V", "VI"}
ACRONYMS = {"DMCC", "JLT", "JVC", "JVT", "DIFC", "DIP", "IMPZ", "MBR", "EZ"}
SMALL_WORDS = {"of", "and", "the"}


def tidy_area(name) -> str:
    """DLD mixes 'BUSINESS BAY' and 'Business Bay'; make every area name Title Case."""
    words = re.split(r"(\s+|-)", str(name).strip())
    out = []
    for w in words:
        if w.upper() in ROMAN or w.upper() in ACRONYMS or (any(c.isdigit() for c in w) and w.isalnum() and not w.isdigit()):
            out.append(w.upper())
        elif w.lower() in SMALL_WORDS and out:
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:].lower())
    return "".join(out)


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def bedrooms(value):
    if value == "Studio":
        return 0
    m = re.match(r"(\d+)\s*B/R", str(value))
    return int(m.group(1)) if m else np.nan


def tidy_place(value):
    """Metro, mall, landmark and project names: drop blanks, and fix names written in ALL CAPS."""
    if pd.isna(value) or not str(value).strip():
        return None
    value = str(value).strip()
    return tidy_area(value) if value.isupper() else value


def load_csvs(folder: Path, prefix: str, key: str) -> pd.DataFrame:
    files = sorted(folder.glob(f"{prefix}*.csv"))
    if not files:
        raise FileNotFoundError(f"No {prefix}*.csv files in {folder}")
    df = pd.concat([pd.read_csv(f, low_memory=False) for f in files], ignore_index=True)
    return df.drop_duplicates(key) if key in df.columns else df.drop_duplicates()


def clean_sales(raw: pd.DataFrame) -> tuple[pd.DataFrame, list]:
    """Residential flat and villa sales. Returns the clean frame and the cleaning log."""
    df = raw.copy()
    df["type"] = np.select(
        [(df.PROP_TYPE_EN == "Unit") & (df.PROP_SB_TYPE_EN == "Flat"),
         (df.PROP_TYPE_EN == "Building") & (df.PROP_SB_TYPE_EN == "Villa")],
        ["Flat", "Villa"], default="other")
    log = [("All sales transactions", len(df))]

    df = df[(df.type != "other") & (df.USAGE_EN == "Residential")]
    log.append(("Residential flats and villas", len(df)))
    df = df[df.PROCEDURE_EN.isin(SALE_PROCEDURES)]
    log.append(("Real sale procedures", len(df)))

    df["date"] = pd.to_datetime(df.INSTANCE_DATE)
    df["month"] = df.date.dt.to_period("M").astype(str)
    df["area"] = df.AREA_EN.map(tidy_area)
    df["bedrooms"] = df.ROOMS_EN.map(bedrooms)
    df["sqft"] = df.ACTUAL_AREA * SQM_TO_SQFT
    df["price"] = df.TRANS_VALUE
    df["offplan"] = (df.IS_OFFPLAN_EN == "Off-Plan").astype(int)
    df["metro"] = df.NEAREST_METRO_EN.map(tidy_place)
    df["mall"] = df.NEAREST_MALL_EN.map(tidy_place)
    df["landmark"] = df.NEAREST_LANDMARK_EN.map(tidy_place)
    df["project"] = df.PROJECT_EN.map(tidy_place)
    df = df.dropna(subset=["bedrooms", "sqft", "price"])
    log.append(("Bedrooms known", len(df)))

    size_ok = ((df.type == "Flat") & df.sqft.between(200, 6000)) | ((df.type == "Villa") & df.sqft.between(700, 20000))
    df = df[size_ok & (df.price >= 100_000)]
    log.append(("Realistic size and price", len(df)))

    df["ppsf"] = df.price / df.sqft
    lo = df.groupby("type").ppsf.transform(lambda s: s.quantile(0.005))
    hi = df.groupby("type").ppsf.transform(lambda s: s.quantile(0.995))
    df = df[df.ppsf.between(lo, hi)].reset_index(drop=True)
    log.append(("Without extreme price per sq ft", len(df)))
    df["bedrooms"] = df.bedrooms.astype(int)
    return df, log
