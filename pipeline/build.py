"""Builds every data file the website needs from the raw DLD CSVs in data/raw/.

    python pipeline/build.py

Outputs
  src/data/generated/market.json   city-wide numbers and charts
  src/data/generated/areas.json    one entry per area (stats, bedrooms, trend, projects, places)
  src/data/generated/meta.json     data period, cleaning log, model accuracy
  public/model.json                the price model (decision trees) used by the estimator
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

sys.path.insert(0, str(Path(__file__).parent))
from clean import clean_sales, load_csvs, slugify  # noqa: E402
from model import FEATURES, PARAMS, area_encoding, features  # noqa: E402
from insights import build_insights  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "src" / "data" / "generated"
PUBLIC = ROOT / "public"
OUT.mkdir(parents=True, exist_ok=True)

MIN_AREA_SALES = 20      # areas with fewer sales are not given their own page
MIN_GROUP_SALES = 5      # smallest group shown in a bedroom table


def r(x, nd=0):
    """Round for JSON (and turn numpy numbers into plain Python numbers)."""
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return round(float(x), nd) if nd else int(round(float(x)))


def most_common(series: pd.Series):
    s = series.dropna()
    if s.empty:
        return None
    counts = s.value_counts()
    return {"name": counts.index[0], "share": r(counts.iloc[0] / len(series), 3)}


# ----------------------------------------------------------------------------
# Market and area statistics
# ----------------------------------------------------------------------------

def quarter_change(g: pd.DataFrame):
    """Median price per sq ft in the latest full quarter vs the first quarter of the year."""
    q = g.date.dt.quarter
    last_full = 3 if g.date.max().month < 12 else 4
    a, b = g[q == 1].ppsf, g[q == last_full].ppsf
    if len(a) < 30 or len(b) < 30:
        return None
    return r(b.median() / a.median() - 1, 3)


def bedroom_rows(g: pd.DataFrame):
    rows = []
    for (t, b), gb in g.groupby(["type", "bedrooms"]):
        if len(gb) < MIN_GROUP_SALES:
            continue
        rows.append({"type": t, "bedrooms": int(b), "sales": int(len(gb)),
                     "median_price": r(gb.price.median()), "p25_price": r(gb.price.quantile(0.25)),
                     "p75_price": r(gb.price.quantile(0.75)), "median_ppsf": r(gb.ppsf.median()),
                     "median_sqft": r(gb.sqft.median())})
    return rows


def build_areas(sales: pd.DataFrame):
    areas = []
    for name, g in sales.groupby("area"):
        if len(g) < MIN_AREA_SALES:
            continue
        types = {t: {"sales": int(len(gt)), "median_price": r(gt.price.median()), "median_ppsf": r(gt.ppsf.median()),
                     "median_sqft": r(gt.sqft.median())} for t, gt in g.groupby("type")}
        monthly = [{"month": m, "sales": int(len(gm)), "median_ppsf": r(gm.ppsf.median())}
                   for m, gm in g.groupby("month")]
        projects = (g.dropna(subset=["project"]).groupby("project")
                    .agg(sales=("price", "size"), median_ppsf=("ppsf", "median"), median_price=("price", "median"),
                         offplan=("offplan", "mean")).sort_values("sales", ascending=False).head(8))
        areas.append({
            "slug": slugify(name), "name": name, "sales": int(len(g)), "total_value": r(g.price.sum()),
            "median_price": r(g.price.median()), "median_ppsf": r(g.ppsf.median()),
            "offplan_share": r(g.offplan.mean(), 3), "villa_share": r((g.type == "Villa").mean(), 3),
            "ppsf_change": quarter_change(g),
            "types": types, "bedrooms": bedroom_rows(g), "monthly": monthly,
            "projects": [{"name": p, "sales": int(row.sales), "median_ppsf": r(row.median_ppsf),
                          "median_price": r(row.median_price), "offplan_share": r(row.offplan, 2)}
                         for p, row in projects.iterrows()],
            "metro": most_common(g.metro), "mall": most_common(g.mall), "landmark": most_common(g.landmark),
        })
    areas.sort(key=lambda a: -a["sales"])
    return areas


def build_market(sales: pd.DataFrame, areas: list):
    monthly = []
    for m, gm in sales.groupby("month"):
        row = {"month": m, "sales": int(len(gm)), "value": r(gm.price.sum())}
        for t, gt in gm.groupby("type"):
            row[t.lower() + "_sales"] = int(len(gt))
            row[t.lower() + "_ppsf"] = r(gt.ppsf.median())
        monthly.append(row)
    big = [a for a in areas if a["sales"] >= 300]
    pick = lambda key, rev, n=10: [{"slug": a["slug"], "name": a["name"], key: a[key], "sales": a["sales"]}
                                   for a in sorted([a for a in big if a[key] is not None], key=lambda a: a[key], reverse=rev)[:n]]
    return {
        "sales": int(len(sales)), "total_value": r(sales.price.sum()), "median_price": r(sales.price.median()),
        "median_ppsf": r(sales.ppsf.median()), "offplan_share": r(sales.offplan.mean(), 3),
        "areas": len(areas),
        "by_type": {t: {"sales": int(len(g)), "median_price": r(g.price.median()), "median_ppsf": r(g.ppsf.median())}
                    for t, g in sales.groupby("type")},
        "bedrooms": [{"type": t, "bedrooms": int(b), "sales": int(len(g)), "median_price": r(g.price.median())}
                     for (t, b), g in sales.groupby(["type", "bedrooms"]) if len(g) >= 50],
        "monthly": monthly,
        "top": {"busiest": pick("sales", True), "expensive": pick("median_ppsf", True),
                "affordable": pick("median_ppsf", False), "rising": pick("ppsf_change", True, 8)},
    }


# ----------------------------------------------------------------------------
# Price model (same approach as the Dubai Property Price Estimator project)
# ----------------------------------------------------------------------------

def evaluate(pred_price, actual):
    err = np.abs(pred_price - actual) / actual
    return {"median_error": r(np.median(err), 4), "within_10": r((err <= 0.10).mean(), 3),
            "within_20": r((err <= 0.20).mean(), 3)}


def build_model(sales: pd.DataFrame):
    months = sorted(sales.month.unique())
    test_months = months[-2:]                     # the two most recent months are the test set
    train, test = sales[~sales.month.isin(test_months)], sales[sales.month.isin(test_months)]
    params = PARAMS

    enc = area_encoding(train)
    model = HistGradientBoostingRegressor(**params).fit(features(train, enc), np.log(train.ppsf))
    pred = np.exp(model.predict(features(test, enc))) * test.sqft
    base = train.groupby(["area", "type"]).ppsf.median()
    type_ppsf = train.groupby("type").ppsf.median()
    base_pred = np.array([base.get(k, type_ppsf[k[1]]) for k in zip(test.area, test.type)]) * test.sqft
    log_ratio = np.log(test.price.values / pred.values)
    metrics = {"train_months": [months[0], months[-3]], "test_months": test_months,
               "train_sales": int(len(train)), "test_sales": int(len(test)),
               "model": evaluate(pred.values, test.price.values), "baseline": evaluate(base_pred, test.price.values),
               "band": {"low": float(np.exp(np.quantile(log_ratio, 0.10))), "high": float(np.exp(np.quantile(log_ratio, 0.90)))}}

    enc_all = area_encoding(sales)
    final = HistGradientBoostingRegressor(**params).fit(features(sales, enc_all), np.log(sales.ppsf))
    trees = []
    for (p,) in final._predictors:
        n = p.nodes
        trees.append({"f": n["feature_idx"].tolist(), "t": [float(v) for v in n["num_threshold"]],
                      "l": n["left"].tolist(), "r": n["right"].tolist(), "v": [float(v) for v in n["value"]],
                      "leaf": n["is_leaf"].astype(int).tolist()})
    encodings = {area: {"value": enc_all["area"][area], "sales_log": float(np.log1p(enc_all["sales"][area])),
                        "types": {t: enc_all["area_type"][(area, t)] for t in ("Flat", "Villa") if (area, t) in enc_all["area_type"]}}
                 for area in enc_all["area"]}
    model_json = {"features": FEATURES, "baseline": float(np.ravel(final._baseline_prediction)[0]), "trees": trees,
                  "band": metrics["band"], "type_value": enc_all["type_mean"], "global_value": enc_all["global"],
                  "areas": encodings}

    # Check the exported trees give exactly the same answers as scikit-learn.
    check = features(sales.sample(300, random_state=1), enc_all)
    walked = []
    for row in check.values:
        total = model_json["baseline"]
        for tr in trees:
            i = 0
            while not tr["leaf"][i]:
                i = tr["l"][i] if row[tr["f"][i]] <= tr["t"][i] else tr["r"][i]
            total += tr["v"][i]
        walked.append(total)
    assert np.abs(np.array(walked) - final.predict(check)).max() < 1e-9, "exported trees disagree with scikit-learn"
    return model_json, metrics


# ----------------------------------------------------------------------------

def main():
    raw_sales = load_csvs(RAW, "transactions", "TRANSACTION_NUMBER")
    sales, log = clean_sales(raw_sales)
    areas = build_areas(sales)
    market = build_market(sales, areas)
    model_json, metrics = build_model(sales)
    insights = build_insights(sales)

    meta = {"period": {"from": sales.date.min().strftime("%Y-%m-%d"), "to": sales.date.max().strftime("%Y-%m-%d")},
            "cleaning": {"sales": [{"step": s, "rows": n} for s, n in log]}, "model": metrics,
            "source": "Dubai Land Department, Real Estate Data (open data)"}

    (OUT / "market.json").write_text(json.dumps(market, indent=1))
    (OUT / "areas.json").write_text(json.dumps(areas, ensure_ascii=False, separators=(",", ":")))
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    (OUT / "insights.json").write_text(json.dumps(insights, ensure_ascii=False, indent=1))
    (PUBLIC / "model.json").write_text(json.dumps(model_json, separators=(",", ":")))

    print(f"Clean sales: {len(sales):,} · areas with pages: {len(areas)} · period {meta['period']}")
    print("Model:", metrics["model"], "| Baseline:", metrics["baseline"])
    for f in ["market.json", "areas.json", "meta.json", "insights.json"]:
        print(f"  {f}: {(OUT / f).stat().st_size / 1e3:.0f} KB")
    print(f"  model.json: {(PUBLIC / 'model.json').stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
