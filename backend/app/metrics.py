"""Performance metrics computed from synthetic predictions and confirmed labels."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
from scipy import stats

METRIC_DEFINITIONS = {
    "accuracy": "(TP + TN) / (TP + TN + FP + FN): share of all cases classified correctly.",
    "sensitivity": "TP / (TP + FN): share of confirmed positive cases the model flagged. Also called recall.",
    "specificity": "TN / (TN + FP): share of confirmed negative cases the model correctly cleared.",
    "precision": "TP / (TP + FP): share of flagged cases that were confirmed positive.",
    "fnr": "FN / (TP + FN): share of confirmed positive cases the model missed.",
    "fpr": "FP / (FP + TN): share of confirmed negative cases the model wrongly flagged.",
    "f1": "2 x precision x sensitivity / (precision + sensitivity): balance of precision and recall.",
    "calibration": "Do predicted scores match observed outcome rates? ECE is the average gap across score bins; Brier is the mean squared error of scores.",
}


def safe_div(a: float, b: float):
    """Return a / b, or None when the denominator is zero (shown as 'unavailable')."""
    return None if b == 0 else a / b


def confusion(df: pd.DataFrame) -> dict:
    y = df["outcome"].to_numpy().astype(bool)
    p = df["prediction"].to_numpy().astype(bool)
    return {
        "tp": int((y & p).sum()), "fp": int((~y & p).sum()),
        "tn": int((~y & ~p).sum()), "fn": int((y & ~p).sum()),
    }


def wilson(k: int, n: int, z: float = 1.96):
    if n == 0:
        return None
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return [max(0.0, centre - half), min(1.0, centre + half)]


def two_proportion_pvalue(k1: int, n1: int, k2: int, n2: int):
    """Two-sided pooled z-test for a difference between two proportions."""
    if n1 == 0 or n2 == 0:
        return None
    pooled = (k1 + k2) / (n1 + n2)
    se = math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
    if se == 0:
        return 1.0
    z = (k1 / n1 - k2 / n2) / se
    return float(2 * stats.norm.sf(abs(z)))


def calibration(df: pd.DataFrame, bins: int = 10):
    n = len(df)
    if n == 0:
        return None
    s = df["prediction_score"].to_numpy()
    y = df["outcome"].to_numpy()
    idx = np.minimum(np.digitize(s, np.linspace(0, 1, bins + 1)[1:-1]), bins - 1)
    out, ece = [], 0.0
    for b in range(bins):
        m = idx == b
        cnt = int(m.sum())
        lo, hi = b / bins, (b + 1) / bins
        if cnt == 0:
            out.append({"bin_low": lo, "bin_high": hi, "n": 0, "mean_predicted": None, "observed_rate": None})
            continue
        mp, ob = float(s[m].mean()), float(y[m].mean())
        ece += cnt / n * abs(mp - ob)
        out.append({"bin_low": lo, "bin_high": hi, "n": cnt, "mean_predicted": mp, "observed_rate": ob})
    return {"ece": float(ece), "brier": float(np.mean((s - y) ** 2)),
            "mean_predicted": float(s.mean()), "observed_rate": float(y.mean()), "bins": out}


def compute_metrics(df: pd.DataFrame, with_calibration: bool = True) -> dict:
    c = confusion(df)
    tp, fp, tn, fn = c["tp"], c["fp"], c["tn"], c["fn"]
    n = tp + fp + tn + fn
    sens = safe_div(tp, tp + fn)
    prec = safe_div(tp, tp + fp)
    f1 = None
    if sens is not None and prec is not None and (prec + sens) > 0:
        f1 = 2 * prec * sens / (prec + sens)
    return {
        "n": n, "positives": tp + fn, "negatives": tn + fp, **c,
        "prevalence": safe_div(tp + fn, n),
        "accuracy": safe_div(tp + tn, n),
        "sensitivity": sens,
        "specificity": safe_div(tn, tn + fp),
        "precision": prec,
        "fnr": safe_div(fn, tp + fn),
        "fpr": safe_div(fp, fp + tn),
        "f1": f1,
        "sensitivity_ci": wilson(tp, tp + fn),
        "specificity_ci": wilson(tn, tn + fp),
        "calibration": calibration(df) if with_calibration else None,
    }
