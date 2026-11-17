"""Deterministic synthetic data generation. All records are synthetic: no names,
addresses or medical record numbers are ever produced."""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np
import pandas as pd

from .config import BASELINE_WINDOW, CURRENT_WINDOW, N_RECORDS

AGE_GROUPS = ["Under 40", "40–59", "60 and older"]
SETTINGS = ["Emergency department", "Outpatient", "Inpatient"]
HOSPITALS = ["HOSP-A", "HOSP-B", "HOSP-C"]
IMAGE_FEATURES = ["image_feature_1", "image_feature_2", "image_feature_3"]
MISSING_COLS = ["missing_image_feature_1", "missing_image_feature_2", "missing_image_feature_3"]
FEATURE_LOC = {"image_feature_1": (0.50, 0.12), "image_feature_2": (120.0, 18.0), "image_feature_3": (0.30, 0.08)}

COLUMNS = [
    "case_id", "date", "modality", "hospital_id", "patient_age", "age_group", "clinical_setting",
    *IMAGE_FEATURES, *MISSING_COLS, "reporting_delay_days",
    "prediction_score", "prediction", "prediction_confidence", "outcome",
]


@dataclass(frozen=True)
class ModelSpec:
    id: str
    identifier: str
    name: str
    purpose: str
    modality: str
    version: str
    seed: int
    prefix: str
    prevalence: float
    separation: float          # strength of the signal in the image features
    threshold: float           # decision threshold on the latent signal
    gain: float = 3.0
    base_noise: float = 0.10
    age_noise: dict = field(default_factory=dict)
    age_offset: dict = field(default_factory=dict)
    setting_noise: dict = field(default_factory=dict)
    setting_offset: dict = field(default_factory=dict)
    setting_mix: tuple = (0.30, 0.45, 0.25)
    # applied to the *current* seeded dataset only (monitoring scenario)
    current_f2_shift_sd: float = 0.0
    current_missing: tuple = (0.015, 0.015, 0.015)
    current_delay_lambda: float = 1.4


MODEL_SPECS: dict[str, ModelSpec] = {
    "chest-xray-classifier": ModelSpec(
        id="chest-xray-classifier", identifier="sw-cxr-001", name="Chest X-ray Classifier",
        purpose="Simulated classification of chest X-ray findings.", modality="Chest radiography",
        version="v1.4.2", seed=1101, prefix="CXR", prevalence=0.17, separation=1.6, threshold=0.95,
        age_noise={"60 and older": 0.10}, age_offset={"60 and older": 0.17},
        setting_noise={"Emergency department": 0.06}, setting_offset={"Emergency department": 0.10},
    ),
    "lung-finding-classifier": ModelSpec(
        id="lung-finding-classifier", identifier="sw-lung-002", name="Lung Finding Classifier",
        purpose="Simulated classification of selected lung findings.", modality="Chest radiography",
        version="v2.0.1", seed=2202, prefix="LNG", prevalence=0.14, separation=1.5, threshold=0.95,
        age_noise={"Under 40": 0.05}, age_offset={"60 and older": 0.14},
        setting_noise={"Inpatient": 0.07}, setting_offset={"Inpatient": 0.12},
        setting_mix=(0.25, 0.50, 0.25),
    ),
    "imaging-triage-model": ModelSpec(
        id="imaging-triage-model", identifier="sw-triage-003", name="Imaging Triage Model",
        purpose="Simulated prioritization of imaging cases.", modality="Chest radiography",
        version="v0.9.7", seed=3303, prefix="TRI", prevalence=0.22, separation=1.35, threshold=0.62,
        age_noise={"60 and older": 0.09}, age_offset={"60 and older": 0.12},
        setting_noise={"Emergency department": 0.05}, setting_offset={"Inpatient": 0.08},
        setting_mix=(0.40, 0.30, 0.30),
        # seeded monitoring scenario: an image feature drifted and one feature has more missing values
        current_f2_shift_sd=0.45, current_missing=(0.015, 0.065, 0.015), current_delay_lambda=1.6,
    ),
}


