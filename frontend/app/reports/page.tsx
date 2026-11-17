"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { markStep } from "@/lib/demo";
import { dateTime, int, pct } from "@/lib/format";
import type { ReportData } from "@/lib/types";
import { useModel } from "@/components/layout/ModelContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { DatasetSelect } from "@/components/ui/Filters";
import { Field, Select } from "@/components/ui/Field";
import { ModelBanner } from "@/components/ui/ModelBanner";
import { EmptyState, ErrorState } from "@/components/ui/States";

function download(url: string) {
  const a = document.createElement("a"); a.href = url; a.download = ""; document.body.appendChild(a); a.click(); a.remove();
}

export default function ReportsPage() {
  const { selected } = useModel();
  const [days, setDays] = useState("");
  const [baseline, setBaseline] = useState("baseline");
  const [current, setCurrent] = useState("current");
  const [experiment, setExperiment] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const ds = useApi(() => api.datasets(selected.id), [selected.id]);
  const exps = useApi(() => api.experiments(selected.id), [selected.id]);
  const history = useApi(() => api.reports(), []);
  useEffect(() => { setBaseline("baseline"); setCurrent("current"); setExperiment(""); setReport(null); }, [selected.id]);

  async function generate() {
    setBusy(true); setError(null);
    try {
      const r = await api.createReport({ model_id: selected.id, days: days ? Number(days) : null, baseline_dataset_id: baseline, current_dataset_id: current, experiment_id: experiment || null });
      setReport(r); markStep("report"); history.reload();
    } catch (e) { setError(e instanceof ApiError ? e : new ApiError(String(e), 0)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate a branded monitoring report from synthetic results and export it as PDF or CSV." />
      <ModelBanner />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <div className="space-y-4">
              <Field label="Based on" hint="Choose an experiment to report on its results, or leave on monitoring data.">
                <Select value={experiment} onChange={(e) => setExperiment(e.target.value)}>
                  <option value="">Monitoring data (datasets below)</option>
                  {(exps.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.id}: {e.simulation_label}</option>)}
                </Select>
              </Field>
              <Field label="Reporting period"><Select value={days} onChange={(e) => setDays(e.target.value)} disabled={!!experiment}>
                <option value="">Full current period</option><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90">Last 90 days</option></Select></Field>
              <DatasetSelect label="Baseline dataset" value={baseline} options={ds.data?.filter((d) => d.kind !== "current") ?? []} onChange={setBaseline} />
              <DatasetSelect label="Current dataset" value={current} options={ds.data ?? []} onChange={setCurrent} />
              <Button variant="primary" className="w-full" loading={busy} onClick={generate} icon={<FileText className="h-4 w-4" />}>Generate report</Button>
              <p className="text-[11px] leading-4 text-muted">Reports include performance, drift results, subgroup comparisons, alerts, investigation history, methodology and data limitations.</p>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {error && <ErrorState error={error} onRetry={() => setError(null)} />}
          {report ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="eyebrow">{report.id} · generated {dateTime(report.created_at)}</div><h2 className="mt-1 text-lg font-semibold text-navy">{report.model.name}</h2>
                  <p className="text-[13px] text-muted">{report.period.start} to {report.period.end}</p></div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => download(api.reportUrl(report.id, "pdf"))} icon={<Download className="h-3.5 w-3.5" />}>Download PDF</Button>
                  <Button size="sm" onClick={() => download(api.reportUrl(report.id, "csv"))} icon={<Download className="h-3.5 w-3.5" />}>Download CSV</Button>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Sensitivity", pct(report.performance.current.sensitivity)], ["Specificity", pct(report.performance.current.specificity)],
                  ["Features flagged", `${report.drift.overall.n_drifted} of ${report.drift.overall.n_features_tested}`], ["Alerts on file", String(report.alerts.length)]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-canvas p-3"><dt className="eyebrow">{k}</dt><dd className="mt-1 text-lg font-semibold text-navy">{v}</dd></div>))}
              </dl>
              <div className="mt-4 grid grid-cols-1 gap-3 text-[13px] text-muted sm:grid-cols-2">
                <div>Baseline: {report.datasets.baseline.label} ({int(report.datasets.baseline.n)} records)</div>
                <div>Current: {report.datasets.current.label} ({int(report.datasets.current.n)} records)</div>
              </div>
              <div className="mt-4"><Callout tone="warn" title="Disclaimer">{report.disclaimer}</Callout></div>
            </Card>
          ) : !error && <EmptyState title="No report generated yet" description="Choose what to include on the left and press Generate report." />}

          <Card>
            <CardHeader title="Report history" description="Reports stay available to download until you reset the demo." />
            {history.data && history.data.length ? (
              <ul className="divide-y divide-line">
                {history.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1 text-[13px]"><div className="font-semibold text-navy">{r.id} · {r.model_name}</div>
                      <div className="text-xs text-muted">{r.experiment_id ? `Experiment ${r.experiment_id}` : "Monitoring data"} · {r.period.start} to {r.period.end} · {dateTime(r.created_at)}</div></div>
                    <Button size="sm" onClick={() => download(api.reportUrl(r.id, "pdf"))} icon={<Download className="h-3.5 w-3.5" />}>PDF</Button>
                    <Button size="sm" onClick={() => download(api.reportUrl(r.id, "csv"))} icon={<Download className="h-3.5 w-3.5" />}>CSV</Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-muted">No reports yet.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
