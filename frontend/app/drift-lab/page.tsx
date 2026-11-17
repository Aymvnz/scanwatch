"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Play, RotateCcw } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { markStep } from "@/lib/demo";
import { dateTime, pct, pts, SEVERITY_LABEL } from "@/lib/format";
import type { ExperimentResult, SimulationId } from "@/lib/types";
import { useModel } from "@/components/layout/ModelContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { DatasetSelect } from "@/components/ui/Filters";
import { Field, Select } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/StatusPill";
import { SeverityPill } from "@/components/ui/SeverityPill";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { DriftPanel } from "@/components/panels/DriftPanel";
import { ConceptsCard } from "@/components/panels/ConceptsCard";
import { InfoTip } from "@/components/ui/InfoTip";

const TIPS: Record<string, string> = {
  imaging_equipment: "Like a new scanner or changed image processing: the three image features shift in level, spread and noise.",
  patient_population: "Like a different patient mix: more older and inpatient cases. Done by resampling real rows so each case stays consistent.",
  hospital_workflow: "Like a workflow change: missing values, delayed reporting and more emergency cases.",
  prediction_distribution: "The model’s scores become over-confident while its yes/no answers stay the same.",
  performance_degradation: "The model starts making more mistakes. Inputs are untouched, so this is a performance problem, not input drift.",
};
const intensityLabel = (v: number) => (v < 0.3 ? "Subtle" : v < 0.6 ? "Moderate" : v < 0.85 ? "Strong" : "Extreme");

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url; a.download = ""; document.body.appendChild(a); a.click(); a.remove();
}

