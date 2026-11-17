"""Plain-English interpretation of experiment results."""
from __future__ import annotations

from .simulations import SIMULATION_INFO

LIMITATIONS = [
    "Many features are compared at once, so some will look different by chance. p-values here are Bonferroni-adjusted, which is conservative but not perfect.",
    "With large samples, even trivial differences become statistically significant; with small samples, real shifts can be missed. PSI is used alongside the KS test for this reason.",
    "A p-value is not evidence of clinical harm, and PSI cut-offs (0.10 and 0.25) are conventions, not clinical thresholds.",
    "The KS test and PSI examine one feature at a time and can miss changes in how features relate to each other; MMD looks at the features jointly but depends on kernel and sample choices.",
    "Data drift is not model failure. Only confirmed outcomes show whether performance changed, and those can arrive late.",
    "All data are synthetic. Results demonstrate monitoring methods and are not clinical validation.",
]


def interpret(sim_kind: str, intensity: float, drift: dict, base_m: dict, cur_m: dict, alerts: list[dict]) -> dict:
    ov = drift["overall"]
    drifted = [f for f in drift["features"] if f["drifted"]]
    info = SIMULATION_INFO[sim_kind]
    paras: list[str] = []

    if drifted:
        top = max(drifted, key=lambda f: f["psi"] or 0)
        paras.append(
            f"{len(drifted)} of {ov['n_features_tested']} compared features changed relative to the reference dataset "
            f"(largest shift: {top['label']}, PSI {top['psi']:.2f}). This may reflect a change in imaging equipment, patient population, or workflow. "
            "Investigate the source before concluding that model performance has changed.")
    else:
        paras.append(
            "No feature met the drift criteria (adjusted KS or chi-square significance together with PSI of at least 0.10). "
            "That does not prove the data are unchanged; small shifts can go undetected, especially with limited samples.")

    mmd = drift["mmd"]
    if mmd.get("available"):
        sig = mmd["p_value"] < 0.05
        paras.append(f"MMD, which compares the image features, age and prediction score jointly, gave {mmd['statistic']:.4f} (permutation p = {mmd['p_value']:.3f}); "
                     + ("the joint distributions differ." if sig else "no joint difference was detected."))

    sens_b, sens_c = base_m["sensitivity"], cur_m["sensitivity"]
    spec_b, spec_c = base_m["specificity"], cur_m["specificity"]
    perf = [a for a in alerts if a["type"] == "performance_decline"]
    if sim_kind == "performance_degradation":
        paras.append(
            f"This experiment changed prediction errors while keeping confirmed outcomes. Measured sensitivity moved from {_p(sens_b)} to {_p(sens_c)} and specificity from {_p(spec_b)} to {_p(spec_c)}. "
            "Input features were not changed, so input-drift tests should stay quiet: performance can degrade without any visible input drift.")
    elif sim_kind == "prediction_distribution":
        paras.append("Yes/no predictions and outcomes were held fixed, so sensitivity and specificity are unchanged by design. The score distribution and calibration changed; scores are now more extreme than the outcomes justify.")
    elif sim_kind == "patient_population":
        paras.append("Cases were resampled toward older, more often inpatient patients. Any change in measured performance reflects a different mix of cases, not a changed model.")
    else:
        paras.append("Recorded predictions and confirmed outcomes were held fixed in this experiment, so measured performance is not expected to change. Real-world input drift may or may not affect accuracy; only confirmed outcomes can show that.")
    if not perf and sim_kind != "performance_degradation":
        paras.append("No performance-decline alert was raised: drift on its own is not treated as degradation.")

    headline = ("Input drift detected" if drifted else "No input drift detected") if info["kind"] == "input_drift" else \
               ("Performance change measured" if perf else "No significant performance decline measured")
    return {"headline": headline, "paragraphs": paras, "limitations": LIMITATIONS}


def _p(v):
    return "unavailable" if v is None else f"{v * 100:.1f}%"
