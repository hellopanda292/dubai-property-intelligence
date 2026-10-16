"""Five data questions about Dubai's 2026 market, answered with like-for-like comparisons.

The main tool is a *fixed-effects* regression: every home is compared only with homes of the
same area, type and bedroom count, so differences between neighbourhoods can't distort the
answer. Implementation: subtract each group's mean ("within transformation"), then ordinary
least squares. By the Frisch–Waugh–Lovell theorem this gives exactly the same coefficients as
adding one dummy variable per group, without building a huge matrix.
"""
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

from model import fit, predict_ppsf

MIN_PROJECT_SALES = 30


def r(x, nd=3):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), nd)


def within_ols(d: pd.DataFrame, y: pd.Series, X: pd.DataFrame, groups: pd.Series) -> pd.Series:
    """OLS of y on X with one fixed effect per group (within transformation)."""
    yd = y - y.groupby(groups).transform("mean")
    Xd = X - X.groupby(groups).transform("mean")
    keep = Xd.abs().sum(axis=1) >= 0  # all rows; groups of one row simply contribute zeros
    coef, *_ = np.linalg.lstsq(Xd[keep].to_numpy(float), yd[keep].to_numpy(float), rcond=None)
    return pd.Series(coef, index=X.columns)


def design(d: pd.DataFrame, with_months=True) -> pd.DataFrame:
    X = pd.DataFrame({"offplan": d.offplan.astype(float), "log_sqft": np.log(d.sqft)}, index=d.index)
    if with_months:
        months = pd.get_dummies(d.month, prefix="m", dtype=float)
        X = pd.concat([X, months.iloc[:, 1:]], axis=1)  # first month is the baseline
    return X


def group_key(d: pd.DataFrame) -> pd.Series:
    return d.area + "|" + d.type + "|" + d.bedrooms.astype(str)


# ---------------------------------------------------------------------------
# 1. Projects selling above / below similar homes
# ---------------------------------------------------------------------------

def project_value(sales: pd.DataFrame) -> dict:
    """Out-of-sample model predictions, grouped by project, so a project is never in its own training set."""
    d = sales.reset_index(drop=True)
    groups = d.project.fillna(pd.Series([f"_row{i}" for i in d.index], index=d.index))
    pred = np.empty(len(d))
    for train_idx, test_idx in GroupKFold(n_splits=5).split(d, groups=groups):
        enc, model = fit(d.iloc[train_idx])
        pred[test_idx] = predict_ppsf(enc, model, d.iloc[test_idx])
    d["resid"] = np.log(d.ppsf / pred)

    rows = []
    for name, g in d.dropna(subset=["project"]).groupby("project"):
        if len(g) < MIN_PROJECT_SALES:
            continue
        rows.append({"project": name, "area": g.area.mode().iat[0], "type": g.type.mode().iat[0], "sales": int(len(g)),
                     "premium": r(np.exp(g.resid.median()) - 1), "median_ppsf": int(round(g.ppsf.median())),
                     "median_price": int(round(g.price.median())), "offplan_share": r(g.offplan.mean(), 2)})
    rows.sort(key=lambda x: x["premium"])
    prem = np.array([x["premium"] for x in rows])
    return {
        "projects_scored": len(rows),
        "within_10": r((np.abs(prem) <= 0.10).mean()),
        "below": rows[:10],
        "above": rows[::-1][:10],
        "cv_median_error": r(np.median(np.abs(np.exp(-d.resid) - 1)), 4),
    }


# ---------------------------------------------------------------------------
# 2–4. Off-plan premium, size discount, like-for-like price index
# ---------------------------------------------------------------------------