function Lab() {
  const { selected, models, select } = useModel();
  const params = useSearchParams();
  const sims = useApi(() => api.simulations(), []);
  const ds = useApi(() => api.datasets(selected.id), [selected.id]);
  const history = useApi(() => api.experiments(selected.id), [selected.id]);

  const [baseline, setBaseline] = useState("baseline");
  const [source, setSource] = useState("current");
  const [sim, setSim] = useState<SimulationId>("imaging_equipment");
  const [intensity, setIntensity] = useState(0.6);
  const [seed, setSeed] = useState(42);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => { markStep("lab"); }, []);

  const resetForm = useCallback(() => { setBaseline("baseline"); setSource("current"); setSim("imaging_equipment"); setIntensity(0.6); setSeed(42); setResult(null); setError(null); setReportId(null); }, []);
  useEffect(() => { resetForm(); }, [selected.id, resetForm]);

  // Open an experiment from a link such as /drift-lab?experiment=EXP-0001
  const linked = params.get("experiment");
  useEffect(() => {
    if (!linked) return;
    let live = true;
    api.experiment(linked).then((e) => { if (live) { setResult(e); setReportId(null); if (e.config.model_id !== selected.id) select(e.config.model_id); } }).catch((e) => { if (live) setError(e); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked]);

  async function run() {
    setRunning(true); setError(null); setReportId(null);
    try {
      const r = await api.runExperiment({ model_id: selected.id, baseline_dataset_id: baseline, current_dataset_id: source, simulation: sim, intensity, seed });
      setResult(r);
      if (sim === "imaging_equipment") markStep("simulate");
      history.reload(); ds.reload();
    } catch (e) { setError(e instanceof ApiError ? e : new ApiError(String(e), 0)); }
    finally { setRunning(false); }
  }

  async function exportReport(format: "pdf" | "csv") {
    if (!result) return;
    setExporting(format);
    try {
      let id = reportId;
      if (!id) { id = (await api.createReport({ model_id: result.config.model_id, experiment_id: result.id })).id; setReportId(id); markStep("report"); }
      triggerDownload(api.reportUrl(id, format));
    } catch (e) { setError(e instanceof ApiError ? e : new ApiError(String(e), 0)); }
    finally { setExporting(null); }
  }

  const simInfo = sims.data?.find((s) => s.id === sim);
  const verdictTone = !result ? "neutral" : result.drift.overall.verdict === "none" ? "healthy" : result.drift.overall.verdict === "limited" ? "warning" : "critical";

  return (
    <>
      <PageHeader title="Drift Detection Lab" subtitle="Change the synthetic data on purpose, then see what real statistical tests detect. Input drift and performance degradation are kept as separate experiments." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ---------- Left: experiment setup ---------- */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <div className="space-y-4">
              <Field label="Model">
                <Select value={selected.id} onChange={(e) => select(e.target.value)}>{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
              </Field>
              <DatasetSelect label="Baseline dataset" value={baseline} options={ds.data?.filter((d) => d.kind !== "current") ?? []} onChange={setBaseline} hint="The reference everything is compared against." />
              <DatasetSelect label="Current dataset (starting point)" value={source} options={ds.data ?? []} onChange={setSource} hint="The simulation changes a copy of this. The original is never modified." />

              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-navy">Simulation type</legend>
                <div className="space-y-1.5">
                  {(sims.data ?? []).map((s) => (
                    <label key={s.id} className={clsx("block cursor-pointer rounded-lg border p-2.5 transition-colors", sim === s.id ? "border-primary bg-primary-soft/60" : "border-line bg-white hover:border-slate-300")}>
                      <div className="flex items-center gap-2">
                        <input type="radio" name="sim" value={s.id} checked={sim === s.id} onChange={() => setSim(s.id)} className="h-3.5 w-3.5 accent-[#246B8E]" />
                        <span className="min-w-0 flex-1 text-[13px] font-medium text-navy">{s.label}</span>
                        <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", s.kind === "performance" ? "bg-warn-soft text-warn" : "bg-info-soft text-info")}>{s.kind === "performance" ? "Performance" : "Input drift"}</span>
                        <InfoTip text={TIPS[s.id]} align="right" />
                      </div>
                      {sim === s.id && <p className="mt-1.5 pl-5 text-xs leading-4 text-muted">{s.description}</p>}
                    </label>
                  ))}
                  {sims.loading && <Skeleton className="h-40" />}
                </div>
              </fieldset>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium text-navy">Intensity</span><span className="font-medium text-primary">{intensity.toFixed(2)} · {intensityLabel(intensity)}</span></div>
                <input type="range" min={0.1} max={1} step={0.05} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} aria-label="Simulation intensity" className="w-full accent-[#246B8E]" />
                <div className="flex justify-between text-[10px] text-muted"><span>Subtle</span><span>Extreme</span></div>
              </div>

              <details className="text-xs text-muted">
                <summary className="cursor-pointer font-medium text-navy">Advanced</summary>
                <div className="mt-2"><Field label="Random seed" hint="Same seed and settings always give the same result."><input type="number" min={0} max={2147483647} value={seed} onChange={(e) => setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className="h-9 w-full rounded-lg border border-line bg-white px-3 text-sm text-navy" /></Field></div>
              </details>

              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" loading={running} onClick={run} icon={<Play className="h-4 w-4" />}>{running ? "Running…" : "Run experiment"}</Button>
                <Button onClick={resetForm} disabled={running} icon={<RotateCcw className="h-4 w-4" />} aria-label="Reset experiment">Reset</Button>
              </div>
            </div>
          </Card>
        </div>

        {/* ---------- Right: results ---------- */}
        <div className="min-w-0 space-y-6">
          {error && <ErrorState error={error} onRetry={() => setError(null)} />}
          {running && (
            <div role="status" aria-live="polite" className="space-y-4">
              <Card><div className="text-sm font-medium text-navy">Generating the changed dataset and running the statistical tests…</div><p className="mt-1 text-[13px] text-muted">KS and chi-square tests, PSI and the MMD permutation test run on the generated data.</p></Card>
              <Skeleton className="h-40" /><Skeleton className="h-72" />
            </div>
          )}
          {!running && !result && !error && (
            <>
              <EmptyState title="No experiment yet" description="Choose a simulation on the left and press Run experiment. The results will appear here." />
              <Card>
                <CardHeader title="What happens when you run an experiment" />
                <ol className="space-y-2 text-[13px] leading-5 text-muted">
                  {["The baseline dataset is loaded (never modified).", "A changed copy of the current dataset is generated using your chosen simulation.", "KS tests, PSI and an MMD test compare the two datasets on the actual generated values.", "Performance is measured separately from the same confirmed outcomes.", "If a threshold is exceeded, an alert is created, and the result is explained in plain English."].map((t, i) => (
                    <li key={i} className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">{i + 1}</span>{t}</li>
                  ))}
                </ol>
              </Card>
              <ConceptsCard />
            </>
          )}

          {!running && result && (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="eyebrow">{result.id} · {result.simulation.label} · intensity {result.config.intensity.toFixed(2)} · {dateTime(result.created_at)}</div>
                    <h2 className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-navy">{result.interpretation.headline}
                      <StatusPill tone={verdictTone} label={result.drift.overall.verdict === "none" ? "No drift flagged" : `${result.drift.overall.n_drifted} of ${result.drift.overall.n_features_tested} features flagged`} /></h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" loading={exporting === "pdf"} onClick={() => exportReport("pdf")} icon={<Download className="h-3.5 w-3.5" />}>Export PDF</Button>
                    <Button size="sm" loading={exporting === "csv"} onClick={() => exportReport("csv")} icon={<Download className="h-3.5 w-3.5" />}>Export CSV</Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2.5 text-sm leading-6 text-navy">{result.interpretation.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
                <div className="mt-4 border-t border-line pt-4">
                  <div className="eyebrow mb-2">Alerts created by this experiment</div>
                  {result.alerts.length ? (
                    <ul className="space-y-2">
                      {result.alerts.map((a) => (
                        <li key={a.id}><Link href={`/alerts?id=${a.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2.5 text-[13px] hover:bg-canvas">
                          <SeverityPill severity={a.severity} /><span className="font-medium text-navy">{a.type_label}</span><span className="text-muted">{a.id} · {a.trigger_metric}</span><span className="ml-auto font-medium text-primary">Open alert</span></Link></li>
                      ))}
                    </ul>
                  ) : <p className="text-[13px] text-muted">No thresholds were exceeded, so no alert was created.</p>}
                </div>
              </Card>

              <Card>
                <CardHeader title="What was changed" description={result.simulation.description} />
                <div className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-3">
                  <div><div className="eyebrow mb-1">Modified</div><ul className="space-y-0.5 text-navy">{result.simulation.changes.map((c) => <li key={c}>• {c}</li>)}</ul></div>
                  <div><div className="eyebrow mb-1">Held fixed</div><ul className="space-y-0.5 text-navy">{result.simulation.holds_fixed.map((c) => <li key={c}>• {c}</li>)}</ul></div>
                  <div><div className="eyebrow mb-1">Parameters</div><ul className="space-y-0.5 text-muted">{Object.entries(result.simulation.parameters).map(([k, v]) => <li key={k}>{k.replace(/_/g, " ")}: <span className="text-navy">{v}</span></li>)}</ul></div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Measured performance (separate from drift)" description="Computed from the same confirmed outcomes. Input drift does not automatically mean performance has changed." />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(["sensitivity", "specificity", "accuracy"] as const).map((k) => (
                    <div key={k} className="rounded-lg bg-canvas p-3"><div className="eyebrow capitalize">{k}</div>
                      <div className="mt-1 text-xl font-semibold text-navy">{pct(result.performance.current[k])}</div>
                      <div className="text-xs text-muted">baseline {pct(result.performance.baseline[k])} · <span className={clsx("font-medium", (result.performance.deltas[k] ?? 0) <= -0.05 ? "text-crit" : "")}>{pts(result.performance.deltas[k])}</span></div></div>
                  ))}
                </div>
                {result.simulation.kind === "input_drift" && result.simulation.id !== "patient_population" && <p className="mt-3 text-xs text-muted">Predictions and outcomes were held fixed in this experiment, so these values are not expected to move.</p>}
              </Card>

              <DriftPanel drift={result.drift} />

              <Card>
                <CardHeader title="How to read these results, and their limits" />
                <ul className="space-y-1.5 text-[13px] leading-5 text-muted">{result.interpretation.limitations.map((l, i) => <li key={i}>• {l}</li>)}</ul>
                <p className="mt-3 text-xs text-muted">Sample sizes: baseline {result.datasets.baseline.n.toLocaleString()}, current {result.datasets.current.n.toLocaleString()}. {result.alerts.length ? `Severity labels: ${result.alerts.map((a) => SEVERITY_LABEL[a.severity]).join(", ")}. ` : ""}Qualified human investigation is required before any operational decision.</p>
              </Card>
            </>
          )}

          {history.data && history.data.length > 0 && (
            <Card>
              <CardHeader title="Previous experiments for this model" />
              <ul className="divide-y divide-line">
                {history.data.slice(0, 6).map((e) => (
                  <li key={e.id}><button onClick={() => { api.experiment(e.id).then((r) => { setResult(r); setReportId(null); setError(null); }).catch(setError as never); }} className="w-full py-2.5 text-left text-[13px] hover:bg-canvas sm:-mx-2 sm:rounded-lg sm:px-2">
                    <span className="font-semibold text-navy">{e.id} · {e.simulation_label}</span> <span className="text-muted">(intensity {e.intensity.toFixed(2)}) · {e.n_drifted} of {e.n_features_tested} flagged · {dateTime(e.created_at)}</span></button></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export default function DriftLabPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Lab /></Suspense>;
}
