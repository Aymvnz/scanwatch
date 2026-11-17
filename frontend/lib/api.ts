import type {
  Alert, AlertStatus, DatasetBrief, ExperimentBrief, ExperimentResult, ModelDetail, ModelSummary, Overview,
  PerformanceResponse, ReportBrief, ReportData, SimulationId, SimulationInfo, SubgroupResponse,
} from "./types";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number, public network = false) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  } catch {
    throw new ApiError(`Could not reach the ScanWatch API at ${API_BASE}.`, 0, true);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ") || detail;
    } catch { /* keep generic message */ }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | null | undefined>): string {
  const p = Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== "all");
  return p.length ? "?" + p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&") : "";
}

export interface ViewParams { days?: number | null; site?: string | null; baseline?: string; current?: string }

export const api = {
  health: () => request<{ status: string; persistence: string }>("/health"),
  config: () => request<{ thresholds: Record<string, number>; persistence: string }>("/config"),
  resetDemo: () => request<{ status: string }>("/demo/reset", { method: "POST" }),
  models: () => request<ModelSummary[]>("/models"),
  model: (id: string) => request<ModelDetail>(`/models/${id}`),
  datasets: (id: string) => request<DatasetBrief[]>(`/datasets/${id}`),
  overview: (p: ViewParams) => request<Overview>(`/overview${qs({ days: p.days, site: p.site })}`),
  performance: (id: string, p: ViewParams) => request<PerformanceResponse>(`/performance/${id}${qs({ days: p.days, site: p.site, baseline: p.baseline, current: p.current })}`),
  subgroups: (id: string, p: ViewParams) => request<SubgroupResponse>(`/subgroups/${id}${qs({ days: p.days, site: p.site, baseline: p.baseline, current: p.current })}`),
  simulations: () => request<SimulationInfo[]>("/simulations"),
  runExperiment: (body: { model_id: string; baseline_dataset_id: string; current_dataset_id: string; simulation: SimulationId; intensity: number; seed: number }) =>
    request<ExperimentResult>("/experiments", { method: "POST", body: JSON.stringify(body) }),
  experiments: (modelId?: string) => request<ExperimentBrief[]>(`/experiments${qs({ model_id: modelId })}`),
  experiment: (id: string) => request<ExperimentResult>(`/experiments/${id}`),
  alerts: (p: { model_id?: string; status?: string; severity?: string } = {}) => request<Alert[]>(`/alerts${qs(p)}`),
  patchAlert: (id: string, body: { status?: AlertStatus; note?: string }) =>
    request<Alert>(`/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ ...body, author: "Demo User" }) }),
  createReport: (body: { model_id: string; days?: number | null; baseline_dataset_id?: string; current_dataset_id?: string; experiment_id?: string | null }) =>
    request<ReportData>("/reports", { method: "POST", body: JSON.stringify(body) }),
  reports: () => request<ReportBrief[]>("/reports"),
  reportUrl: (id: string, format: "pdf" | "csv") => `${API_BASE}/reports/${id}/download?format=${format}`,
};
