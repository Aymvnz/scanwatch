import numpy as np
import pandas as pd
import pytest
from scipy import stats

from app import metrics, drift, simulations, synth, subgroups
from app.alert_rules import evaluate_alerts

CXR = "chest-xray-classifier"


# ---------- synthetic data ----------
def test_dataset_shape_and_columns():
    df = synth.seeded_dataset(CXR, "baseline")
    assert len(df) >= 2000 and list(df.columns) == synth.COLUMNS
    assert df["case_id"].is_unique
    assert set(df["outcome"]) <= {0, 1} and set(df["prediction"]) <= {0, 1}


def test_generation_is_deterministic():
    a = synth.generate_dataset(synth.MODEL_SPECS[CXR], "baseline")
    b = synth.generate_dataset(synth.MODEL_SPECS[CXR], "baseline")
    pd.testing.assert_frame_equal(a, b)


def test_missing_indicators_match_nan():
    df = synth.seeded_dataset(CXR, "current")
    for f, m in zip(synth.IMAGE_FEATURES, synth.MISSING_COLS):
        assert (df[f].isna().astype(int) == df[m]).all()


def test_seeded_copy_cannot_mutate_cache():
    df = synth.seeded_dataset(CXR, "baseline")
    df["patient_age"] = 0
    assert synth.seeded_dataset(CXR, "baseline")["patient_age"].min() >= 18


# ---------- metrics ----------
def _df(tp, fp, tn, fn):
    y = [1] * tp + [0] * fp + [0] * tn + [1] * fn
    p = [1] * tp + [1] * fp + [0] * tn + [0] * fn
    return pd.DataFrame({"outcome": y, "prediction": p, "prediction_score": np.where(np.array(p) == 1, 0.8, 0.2)})


def test_metric_definitions():
    m = metrics.compute_metrics(_df(40, 10, 140, 10))
    assert m["sensitivity"] == pytest.approx(40 / 50)
    assert m["specificity"] == pytest.approx(140 / 150)
    assert m["precision"] == pytest.approx(40 / 50)
    assert m["fnr"] == pytest.approx(10 / 50) and m["fpr"] == pytest.approx(10 / 150)
    assert m["accuracy"] == pytest.approx(180 / 200)
    assert m["f1"] == pytest.approx(0.8)


def test_zero_denominators_are_unavailable_not_invented():
    m = metrics.compute_metrics(_df(0, 0, 50, 0))   # no positives, no predicted positives
    assert m["sensitivity"] is None and m["fnr"] is None and m["precision"] is None and m["f1"] is None
    assert m["specificity"] == 1.0
    assert metrics.compute_metrics(_df(0, 0, 0, 0)).get("accuracy") is None


def test_calibration_perfect_bins():
    df = pd.DataFrame({"prediction_score": [0.05] * 100 + [0.95] * 100,
                       "outcome": [0] * 95 + [1] * 5 + [1] * 95 + [0] * 5})
    assert metrics.calibration(df)["ece"] == pytest.approx(0.0, abs=1e-9)


# ---------- PSI / KS / MMD ----------
def test_psi_identical_is_zero_and_bins_from_reference():
    x = np.random.default_rng(0).normal(size=5000)
    assert drift.psi_numeric(x, x) == pytest.approx(0.0, abs=1e-9)


def test_psi_detects_known_shift_and_handles_empty_bins():
    rng = np.random.default_rng(1)
    ref = rng.normal(0, 1, 4000)
    assert drift.psi_numeric(ref, rng.normal(1.0, 1, 4000)) > 0.25
    far = rng.normal(8, 0.1, 500)   # occupies a single bin, others empty
    assert np.isfinite(drift.psi_numeric(ref, far))


def test_psi_applies_reference_bins_consistently():
    ref = np.arange(1000, dtype=float)
    cur = ref + 500
    inner = drift.psi_bin_edges(ref)
    assert drift._bin_props(cur, inner)[-1] > 0.4  # mass pushed into the top reference bin


def test_ks_matches_scipy_and_detects_shift():
    rng = np.random.default_rng(2)
    a, b = rng.normal(0, 1, 2000), rng.normal(0.4, 1, 2000)
    assert stats.ks_2samp(a, b).pvalue < 1e-6
    assert stats.ks_2samp(a, rng.normal(0, 1, 2000)).pvalue > 0.01


def test_mmd_detects_shift_and_controls_false_positives():
    rng = np.random.default_rng(3)
    shifted = drift.mmd_rbf(rng.normal(size=(500, 3)), rng.normal(0.8, 1, size=(500, 3)), seed=1)
    assert shifted["p_value"] < 0.01
    # Under the null (same distribution) a valid test rejects at roughly alpha; allow a generous margin.
    rejections = 0
    for r in range(16):
        a, b = rng.normal(size=(300, 3)), rng.normal(size=(300, 3))
        res = drift.mmd_rbf(a, b, n_perm=100, seed=r)
        rejections += res["p_value"] < 0.05
        assert res["statistic"] < shifted["statistic"]
    assert rejections <= 4


# ---------- simulations ----------
@pytest.fixture(scope="module")
def base():
    return synth.seeded_dataset(CXR, "baseline")


@pytest.fixture(scope="module")
def cur():
    return synth.seeded_dataset(CXR, "current")


