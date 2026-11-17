"""Central configuration: alert thresholds, dataset windows, record counts."""
from dataclasses import dataclass, asdict


@dataclass(frozen=True)
class Thresholds:
    alpha: float = 0.05                 # family-wise significance level (Bonferroni-adjusted)
    psi_moderate: float = 0.10          # conventional PSI rule of thumb
    psi_significant: float = 0.25
    min_missing_shift: float = 0.02     # absolute change in missing rate to count as drift
    drift_share_critical: float = 0.25  # share of features drifted for a critical drift alert
    perf_drop_warning: float = 0.05     # absolute drop in sensitivity / specificity
    perf_drop_critical: float = 0.10
    subgroup_gap_warning: float = 0.10  # subgroup sensitivity below overall
    subgroup_gap_critical: float = 0.20
    missing_increase_warning: float = 0.03
    missing_increase_critical: float = 0.10
    min_positives: int = 30             # confirmed positives needed for sensitivity
    min_negatives: int = 30
    min_subgroup_n: int = 100

    def as_dict(self) -> dict:
        return asdict(self)


THRESHOLDS = Thresholds()

N_RECORDS = 2400
BASELINE_WINDOW = ("2026-06-01", "2026-08-31")
CURRENT_WINDOW = ("2026-09-01", "2026-11-14")
SEED_TIMESTAMP = "2026-11-14T06:00:00+00:00"
