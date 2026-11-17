// Stage 1: static model metadata only. No metrics live here — performance
// numbers are computed from synthetic predictions by the backend in Stage 4.

export type MonitoringStatus = "healthy" | "warning" | "critical";

export interface ModelSummary {
  id: string;
  identifier: string;
  name: string;
  purpose: string;
  modality: string;
  version: string;
  initialStatus: MonitoringStatus;
}

export const MODELS: ModelSummary[] = [
  {
    id: "chest-xray-classifier",
    identifier: "sw-cxr-001",
    name: "Chest X-ray Classifier",
    purpose: "Simulated classification of chest X-ray findings.",
    modality: "Chest radiography",
    version: "v1.4.2",
    initialStatus: "healthy",
  },
  {
    id: "lung-finding-classifier",
    identifier: "sw-lung-002",
    name: "Lung Finding Classifier",
    purpose: "Simulated classification of selected lung findings.",
    modality: "Chest radiography",
    version: "v2.0.1",
    initialStatus: "healthy",
  },
  {
    id: "imaging-triage-model",
    identifier: "sw-triage-003",
    name: "Imaging Triage Model",
    purpose: "Simulated prioritization of imaging cases.",
    modality: "Chest radiography",
    version: "v0.9.7",
    initialStatus: "warning",
  },
];
