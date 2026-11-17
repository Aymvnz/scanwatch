"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { dateTime } from "@/lib/format";
import { useModel } from "@/components/layout/ModelContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/States";
import { PerformancePanel } from "@/components/panels/PerformancePanel";
import { DriftPanel } from "@/components/panels/DriftPanel";
import { SubgroupPanel } from "@/components/panels/SubgroupPanel";
import { AlertRows } from "@/components/panels/AlertRows";
import { Callout } from "@/components/ui/Callout";

type Tab = "overview" | "performance" | "drift" | "subgroups" | "experiments" | "alerts";

export default function ModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { models, select } = useModel();
  const [tab, setTab] = useState<Tab>("overview");
  const { data, error, reload } = useApi(() => api.model(id), [id]);
  useEffect(() => { if (models.some((m) => m.id === id)) select(id); }, [id, models, select]);

  const back = <Link href="/models" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-navy"><ArrowLeft className="h-3.5 w-3.5" />All models</Link>;
  if (error && !data) return <>{back}<ErrorState error={error} onRetry={reload} /></>;
  if (!data) return <>{back}<PageSkeleton /></>;
  const s = data.summary;
  return (
    <>
      {back}
      <PageHeader title={s.name} subtitle={s.purpose} actions={<StatusPill tone={s.status} />} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "overview", label: "Overview" }, { id: "performance", label: "Performance" }, { id: "drift", label: "Drift results" },
        { id: "subgroups", label: "Subgroups" }, { id: "experiments", label: `Experiments (${data.experiments.length})` }, { id: "alerts", label: `Alerts (${data.alerts.length})` },
      ]} />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Model details" />
            <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3">
              {[["Identifier", s.identifier], ["Version", s.version], ["Modality", s.modality], ["Last monitored", s.last_monitored], ["Open alerts", String(s.open_alerts)], ["Records monitored", s.latest.n.toLocaleString()]].map(([k, v]) => (
                <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-0.5 text-navy">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-4 border-t border-line pt-4 text-[13px] leading-5 text-muted">{s.name} is a fictional demonstration model. It is not a validated medical device, and its outputs must never inform patient care.</p>
          </Card>
          <Card>
            <CardHeader title="Open alerts" />
            <AlertRows alerts={data.alerts.filter((a) => a.status !== "resolved").slice(0, 3)} empty="No open alerts" />
          </Card>
        </div>
      )}
      {tab === "performance" && <PerformancePanel perf={data.performance} />}
      {tab === "drift" && (
        <div className="space-y-4">
          <Callout title="Scheduled monitoring check">Baseline (Jun–Aug 2026) versus the current period (Sep–Nov 2026). Run your own what-if scenarios in the <Link href="/drift-lab" className="font-medium text-primary hover:underline">Drift Detection Lab</Link>.</Callout>
          <DriftPanel drift={data.drift} compact />
        </div>
      )}
      {tab === "subgroups" && <SubgroupPanel data={data.subgroups} />}
      {tab === "experiments" && (
        <Card>
          <CardHeader title="Experiment history" />
          {data.experiments.length ? (
            <ul className="divide-y divide-line">
              {data.experiments.map((e) => (
                <li key={e.id}>
                  <Link href={`/drift-lab?experiment=${e.id}`} className="flex flex-col gap-1 py-3 hover:bg-canvas sm:-mx-2 sm:rounded-lg sm:px-2">
                    <div className="text-[13px] font-semibold text-navy">{e.id} · {e.simulation_label} (intensity {e.intensity.toFixed(2)})</div>
                    <div className="text-xs text-muted">{e.headline} · {e.n_drifted} of {e.n_features_tested} features flagged · {e.alert_ids.length} alert(s) · {dateTime(e.created_at)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No experiments yet" description="Open the Drift Detection Lab to run one for this model." action={<Link href="/drift-lab" className="text-sm font-medium text-primary hover:underline">Open the Lab</Link>} />}
        </Card>
      )}
      {tab === "alerts" && <Card><CardHeader title="Alert history" /><AlertRows alerts={data.alerts} empty="No alerts for this model" /></Card>}
    </>
  );
}