@pytest.mark.parametrize("kind", list(simulations.SIMULATION_INFO))
def test_simulation_does_not_modify_input_and_is_reproducible(kind, cur):
    before = cur.copy(deep=True)
    a, _ = simulations.apply_simulation(cur, kind, 0.6, seed=7)
    b, _ = simulations.apply_simulation(cur, kind, 0.6, seed=7)
    pd.testing.assert_frame_equal(cur, before)
    pd.testing.assert_frame_equal(a, b)
    assert not a.equals(cur)


def test_seeded_baseline_unchanged_after_simulations(base):
    snap = base.copy(deep=True)
    for kind in simulations.SIMULATION_INFO:
        simulations.apply_simulation(base, kind, 1.0, seed=1)
    pd.testing.assert_frame_equal(base, snap)


def test_stable_current_has_no_drift(base, cur):
    res = drift.compute_drift(base, cur, n_perm=100)
    assert res["overall"]["n_drifted"] == 0 and res["mmd"]["p_value"] > 0.05


def test_equipment_change_is_detected_by_ks_and_psi(base, cur):
    new, _ = simulations.apply_simulation(cur, "imaging_equipment", 0.8, seed=1)
    res = drift.compute_drift(base, new, n_perm=100)
    f1 = next(f for f in res["features"] if f["feature"] == "image_feature_1")
    assert f1["drifted"] and f1["psi"] > 0.25 and f1["p_adjusted"] < 0.001
    assert res["mmd"]["p_value"] < 0.05


def test_equipment_change_does_not_change_performance(base, cur):
    new, _ = simulations.apply_simulation(cur, "imaging_equipment", 1.0, seed=1)
    assert metrics.confusion(new) == metrics.confusion(cur)


def test_performance_degradation_changes_metrics_not_inputs(base, cur):
    new, params = simulations.apply_simulation(cur, "performance_degradation", 0.8, seed=1)
    m0, m1 = metrics.compute_metrics(cur), metrics.compute_metrics(new)
    assert m1["sensitivity"] < m0["sensitivity"] - 0.15 and m1["specificity"] < m0["specificity"]
    assert (new["outcome"] == cur["outcome"]).all()
    res = drift.compute_drift(base, new, n_perm=50)
    assert not any(f["drifted"] for f in res["features"] if f["feature"] != "prediction_score")


def test_drift_alone_does_not_raise_performance_alert(base, cur):
    new, _ = simulations.apply_simulation(cur, "imaging_equipment", 0.9, seed=1)
    d = drift.compute_drift(base, new, n_perm=50)
    alerts = evaluate_alerts(metrics.compute_metrics(base), metrics.compute_metrics(new), d,
                             subgroups.subgroup_metrics(base), subgroups.subgroup_metrics(new))
    types = {a["type"] for a in alerts}
    assert "data_drift" in types and "performance_decline" not in types


def test_performance_degradation_raises_performance_alert(base, cur):
    new, _ = simulations.apply_simulation(cur, "performance_degradation", 0.8, seed=1)
    d = drift.compute_drift(base, new, n_perm=50)
    alerts = evaluate_alerts(metrics.compute_metrics(base), metrics.compute_metrics(new), d,
                             subgroups.subgroup_metrics(base), subgroups.subgroup_metrics(new))
    assert any(a["type"] == "performance_decline" for a in alerts)
    assert not any(a["type"] == "data_drift" for a in alerts)


def test_workflow_change_raises_missing_data_alert(base, cur):
    new, _ = simulations.apply_simulation(cur, "hospital_workflow", 0.7, seed=1)
    d = drift.compute_drift(base, new, n_perm=50)
    alerts = evaluate_alerts(metrics.compute_metrics(base), metrics.compute_metrics(new), d,
                             subgroups.subgroup_metrics(base), subgroups.subgroup_metrics(new))
    assert any(a["type"] == "missing_data" for a in alerts)


def test_prediction_distribution_keeps_decisions(cur):
    new, _ = simulations.apply_simulation(cur, "prediction_distribution", 1.0, seed=1)
    assert (new["prediction"] == cur["prediction"]).all()
    assert (new["prediction_score"] >= 0.5).eq(new["prediction"] == 1).all()


def test_population_change_shifts_age(base, cur):
    new, _ = simulations.apply_simulation(cur, "patient_population", 0.8, seed=1)
    assert new["patient_age"].mean() > cur["patient_age"].mean() + 5
    d = drift.compute_drift(base, new, n_perm=50)
    assert next(f for f in d["features"] if f["feature"] == "patient_age")["drifted"]


def test_seeded_models_status_scenario():
    for mid, expect_alerts in (("chest-xray-classifier", False), ("lung-finding-classifier", False), ("imaging-triage-model", True)):
        b, c = synth.seeded_dataset(mid, "baseline"), synth.seeded_dataset(mid, "current")
        d = drift.compute_drift(b, c, n_perm=50)
        al = evaluate_alerts(metrics.compute_metrics(b), metrics.compute_metrics(c), d,
                             subgroups.subgroup_metrics(b), subgroups.subgroup_metrics(c))
        sev = [a["severity"] for a in al if a["severity"] in ("warning", "critical")]
        assert bool(sev) == expect_alerts, (mid, [(a["type"], a["severity"]) for a in al])
