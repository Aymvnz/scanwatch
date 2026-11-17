"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, MessageSquarePlus, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { markStep } from "@/lib/demo";
import { dateTime, relTime, valueByFormat } from "@/lib/format";
import type { Alert, AlertStatus } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Field, Select } from "@/components/ui/Field";
import { AlertStatusPill, SeverityPill } from "@/components/ui/SeverityPill";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";

function Detail({ alert, onChanged }: { alert: Alert; onChanged: (a: Alert) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setNote(""); setErr(null); if (alert.source.experiment_id) markStep("alert"); }, [alert.id, alert.source.experiment_id]);

  async function act(kind: string, body: { status?: AlertStatus; note?: string }) {
    setBusy(kind); setErr(null);
    try {
      const updated = await api.patchAlert(alert.id, body);
      onChanged(updated);
      if (body.note || body.status === "investigating") markStep("investigate");
      if (body.note) setNote("");
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Update failed."); }
    finally { setBusy(null); }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted">{alert.id} · {alert.model_name} · {dateTime(alert.created_at)}</div>
          <h2 className="mt-1 text-lg font-semibold text-navy">{alert.type_label}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2"><SeverityPill severity={alert.severity} /><AlertStatusPill status={alert.status} />
            {alert.source.experiment_id && <Link href={`/drift-lab?experiment=${alert.source.experiment_id}`} className="text-xs font-medium text-primary hover:underline">From {alert.source.experiment_id}</Link>}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {alert.status === "open" && <Button size="sm" loading={busy === "inv"} onClick={() => act("inv", { status: "investigating" })} icon={<Search className="h-3.5 w-3.5" />}>Mark investigating</Button>}
          {alert.status !== "resolved" && <Button size="sm" variant="primary" loading={busy === "res"} onClick={() => act("res", { status: "resolved" })} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Resolve</Button>}
          {alert.status === "resolved" && <Button size="sm" loading={busy === "open"} onClick={() => act("open", { status: "open" })} icon={<RotateCcw className="h-3.5 w-3.5" />}>Reopen</Button>}
        </div>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-crit">{err}</p>}

      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[["Triggering metric", alert.trigger_metric], ["Baseline value", valueByFormat(alert.baseline_value, alert.value_format)], ["Current value", valueByFormat(alert.current_value, alert.value_format)]].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-canvas p-3"><dt className="eyebrow">{k}</dt><dd className="mt-1 text-sm font-semibold text-navy">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-5 space-y-4 text-[13px] leading-6">
        <div><div className="eyebrow mb-1">What was detected</div><p className="text-navy">{alert.explanation}</p></div>
        <div><div className="eyebrow mb-1">Suggested investigation</div><p className="text-navy">{alert.suggestion}</p></div>
      </div>
      <div className="mt-4"><Callout tone="warn" title="Human review required"><span>This alert is a statistical signal. It does not show harm and is not a recommendation to stop or change any clinical system.</span></Callout></div>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="mb-2 text-sm font-semibold text-navy">Investigation notes</h3>
        {alert.notes.length ? (
          <ul className="mb-3 space-y-2">{alert.notes.map((n) => <li key={n.id} className="rounded-lg bg-canvas p-3 text-[13px] leading-5"><div className="text-navy">{n.text}</div><div className="mt-1 text-xs text-muted">{n.author} · {dateTime(n.at)}</div></li>)}</ul>
        ) : <p className="mb-3 text-[13px] text-muted">No notes yet.</p>}
        <Field label="Add a note"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} placeholder="e.g. Checked the scanner change log for the affected hospital…" className="w-full rounded-lg border border-line bg-white p-3 text-sm text-navy placeholder:text-slate-400" /></Field>
        <Button className="mt-2" size="sm" disabled={!note.trim()} loading={busy === "note"} onClick={() => act("note", { note })} icon={<MessageSquarePlus className="h-3.5 w-3.5" />}>Add note</Button>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="mb-3 text-sm font-semibold text-navy">Alert history</h3>
        <ol className="space-y-3 border-l border-line pl-4">
          {[...alert.history].reverse().map((h, i) => (
            <li key={i} className="relative text-[13px] leading-5"><span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
              <div className="font-medium capitalize text-navy">{h.event.replace(/_/g, " ")}</div><div className="text-muted">{h.detail}</div><div className="text-xs text-muted">{h.author} · {dateTime(h.at)}</div></li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

function Alerts() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [model, setModel] = useState("");
  const { data, error, loading, reload } = useApi(() => api.alerts({ status, severity, model_id: model }), [status, severity, model]);
  const [local, setLocal] = useState<Record<string, Alert>>({});
  const selectedId = params.get("id");

  const rows = useMemo(() => (data ?? []).map((a) => local[a.id] ?? a), [data, local]);
  const selected = rows.find((a) => a.id === selectedId) ?? null;
  const [direct, setDirect] = useState<Alert | null>(null);
  useEffect(() => { // alert linked directly but hidden by the current filters
    setDirect(null);
    if (selectedId && data && !data.some((a) => a.id === selectedId)) api.alerts({}).then((all) => setDirect(all.find((a) => a.id === selectedId) ?? null)).catch(() => undefined);
  }, [selectedId, data]);
  const shown = selected ?? (direct ? (local[direct.id] ?? direct) : null);

  const pick = (id: string) => router.replace(`/alerts?id=${id}`, { scroll: false });
  const changed = (a: Alert) => { setLocal((l) => ({ ...l, [a.id]: a })); reload(); };

  return (
    <>
      <PageHeader title="Alerts" subtitle="Review, investigate and resolve alerts created by monitoring checks and Drift Lab experiments. Alerts call for qualified human review, never automatic action." />
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option></Select></Field>
          <Field label="Severity"><Select value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="">All severities</option><option value="info">Informational</option><option value="warning">Warning</option><option value="critical">Critical</option></Select></Field>
          <Field label="Model"><Select value={model} onChange={(e) => setModel(e.target.value)}><option value="">All models</option><option value="chest-xray-classifier">Chest X-ray Classifier</option><option value="lung-finding-classifier">Lung Finding Classifier</option><option value="imaging-triage-model">Imaging Triage Model</option></Select></Field>
        </div>
      </Card>
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : !data ? <Skeleton className="h-96" /> : (
        <div className={clsx("grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]", loading && "opacity-70 transition-opacity")}>
          <div>
            <Card padded={false}>
              <div className="border-b border-line p-4"><CardHeader title={`${rows.length} alert${rows.length === 1 ? "" : "s"}`} description="Select an alert to see details." /></div>
              {rows.length ? (
                <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
                  {rows.map((a) => (
                    <li key={a.id}>
                      <button onClick={() => pick(a.id)} aria-current={shown?.id === a.id} className={clsx("w-full p-4 text-left hover:bg-canvas", shown?.id === a.id && "bg-primary-soft/60")}>
                        <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold text-navy">{a.type_label}</span></div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2"><SeverityPill severity={a.severity} /><AlertStatusPill status={a.status} /></div>
                        <div className="mt-1.5 text-xs text-muted">{a.id} · {a.model_name} · {relTime(a.created_at)}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <div className="p-4"><EmptyState title="No alerts match" description={status || severity || model ? "Try clearing a filter." : "Run an experiment in the Drift Detection Lab to create one."} action={<Link href="/drift-lab" className="text-sm font-medium text-primary hover:underline">Open the Lab</Link>} /></div>}
            </Card>
          </div>
          <div className="min-w-0">
            {shown ? <Detail alert={shown} onChanged={changed} /> : (
              <EmptyState title="Select an alert" description="Choose an alert from the list to read what was detected, suggested next steps and its history." action={<ShieldAlert className="h-6 w-6 text-slate-300" aria-hidden />} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function AlertsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Alerts /></Suspense>;
}