def fixed_effect_models(sales: pd.DataFrame) -> dict:
    out = {}
    months = sorted(sales.month.unique())
    for t, d in sales.groupby("type"):
        X = design(d)
        coef = within_ols(d, np.log(d.ppsf), X, group_key(d))
        index = [1.0] + [float(np.exp(coef.get(f"m_{m}", 0.0))) for m in months[1:]]
        raw = d.groupby("month").ppsf.median().reindex(months)
        out[t] = {
            "offplan_premium": r(np.exp(coef["offplan"]) - 1),
            "size_elasticity": r(coef["log_sqft"]),       # d log(ppsf) / d log(size)
            "ppsf_change_10pct_bigger": r(1.1 ** coef["log_sqft"] - 1),
            "index": [{"month": m, "like_for_like": r(i, 4), "raw_median": r(raw[m] / raw[months[0]], 4)}
                      for m, i in zip(months, index)],
            "sales": int(len(d)),
        }
    return out


def offplan_by_area(sales: pd.DataFrame, top_n=12) -> list:
    """Per area: compare off-plan and ready sales within the same type + bedroom count."""
    rows = []
    for area, a in sales.groupby("area"):
        logs, weights = [], []
        for _, cell in a.groupby(["type", "bedrooms"]):
            op, rd = cell[cell.offplan == 1].ppsf, cell[cell.offplan == 0].ppsf
            if len(op) >= 15 and len(rd) >= 15:
                logs.append(np.log(op.median() / rd.median()))
                weights.append(min(len(op), len(rd)))
        if sum(weights) >= 60:
            rows.append({"area": area, "premium": r(np.exp(np.average(logs, weights=weights)) - 1),
                         "compared": int(sum(weights)), "sales": int(len(a))})
    rows.sort(key=lambda x: -x["sales"])
    return rows[:top_n]


# ---------------------------------------------------------------------------
# 5. Bedrooms: price per sq ft relative to a 1-bedroom in the same area
# ---------------------------------------------------------------------------

def bedroom_ppsf(sales: pd.DataFrame) -> list:
    flats = sales[sales.type == "Flat"]
    med = flats.groupby(["area", "bedrooms"]).ppsf.agg(["median", "count"]).reset_index()
    one = med[(med.bedrooms == 1) & (med["count"] >= 20)].set_index("area")["median"]
    out = []
    for b in [0, 1, 2, 3, 4]:
        m = med[(med.bedrooms == b) & (med["count"] >= 20) & med.area.isin(one.index)]
        if m.empty:
            continue
        ratios = m["median"].to_numpy() / one.loc[m.area].to_numpy()
        out.append({"bedrooms": b, "relative_ppsf": r(np.average(ratios, weights=m["count"])), "areas": int(len(m))})
    return out


def area_changes(sales: pd.DataFrame, top_n=12) -> list:
    """Raw median change vs like-for-like change (Q1 → latest full quarter) in the busiest areas."""
    q = sales.date.dt.quarter
    last = 3 if sales.date.max().month < 12 else 4
    rows = []
    for area, a in sales.groupby("area"):
        qa = q.loc[a.index]
        a = a[qa.isin([1, last])].assign(late=(qa[qa.isin([1, last])] == last).astype(float))
        if (a.late == 1).sum() < 150 or (a.late == 0).sum() < 150:
            continue
        X = pd.DataFrame({"late": a.late, "offplan": a.offplan.astype(float), "log_sqft": np.log(a.sqft)}, index=a.index)
        coef = within_ols(a, np.log(a.ppsf), X, a.type + "|" + a.bedrooms.astype(str))
        raw = a[a.late == 1].ppsf.median() / a[a.late == 0].ppsf.median() - 1
        rows.append({"area": area, "sales": int(len(a)), "raw_change": r(raw), "like_for_like": r(np.exp(coef["late"]) - 1)})
    rows.sort(key=lambda x: -x["sales"])
    return rows[:top_n]


def build_insights(sales: pd.DataFrame) -> dict:
    return {
        "value": project_value(sales),
        "models": fixed_effect_models(sales),
        "offplan_areas": offplan_by_area(sales),
        "bedrooms": bedroom_ppsf(sales),
        "area_changes": area_changes(sales),
    }
