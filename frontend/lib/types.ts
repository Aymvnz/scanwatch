export type Status = "healthy" | "warning" | "critical";
export type Severity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "investigating" | "resolved";
export type SimulationId = "imaging_equipment" | "patient_population" | "hospital_workflow" | "prediction_distribution" | "performance_degradation";

export interface ModelSummary {
  id: string; identifier: string; name: string; purpose: string; modality: string; version: string;
  status: Status; last_monitored: string; open_alerts: number;
  latest: { n: number; sensitivity: number | null; specificity: number | null; accuracy: number | null; precision: number | null };
}
export interface CalibrationBin { bin_low: number; bin_high: number; n: number; mean_predicted: number | null; observed_rate: number | null }
export interface Calibration { ece: number; brier: number; mean_predicted: number; observed_rate: number; bins: CalibrationBin[] }
export interface Metrics {
  n: number; positives: number; negatives: number; tp: number; fp: number; tn: number; fn: number; prevalence: number | null;
  accuracy: number | null; sensitivity: number | null; specificity: number | null; precision: number | null;
  fnr: number | null; fpr: number | null; f1: number | null;
  sensitivity_ci: [number, number] | null; specificity_ci: [number, number] | null; calibration: Calibration | null;
}
export type MetricKey = "accuracy" | "sensitivity" | "specificity" | "precision" | "fnr" | "fpr" | "f1";
export interface DatasetBrief { id: string; label: string; n: number; start: string | null; end: string | null; kind?: string }
export interface WeeklyPoint { week: string; n: number; positives: number; sensitivity: number | null; specificity: number | null; accuracy: number | null; mean_psi: number | null }
export interface PerformanceResponse {
  model: ModelSummary;
  baseline: { dataset: DatasetBrief; metrics: Metrics }; current: { dataset: DatasetBrief; metrics: Metrics };
  deltas: Record<MetricKey, number | null>; trend: WeeklyPoint[]; definitions: Record<string, string>; label_note: string;
}
export interface SubgroupMetrics {
  group: string; dimension: string; n: number; positives: number; negatives: number;
  sensitivity: number | null; specificity: number | null; fnr: number | null;
  sensitivity_ci: [number, number] | null; specificity_ci: [number, number] | null; low_sample: boolean; low_sample_reason: string | null;
}
export interface SubgroupRow { group: string; dimension: string; baseline: SubgroupMetrics; current: SubgroupMetrics }
export interface SubgroupResponse {
  model: ModelSummary; groups: SubgroupRow[]; overall: { baseline: Metrics; current: Metrics }; low_sample_groups: string[];
  baseline_dataset: DatasetBrief; current_dataset: DatasetBrief;
}
export interface HistBin { x: string; baseline: number; current: number }
export interface DriftFeature {
  feature: string; label: string; kind: "numeric" | "categorical" | "missingness"; test: string;
  statistic: number | null; p_value: number | null; p_adjusted: number | null; psi: number | null;
  psi_level: "none" | "moderate" | "significant" | "unavailable"; drifted: boolean; severity: "none" | "moderate" | "significant" | "unavailable";
  n_reference: number; n_current: number; reference_value: number | null; current_value: number | null; value_label: string | null; histogram: HistBin[];
}
export interface MMDResult { available: boolean; statistic?: number; p_value?: number; n_reference?: number; n_current?: number; n_permutations?: number; features?: string[]; reason?: string }
export interface DriftResult {
  overall: { n_features_tested: number; n_drifted: number; share_drifted: number; max_psi: number | null; max_psi_feature: string | null;
    alpha: number; alpha_adjusted: number; verdict: "none" | "limited" | "widespread"; n_reference: number; n_current: number };
  features: DriftFeature[]; mmd: MMDResult;
}
export interface AlertNote { id: string; at: string; author: string; text: string }
export interface AlertEvent { at: string; event: string; detail: string; author: string }
export interface Alert {
  id: string; model_id: string; model_name: string; created_at: string; type: string; type_label: string; severity: Severity;
  trigger_metric: string; baseline_value: number | null; current_value: number | null; value_format: "pct" | "number" | "count";
  explanation: string; suggestion: string; status: AlertStatus;
  source: { type: string; experiment_id?: string; label: string }; notes: AlertNote[]; history: AlertEvent[];
}
export interface Activity { id: string; at: string; type: string; text: string; model_id: string | null; link: string | null }
export interface Overview {
  metrics: { monitored_models: number; healthy_models: number; active_alerts: number; experiments_run: number };
  models: ModelSummary[]; performance_trend: Record<string, string | number | null>[]; drift_trend: Record<string, string | number | null>[];
  alerts_by_severity: Record<Severity, number>;
  subgroup_performance: { model_id: string; group: string; sensitivity: number | null; n: number; positives: number; low_sample: boolean }[];
  recent_alerts: Alert[]; recent_activity: Activity[]; filters: { days: number | null; site: string; sites: string[] };
}
export interface SimulationInfo { id: SimulationId; label: string; kind: "input_drift" | "performance"; description: string; changes: string[]; holds_fixed: string[] }
export interface ExperimentResult {
  id: string; created_at: string;
  config: { model_id: string; baseline_dataset_id: string; current_dataset_id: string; simulation: SimulationId; intensity: number; seed: number };
  model: ModelSummary; simulation: SimulationInfo & { parameters: Record<string, number> };
  datasets: { baseline: DatasetBrief; source: DatasetBrief; current: DatasetBrief };
  drift: DriftResult;
  performance: { baseline: Metrics; current: Metrics; deltas: Record<MetricKey, number | null> };
  subgroups: SubgroupRow[]; alerts: Alert[];
  interpretation: { headline: string; paragraphs: string[]; limitations: string[] };
}
export interface ExperimentBrief { id: string; created_at: string; model_id: string; simulation: SimulationId; simulation_label: string; intensity: number; n_drifted: number; n_features_tested: number; alert_ids: string[]; headline: string }
export interface ModelDetail { summary: ModelSummary; performance: PerformanceResponse; drift: DriftResult; subgroups: SubgroupResponse; experiments: ExperimentBrief[]; alerts: Alert[] }
export interface ReportBrief { id: string; model_id: string; model_name: string; created_at: string; period: { start: string; end: string; days: number | null; site: string }; baseline: string; current: string; experiment_id: string | null; alerts: number }
export interface ReportData {
  id: string; created_at: string; model: ModelSummary; period: ReportBrief["period"];
  datasets: { baseline: DatasetBrief; current: DatasetBrief };
  performance: { baseline: Metrics; current: Metrics; deltas: Record<MetricKey, number | null> };
  drift: DriftResult; subgroups: SubgroupRow[]; alerts: Alert[]; disclaimer: string;
}