def age_group_of(age: np.ndarray) -> np.ndarray:
    return np.where(age < 40, AGE_GROUPS[0], np.where(age < 60, AGE_GROUPS[1], AGE_GROUPS[2]))


def _lookup(values: np.ndarray, mapping: dict) -> np.ndarray:
    return np.array([mapping.get(v, 0.0) for v in values], dtype=float)


def generate_dataset(spec: ModelSpec, kind: str, n: int = N_RECORDS) -> pd.DataFrame:
    """Generate the baseline ("baseline") or seeded current ("current") dataset."""
    if kind not in ("baseline", "current"):
        raise ValueError("kind must be 'baseline' or 'current'")
    is_cur = kind == "current"
    rng = np.random.default_rng(spec.seed + (7919 if is_cur else 0))
    start, end = CURRENT_WINDOW if is_cur else BASELINE_WINDOW
    days = pd.date_range(start, end).values
    dates = np.sort(rng.choice(days, n))

    setting = rng.choice(SETTINGS, n, p=spec.setting_mix)
    age = rng.normal(54, 17, n) + _lookup(setting, {"Outpatient": -3.0, "Inpatient": 7.0})
    age = np.clip(np.round(age), 18, 95).astype(int)
    group = age_group_of(age)
    hospital = rng.choice(HOSPITALS, n, p=[0.45, 0.33, 0.22])

    mult = _lookup(setting, {"Emergency department": 1.15, "Outpatient": 0.7, "Inpatient": 1.35})
    p_pos = np.clip(spec.prevalence * mult * (1 + 0.006 * (age - 54)), 0.02, 0.6)
    y = rng.random(n) < p_pos

    z = rng.normal(size=(n, 3)) + spec.separation * y[:, None]
    u = z.mean(axis=1)
    noise_sd = spec.base_noise + _lookup(group, spec.age_noise) + _lookup(setting, spec.setting_noise)
    u = u + rng.normal(size=n) * noise_sd
    c = spec.threshold + _lookup(group, spec.age_offset) + _lookup(setting, spec.setting_offset)
    score = 1.0 / (1.0 + np.exp(-spec.gain * (u - c)))
    pred = score >= 0.5

    feats = {}
    for j, name in enumerate(IMAGE_FEATURES):
        mu, sd = FEATURE_LOC[name]
        feats[name] = mu + sd * z[:, j]
    if is_cur and spec.current_f2_shift_sd:
        feats["image_feature_2"] = feats["image_feature_2"] + spec.current_f2_shift_sd * FEATURE_LOC["image_feature_2"][1]

    miss_p = spec.current_missing if is_cur else (0.015, 0.015, 0.015)
    missing = rng.random((n, 3)) < np.array(miss_p)
    for j, name in enumerate(IMAGE_FEATURES):
        arr = feats[name].copy()
        arr[missing[:, j]] = np.nan
        feats[name] = arr

    lam = spec.current_delay_lambda if is_cur else 1.4
    tag = "C" if is_cur else "B"
    df = pd.DataFrame({
        "case_id": [f"SYN-{spec.prefix}-{tag}-{i + 1:05d}" for i in range(n)],
        "date": pd.to_datetime(dates),
        "modality": spec.modality,
        "hospital_id": hospital,
        "patient_age": age,
        "age_group": group,
        "clinical_setting": setting,
        **feats,
        **{MISSING_COLS[j]: missing[:, j].astype(int) for j in range(3)},
        "reporting_delay_days": rng.poisson(lam, n),
        "prediction_score": score,
        "prediction": pred.astype(int),
        "prediction_confidence": np.maximum(score, 1 - score),
        "outcome": y.astype(int),
    })
    return df[COLUMNS]


@lru_cache(maxsize=16)
def _cached(model_id: str, kind: str) -> pd.DataFrame:
    return generate_dataset(MODEL_SPECS[model_id], kind)


def seeded_dataset(model_id: str, kind: str) -> pd.DataFrame:
    """Return a private copy so callers can never mutate the cached seed data."""
    if model_id not in MODEL_SPECS:
        raise KeyError(model_id)
    return _cached(model_id, kind).copy(deep=True)
