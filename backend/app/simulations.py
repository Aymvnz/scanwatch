"""Simulation transformations. Every function works on a deep copy; the input
dataset is never modified. Input-drift simulations (A-D) hold the recorded
predictions and confirmed outcomes fixed; only simulation E changes errors."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .synth import IMAGE_FEATURES, MISSING_COLS, SETTINGS

SIMULATION_INFO = {
    "imaging_equipment": {
        "label": "Imaging Equipment Change",
        "kind": "input_drift",
        "description": "Shifts the level, spread and noise of the three synthetic image features, as if a scanner or image-processing step changed.",
        "changes": ["image_feature_1 (mean shift)", "image_feature_2 (shift and spread)", "image_feature_3 (shift and added noise)"],
        "holds_fixed": ["Recorded predictions", "Confirmed outcomes"],
    },
    "patient_population": {
        "label": "Patient Population Change",
        "kind": "input_drift",
        "description": "Reweights cases toward older patients and more inpatients by resampling rows, so each row's features, prediction and outcome stay internally consistent.",
        "changes": ["patient_age", "age_group mix", "clinical_setting mix"],
        "holds_fixed": ["Each case's own features, prediction and outcome"],
    },
    "hospital_workflow": {
        "label": "Hospital Workflow Change",
        "kind": "input_drift",
        "description": "Introduces missing image-feature values, longer reporting delays and a shift toward emergency-department cases.",
        "changes": ["Missing values in image features", "reporting_delay_days", "clinical_setting mix"],
        "holds_fixed": ["Recorded predictions", "Confirmed outcomes"],
    },
    "prediction_distribution": {
        "label": "Prediction Distribution Change",
        "kind": "input_drift",
        "description": "Makes the model's scores more extreme (over-confident) while leaving each yes/no decision unchanged, isolating score drift from accuracy.",
        "changes": ["prediction_score", "prediction_confidence"],
        "holds_fixed": ["Yes/no predictions", "Confirmed outcomes", "Input features"],
    },
    "performance_degradation": {
        "label": "Performance Degradation",
        "kind": "performance",
        "description": "Flips some correct predictions to errors while keeping confirmed outcomes, so measured sensitivity and specificity change. Input features are not touched.",
        "changes": ["prediction", "prediction_score", "prediction_confidence"],
        "holds_fixed": ["Input features", "Confirmed outcomes"],
    },
}


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def _refresh_confidence(df: pd.DataFrame) -> None:
    df["prediction_confidence"] = np.maximum(df["prediction_score"], 1 - df["prediction_score"])


def apply_simulation(df: pd.DataFrame, kind: str, intensity: float, seed: int):
    """Return (new_dataframe, parameters_applied). `intensity` is in (0, 1]."""
    if kind not in SIMULATION_INFO:
        raise ValueError(f"Unknown simulation type: {kind}")
    if not 0 < intensity <= 1:
        raise ValueError("intensity must be in (0, 1]")
    out = df.copy(deep=True)
    rng = np.random.default_rng(seed)
    n = len(out)
    i = float(intensity)
    params: dict = {"intensity": i, "seed": seed}

    if kind == "imaging_equipment":
        f1, f2, f3 = IMAGE_FEATURES
        sd1 = float(np.nanstd(out[f1])); m2 = float(np.nanmean(out[f2])); sd2 = float(np.nanstd(out[f2])); sd3 = float(np.nanstd(out[f3]))
        out[f1] = out[f1] + 1.0 * i * sd1
        out[f2] = m2 + (out[f2] - m2) * (1 + 0.6 * i) - 0.6 * i * sd2
        out[f3] = out[f3] - 0.4 * i * sd3 + rng.normal(0, 1.2 * i * sd3, n)
        out.loc[out[MISSING_COLS[2]] == 1, f3] = np.nan
        params.update({"image_feature_1_mean_shift_sd": round(1.0 * i, 3),
                       "image_feature_2_spread_factor": round(1 + 0.6 * i, 3),
                       "image_feature_2_mean_shift_sd": round(-0.6 * i, 3),
                       "image_feature_3_mean_shift_sd": round(-0.4 * i, 3),
                       "image_feature_3_added_noise_sd": round(1.2 * i, 3)})

    elif kind == "patient_population":
        age = out["patient_age"].to_numpy(float)
        zage = (age - age.mean()) / age.std()
        w = np.exp(0.8 * i * zage + 0.6 * i * (out["clinical_setting"].to_numpy() == "Inpatient"))
        idx = rng.choice(n, n, p=w / w.sum())
        out = out.iloc[idx].reset_index(drop=True)
        out["case_id"] = [f"SIM-POP-{k + 1:05d}" for k in range(n)]
        params.update({"age_tilt": round(0.8 * i, 3), "inpatient_weight": round(0.6 * i, 3),
                       "unique_source_rows": int(len(set(idx.tolist())))})

    elif kind == "hospital_workflow":
        for name, mcol in zip(IMAGE_FEATURES, MISSING_COLS):
            extra = rng.random(n) < 0.25 * i
            out.loc[extra, name] = np.nan
            out.loc[extra, mcol] = 1
        out["reporting_delay_days"] = out["reporting_delay_days"] + rng.poisson(5 * i, n)
        move = (out["clinical_setting"] != SETTINGS[0]).to_numpy() & (rng.random(n) < 0.3 * i)
        out.loc[move, "clinical_setting"] = SETTINGS[0]
        params.update({"extra_missing_rate": round(0.25 * i, 3), "extra_delay_mean_days": round(5 * i, 2),
                       "share_moved_to_emergency": round(0.3 * i, 3)})

    elif kind == "prediction_distribution":
        s = np.clip(out["prediction_score"].to_numpy(), 1e-6, 1 - 1e-6)
        a = 1 + 2.5 * i
        out["prediction_score"] = _sigmoid(a * np.log(s / (1 - s)))
        _refresh_confidence(out)
        params.update({"logit_scale": round(a, 3)})

    elif kind == "performance_degradation":
        y = out["outcome"].to_numpy().astype(bool)
        p = out["prediction"].to_numpy().astype(bool)
        q_fn, q_fp = 0.40 * i, 0.15 * i
        r = rng.random(n)
        flip = ((y & p) & (r < q_fn)) | ((~y & ~p) & (r < q_fp))
        out.loc[flip, "prediction"] = 1 - out.loc[flip, "prediction"]
        out.loc[flip, "prediction_score"] = 1 - out.loc[flip, "prediction_score"]
        _refresh_confidence(out)
        params.update({"share_of_true_positives_flipped": round(q_fn, 3),
                       "share_of_true_negatives_flipped": round(q_fp, 3), "flipped_rows": int(flip.sum())})
    return out, params
