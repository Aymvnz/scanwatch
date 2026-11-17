"""Alert rules. Each rule compares measured values against configured thresholds and
returns drafts; nothing here is hardcoded, so alerts always agree with the data."""
from __future__ import annotations

from .config import THRESHOLDS, Thresholds
from .metrics import two_proportion_pvalue

HUMAN_REVIEW = "Qualified clinical and technical staff must review the cause before any operational decision; a statistical alert alone is not a reason to stop or change a clinical system."


def _pct(v):
    return "unavailable" if v is None else f"{v * 100:.1f}%"


def evaluate_alerts(base_m: dict, cur_m: dict, drift: dict, base_sub: list, cur_sub: list,
                    th: Thresholds = THRESHOLDS) -> list[dict]:
    drafts: list[dict] = []

    # 1. Data drift
    ov = drift["overall"]
    drifted = [f for f in drift["features"] if f["drifted"]]
    if drifted:
        top = max(drifted, key=lambda f: f["psi"] or 0)
        max_psi = top["psi"] or 0
        if max_psi >= th.psi_significant and ov["share_drifted"] >= th.drift_share_critical:
            sev = "critical"
        elif len(drifted) >= 2 or max_psi >= th.psi_significant:
            sev = "warning"
        else:
            sev = "info"
        names = ", ".join(f["label"] for f in sorted(drifted, key=lambda f: -(f["psi"] or 0))[:4])
        drafts.append({
            "type": "data_drift", "severity": sev,
            "trigger_metric": f"Max PSI ({top['label']})",
            "baseline_value": 0.0, "current_value": max_psi, "value_format": "number",
            "explanation": (f"{len(drifted)} of {ov['n_features_tested']} monitored features differ from the reference dataset "
                            f"(largest PSI {max_psi:.2f} on {top['label']}; flagged: {names}). Statistical drift does not by itself show that model accuracy has changed."),
            "suggestion": "Check whether imaging equipment, acquisition settings, patient mix or reporting workflow changed in this period, and compare with confirmed outcomes when they become available. " + HUMAN_REVIEW,
        })

    # 2. Performance decline (needs a meaningful drop AND statistical support)
    for key, label, k_key, d_key in (("sensitivity", "Sensitivity", "tp", "positives"), ("specificity", "Specificity", "tn", "negatives")):
        b, c = base_m[key], cur_m[key]
        if b is None or c is None:
            continue
        drop = b - c
        p = two_proportion_pvalue(base_m[k_key], base_m[d_key], cur_m[k_key], cur_m[d_key])
        if drop >= th.perf_drop_warning and p is not None and p < th.alpha:
            sev = "critical" if drop >= th.perf_drop_critical else "warning"
            drafts.append({
                "type": "performance_decline", "severity": sev, "trigger_metric": label,
                "baseline_value": b, "current_value": c, "value_format": "pct",
                "explanation": (f"{label} fell from {_pct(b)} to {_pct(c)} ({drop * 100:.1f} percentage points; p = {p:.3g}) "
                                f"across {cur_m[d_key]} confirmed cases. Outcome labels can arrive late, so recent estimates may be incomplete."),
                "suggestion": "Review recent missed or wrongly flagged cases, check whether labelling or reporting changed, and re-measure when more outcomes are confirmed. " + HUMAN_REVIEW,
            })

    # 3. Subgroup sensitivity gap vs overall (only groups with enough samples)
    overall = cur_m["sensitivity"]
    if overall is not None:
        gaps = [(overall - g["sensitivity"], g) for g in cur_sub
                if g["sensitivity"] is not None and not g["low_sample"]]
        gaps = [x for x in gaps if x[0] >= th.subgroup_gap_warning]
        if gaps:
            gap, g = max(gaps, key=lambda x: x[0])
            base_g = next((x for x in base_sub if x["group"] == g["group"]), None)
            drafts.append({
                "type": "subgroup_difference", "severity": "critical" if gap >= th.subgroup_gap_critical else "warning",
                "trigger_metric": f"Sensitivity gap: {g['group']}",
                "baseline_value": base_g["sensitivity"] if base_g else None, "current_value": g["sensitivity"], "value_format": "pct",
                "explanation": (f"Sensitivity in the {g['group']} group is {_pct(g['sensitivity'])} versus {_pct(overall)} overall "
                                f"(gap {gap * 100:.1f} points, {g['positives']} confirmed positives). This is a statistical observation; it does not establish a cause or show discrimination."),
                "suggestion": "Check group sample sizes and case mix, then look for differences in image quality, acquisition or labelling. " + HUMAN_REVIEW,
            })

    # 4. Missing data increase (worst feature, must be statistically supported)
    worst = None
    for f in drift["features"]:
        if f["kind"] != "missingness" or f["reference_value"] is None:
            continue
        delta = f["current_value"] - f["reference_value"]
        if delta >= th.missing_increase_warning and f["p_adjusted"] is not None and f["p_adjusted"] < th.alpha:
            if worst is None or delta > worst[0]:
                worst = (delta, f)
    if worst:
        delta, f = worst
        drafts.append({
            "type": "missing_data", "severity": "critical" if delta >= th.missing_increase_critical else "warning",
            "trigger_metric": f["label"], "baseline_value": f["reference_value"], "current_value": f["current_value"],
            "value_format": "pct",
            "explanation": f"The missing-value rate for {f['label'].replace('Missing: ', '')} rose from {_pct(f['reference_value'])} to {_pct(f['current_value'])} (+{delta * 100:.1f} points). Missing inputs can change how a model behaves.",
            "suggestion": "Check the image pipeline, data transfer and record completion for the affected period. " + HUMAN_REVIEW,
        })

    # 5. Insufficient samples in a subgroup
    small = [g for g in cur_sub if g["low_sample"]]
    if small:
        g = min(small, key=lambda x: x["positives"])
        drafts.append({
            "type": "sample_size", "severity": "info", "trigger_metric": f"Confirmed positives: {g['group']}",
            "baseline_value": float(next((x["positives"] for x in base_sub if x["group"] == g["group"]), 0)),
            "current_value": float(g["positives"]), "value_format": "count",
            "explanation": f"The {g['group']} group has too few cases for reliable estimates ({g['low_sample_reason']}). Metrics for small groups can swing widely by chance.",
            "suggestion": "Collect more confirmed outcomes or widen the reporting period before drawing conclusions.",
        })
    return drafts
