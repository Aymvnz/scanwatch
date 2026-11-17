"""Patient subgroup analysis on synthetic data. Differences are statistical observations
only; they do not establish biological causes or discrimination."""
from __future__ import annotations

import pandas as pd

from .config import THRESHOLDS
from .metrics import compute_metrics
from .synth import AGE_GROUPS, SETTINGS

SUBGROUPS = [("age_group", g) for g in AGE_GROUPS] + [("clinical_setting", s) for s in SETTINGS]
SUBGROUP_LABELS = {("age_group", "Under 40"): "Under 40", ("age_group", "40–59"): "40–59",
                   ("age_group", "60 and older"): "60 and older"}


def subgroup_metrics(df: pd.DataFrame) -> list[dict]:
    out = []
    for col, val in SUBGROUPS:
        sub = df[df[col] == val]
        m = compute_metrics(sub, with_calibration=False)
        low = m["positives"] < THRESHOLDS.min_positives or m["negatives"] < THRESHOLDS.min_negatives or m["n"] < THRESHOLDS.min_subgroup_n
        reasons = []
        if m["positives"] < THRESHOLDS.min_positives:
            reasons.append(f"only {m['positives']} confirmed positive cases (minimum {THRESHOLDS.min_positives})")
        if m["negatives"] < THRESHOLDS.min_negatives:
            reasons.append(f"only {m['negatives']} confirmed negative cases (minimum {THRESHOLDS.min_negatives})")
        if m["n"] < THRESHOLDS.min_subgroup_n:
            reasons.append(f"only {m['n']} cases (minimum {THRESHOLDS.min_subgroup_n})")
        out.append({
            "group": val, "dimension": "Age group" if col == "age_group" else "Clinical setting",
            "n": m["n"], "positives": m["positives"], "negatives": m["negatives"],
            "sensitivity": m["sensitivity"], "specificity": m["specificity"], "fnr": m["fnr"],
            "sensitivity_ci": m["sensitivity_ci"], "specificity_ci": m["specificity_ci"],
            "low_sample": bool(low), "low_sample_reason": "; ".join(reasons) if reasons else None,
        })
    return out


def compare_subgroups(base: pd.DataFrame, cur: pd.DataFrame) -> list[dict]:
    b, c = subgroup_metrics(base), subgroup_metrics(cur)
    return [{"group": x["group"], "dimension": x["dimension"], "baseline": x, "current": y} for x, y in zip(b, c)]
