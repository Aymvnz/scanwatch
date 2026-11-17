"""Statistical drift detection: KS test, PSI, chi-square, two-proportion tests and an
RBF-kernel MMD permutation test. Baseline bins are always taken from the reference data."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from .config import THRESHOLDS, Thresholds
from .synth import AGE_GROUPS, HOSPITALS, IMAGE_FEATURES, MISSING_COLS, SETTINGS

NUMERIC = [
    ("image_feature_1", "Image feature 1"), ("image_feature_2", "Image feature 2"),
    ("image_feature_3", "Image feature 3"), ("patient_age", "Patient age"),
    ("prediction_score", "Prediction score"), ("reporting_delay_days", "Reporting delay (days)"),
]
CATEGORICAL = [
    ("age_group", "Age group", AGE_GROUPS), ("clinical_setting", "Clinical setting", SETTINGS),
    ("hospital_id", "Hospital", HOSPITALS),
]
MISSING = [(c, f"Missing: image feature {k + 1}") for k, c in enumerate(MISSING_COLS)]
MMD_FEATURES = ["image_feature_1", "image_feature_2", "image_feature_3", "patient_age", "prediction_score"]


# ---------- PSI ----------
def psi_from_proportions(p: np.ndarray, q: np.ndarray, eps: float = 1e-4) -> float:
    p = np.maximum(np.asarray(p, float), eps)  # smoothing: empty bins get a small floor
    q = np.maximum(np.asarray(q, float), eps)
    return float(np.sum((q - p) * np.log(q / p)))


def psi_bin_edges(ref: np.ndarray, bins: int = 10) -> np.ndarray:
    """Interior bin edges from reference quantiles (applied unchanged to the current data)."""
    ref = ref[~np.isnan(ref)]
    return np.unique(np.quantile(ref, np.linspace(0, 1, bins + 1))[1:-1])


def _bin_props(x: np.ndarray, inner: np.ndarray) -> np.ndarray:
    idx = np.searchsorted(inner, x, side="right")
    return np.bincount(idx, minlength=len(inner) + 1) / max(len(x), 1)


def psi_numeric(ref, cur, bins: int = 10, eps: float = 1e-4):
    ref = np.asarray(ref, float); cur = np.asarray(cur, float)
    ref = ref[~np.isnan(ref)]; cur = cur[~np.isnan(cur)]
    if len(ref) == 0 or len(cur) == 0:
        return None
    inner = psi_bin_edges(ref, bins)
    return psi_from_proportions(_bin_props(ref, inner), _bin_props(cur, inner), eps)


def psi_categorical(ref: pd.Series, cur: pd.Series, categories, eps: float = 1e-4):
    if len(ref) == 0 or len(cur) == 0:
        return None
    p = np.array([(ref == c).mean() for c in categories])
    q = np.array([(cur == c).mean() for c in categories])
    return psi_from_proportions(p, q, eps)


def psi_level(psi):
    if psi is None:
        return "unavailable"
    return "significant" if psi >= THRESHOLDS.psi_significant else "moderate" if psi >= THRESHOLDS.psi_moderate else "none"


# ---------- MMD ----------
def mmd_rbf(ref_X: np.ndarray, cur_X: np.ndarray, n_sub: int = 300, n_perm: int = 200, seed: int = 0) -> dict:
    """Unbiased MMD^2 with an RBF kernel (median-heuristic bandwidth) and a permutation p-value.
    Columns are standardised with the reference mean/SD; rows with missing values are dropped."""
    rng = np.random.default_rng(seed)
    ref_X = ref_X[~np.isnan(ref_X).any(axis=1)]
    cur_X = cur_X[~np.isnan(cur_X).any(axis=1)]
    if len(ref_X) < 10 or len(cur_X) < 10:
        return {"available": False, "reason": "Too few complete rows for MMD."}
    mu, sd = ref_X.mean(0), ref_X.std(0)
    sd[sd == 0] = 1.0
    X = (ref_X - mu) / sd; Y = (cur_X - mu) / sd
    X = X[rng.choice(len(X), min(n_sub, len(X)), replace=False)]
    Y = Y[rng.choice(len(Y), min(n_sub, len(Y)), replace=False)]
    n, m = len(X), len(Y)
    Z = np.vstack([X, Y])
    sq = ((Z[:, None, :] - Z[None, :, :]) ** 2).sum(-1)
    med = np.median(sq[np.triu_indices_from(sq, k=1)])
    gamma = 1.0 / (2 * med) if med > 0 else 1.0
    K = np.exp(-gamma * sq)

    def mmd2(Km, n=n, m=m):
        Kxx, Kyy, Kxy = Km[:n, :n], Km[n:, n:], Km[:n, n:]
        return ((Kxx.sum() - np.trace(Kxx)) / (n * (n - 1))
                + (Kyy.sum() - np.trace(Kyy)) / (m * (m - 1)) - 2 * Kxy.mean())

    obs = float(mmd2(K))
    count = 0
    for _ in range(n_perm):
        perm = rng.permutation(n + m)
        if mmd2(K[np.ix_(perm, perm)]) >= obs:
            count += 1
    p = (1 + count) / (1 + n_perm)
    return {"available": True, "statistic": obs, "p_value": float(p), "n_reference": int(n), "n_current": int(m),
            "n_permutations": n_perm, "features": MMD_FEATURES, "bandwidth_gamma": float(gamma)}


# ---------- histograms ----------
def _numeric_histogram(ref: np.ndarray, cur: np.ndarray, bins: int = 24):
    ref = ref[~np.isnan(ref)]; cur = cur[~np.isnan(cur)]
    if len(ref) == 0 or len(cur) == 0:
        return []
    both = np.concatenate([ref, cur])
    uniq = np.unique(both)
    if len(uniq) <= 20:  # discrete variable: one bar per value
        return [{"x": str(int(v)) if float(v).is_integer() else f"{v:.2f}",
                 "baseline": float((ref == v).mean()), "current": float((cur == v).mean())} for v in uniq]
    lo, hi = np.percentile(both, [0.5, 99.5])
    edges = np.linspace(lo, hi, bins + 1)
    rc = np.histogram(np.clip(ref, lo, hi), edges)[0] / len(ref)
    cc = np.histogram(np.clip(cur, lo, hi), edges)[0] / len(cur)
    centers = (edges[:-1] + edges[1:]) / 2
    fmt = (lambda v: f"{v:.0f}") if hi - lo > 20 else (lambda v: f"{v:.2f}")
    return [{"x": fmt(c), "baseline": float(a), "current": float(b)} for c, a, b in zip(centers, rc, cc)]


# ---------- main entry ----------
def compute_drift(ref: pd.DataFrame, cur: pd.DataFrame, th: Thresholds = THRESHOLDS,
                  seed: int = 0, n_perm: int = 200) -> dict:
    feats: list[dict] = []
    for col, label in NUMERIC:
        a = ref[col].to_numpy(float); b = cur[col].to_numpy(float)
        a2, b2 = a[~np.isnan(a)], b[~np.isnan(b)]
        ks = stats.ks_2samp(a2, b2) if len(a2) and len(b2) else None
        feats.append({
            "feature": col, "label": label, "kind": "numeric", "test": "Kolmogorov–Smirnov",
            "statistic": float(ks.statistic) if ks else None, "p_value": float(ks.pvalue) if ks else None,
            "psi": psi_numeric(a, b), "n_reference": int(len(a2)), "n_current": int(len(b2)),
            "reference_value": float(a2.mean()) if len(a2) else None,
            "current_value": float(b2.mean()) if len(b2) else None, "value_label": "mean",
            "histogram": _numeric_histogram(a, b),
        })
    for col, label, cats in CATEGORICAL:
        table = np.array([[int((ref[col] == c).sum()), int((cur[col] == c).sum())] for c in cats])
        table = table[table.sum(axis=1) > 0]
        p = chi = None
        if table.shape[0] >= 2 and table.sum(axis=0).min() > 0:
            chi, p, *_ = stats.chi2_contingency(table)
        feats.append({
            "feature": col, "label": label, "kind": "categorical", "test": "Chi-square",
            "statistic": float(chi) if chi is not None else None, "p_value": float(p) if p is not None else None,
            "psi": psi_categorical(ref[col], cur[col], cats), "n_reference": len(ref), "n_current": len(cur),
            "reference_value": None, "current_value": None, "value_label": None,
            "histogram": [{"x": c, "baseline": float((ref[col] == c).mean()), "current": float((cur[col] == c).mean())} for c in cats],
        })
    for col, label in MISSING:
        k1, k2 = int(ref[col].sum()), int(cur[col].sum())
        n1, n2 = len(ref), len(cur)
        table = np.array([[k1, n1 - k1], [k2, n2 - k2]])
        chi = p = None
        if table.sum(axis=0).min() > 0:
            chi, p, *_ = stats.chi2_contingency(table, correction=False)
        feats.append({
            "feature": col, "label": label, "kind": "missingness", "test": "Two-proportion (chi-square)",
            "statistic": float(chi) if chi is not None else None, "p_value": float(p) if p is not None else None,
            "psi": psi_from_proportions(np.array([1 - k1 / n1, k1 / n1]), np.array([1 - k2 / n2, k2 / n2])),
            "n_reference": n1, "n_current": n2,
            "reference_value": k1 / n1, "current_value": k2 / n2, "value_label": "missing rate",
            "histogram": [{"x": "Present", "baseline": 1 - k1 / n1, "current": 1 - k2 / n2},
                          {"x": "Missing", "baseline": k1 / n1, "current": k2 / n2}],
        })

    m = len(feats)
    alpha_adj = th.alpha / m
    for f in feats:
        p = f["p_value"]
        f["p_adjusted"] = None if p is None else float(min(1.0, p * m))
        sig = f["p_adjusted"] is not None and f["p_adjusted"] < th.alpha
        if f["kind"] == "missingness":
            delta = (f["current_value"] or 0) - (f["reference_value"] or 0)
            f["drifted"] = bool(sig and abs(delta) >= th.min_missing_shift)
        else:
            f["drifted"] = bool(sig and f["psi"] is not None and f["psi"] >= th.psi_moderate)
        f["psi_level"] = psi_level(f["psi"])
        f["severity"] = f["psi_level"] if f["drifted"] else "none"

    drifted = [f for f in feats if f["drifted"]]
    top = max((f for f in feats if f["psi"] is not None), key=lambda f: f["psi"], default=None)
    share = len(drifted) / m
    overall = {
        "n_features_tested": m, "n_drifted": len(drifted), "share_drifted": share,
        "max_psi": top["psi"] if top else None, "max_psi_feature": top["label"] if top else None,
        "alpha": th.alpha, "alpha_adjusted": alpha_adj,
        "verdict": "none" if not drifted else ("widespread" if share >= th.drift_share_critical else "limited"),
        "n_reference": len(ref), "n_current": len(cur),
    }
    X = lambda d: d[MMD_FEATURES].to_numpy(float)
    return {"overall": overall, "features": feats, "mmd": mmd_rbf(X(ref), X(cur), seed=seed, n_perm=n_perm)}


def mean_psi_weekly(ref: pd.DataFrame, cur: pd.DataFrame, cols=MMD_FEATURES) -> float | None:
    vals = [psi_numeric(ref[c].to_numpy(float), cur[c].to_numpy(float)) for c in cols]
    vals = [v for v in vals if v is not None]
    return float(np.mean(vals)) if vals else None
