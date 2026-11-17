"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Boxes, FlaskConical, Gauge, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { markStep } from "@/lib/demo";
import { MODEL_COLORS, pct, relTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { DaysSelect, SiteSelect, daysToNumber, type DaysValue } from "@/components/ui/Filters";
import { ErrorState, PageSkeleton, EmptyState } from "@/components/ui/States";
import { GroupedBars, SeverityBars, TrendChart } from "@/components/charts/Charts";
import { AlertRows } from "@/components/panels/AlertRows";
import { GuidedDemoCard } from "@/components/onboarding/GuidedDemoCard";
import { ModelSelector } from "@/components/layout/ModelSelector";

export default function OverviewPage() {
  const [days, setDays] = useState<DaysValue>("all");
  const [site, setSite] = useState("all");
  const { data, error, loading, reload } = useApi(() => api.overview({ days: daysToNumber(days), site }), [days, site]);
  useEffect(() => { markStep("dashboard"); }, []);

  const header = (
    <PageHeader
      title="Medical AI Monitoring Overview"
      subtitle="A simulated monitoring environment. Every model, record and metric here is synthetic and shows how hospitals could watch imaging AI after deployment."
      actions={<>
        <div className="w-44"><DaysSelect value={days} onChange={setDays} /></div>
        <div className="w-40"><SiteSelect value={site} onChange={setSite} /></div>
      </>}
    />
  );
  if (error && !data) return <>{header}<ErrorState error={error} onRetry={reload} /></>;
  if (!data) return <>{header}<PageSkeleton /></>;

  const models = data.models;
  const series = models.map((m) => ({ key: m.id, name: m.name, color: MODEL_COLORS[m.id] }));
  const groups = Array.from(new Set(data.subgroup_performance.map((s) => s.group)));
  const subData = groups.map((g) => ({
    name: g, ...Object.fromEntries(data.subgroup_performance.filter((s) => s.group === g).map((s) => [s.model_id, s.sensitivity])),
  }));
  const lowSample = data.subgroup_performance.filter((s) => s.low_sample).length;
  const m = data.metrics;

  return (
    <div className={loading ? "opacity-70 transition-opacity" : ""}>
      {header}
      <GuidedDemoCard />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Monitored models" value={m.monitored_models} sub="Fictional demonstration models" icon={<Boxes className="h-4 w-4 text-primary" />} />
        <MetricCard label="Healthy models" value={m.healthy_models} sub={`${m.monitored_models - m.healthy_models} need attention`} icon={<Gauge className="h-4 w-4 text-ok" />} tip="A model is healthy when it has no open warning or critical alerts. Resolving alerts restores it." />
        <MetricCard label="Active alerts" value={m.active_alerts} sub="Open or under investigation" icon={<AlertTriangle className="h-4 w-4 text-warn" />} />
        <MetricCard label="Experiments run" value={m.experiments_run} sub={m.experiments_run ? "In the Drift Detection Lab" : "Run one in the Drift Lab"} icon={<FlaskConical className="h-4 w-4 text-primary" />} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Model performance over time" description="Weekly sensitivity: how often each model catches confirmed findings. Based on synthetic predictions and confirmed labels." />
          {data.performance_trend.length > 1 ? <TrendChart data={data.performance_trend} series={series} domain={[0.5, 1]} /> : <EmptyState title="Not enough weeks" description="Choose a longer date range." />}
        </Card>
        <Card>
          <CardHeader title="Data drift status over time" description="Average PSI of each week’s data versus the baseline. Above the dashed 0.10 line suggests a moderate shift worth a look." />
          {data.drift_trend.length > 1 ? <TrendChart data={data.drift_trend} series={series} format={(v) => v.toFixed(2)} domain={[0, "auto"]} refLines={[{ y: 0.1, label: "Moderate 0.10" }, { y: 0.25, label: "Large 0.25", color: "#C0392B" }]} /> : <EmptyState title="Not enough weeks" description="Choose a longer date range." />}
        </Card>
        <Card>
          <CardHeader title="Alerts by severity" description="Active alerts only. Informational alerts do not change a model’s health status." />
          <SeverityBars counts={data.alerts_by_severity} />
        </Card>
        <Card>
          <CardHeader title="Patient subgroup performance" description="Sensitivity by age group and care setting for each model." action={<Link href="/patient-safety" className="text-xs font-medium text-primary hover:underline">Details</Link>} />
          <GroupedBars data={subData} series={series} height={220} />
          {lowSample > 0 && <p className="mt-2 text-xs text-warn">Some groups have few cases in this selection; see Patient Safety for sample counts.</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Monitored models" description="Status is derived from each model’s open alerts." action={<div className="w-48 lg:hidden"><ModelSelector /></div>} />
          <ul className="divide-y divide-line">
            {models.map((mo) => (
              <li key={mo.id}>
                <Link href={`/models/${mo.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-canvas sm:-mx-2 sm:rounded-lg sm:px-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-navy">{mo.name}</div>
                    <div className="text-xs text-muted">{mo.identifier} · {mo.version} · sensitivity {pct(mo.latest.sensitivity)} · specificity {pct(mo.latest.specificity)}</div>
                  </div>
                  <StatusPill tone={mo.status} />
                  <ArrowRight className="hidden h-4 w-4 text-slate-300 sm:block" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col justify-between !border-primary bg-primary text-white">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/70"><FlaskConical className="h-3.5 w-3.5" />Quick action</div>
            <h3 className="mt-2 text-lg font-semibold">Open the Drift Detection Lab</h3>
            <p className="mt-1.5 text-[13px] leading-5 text-white/80">Simulate an equipment, population or workflow change and see what real statistical tests detect.</p>
          </div>
          <Link href="/drift-lab" className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-primary hover:bg-primary-soft">Open Lab <ArrowRight className="h-4 w-4" /></Link>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Recent alerts" action={<Link href="/alerts" className="text-xs font-medium text-primary hover:underline">All alerts</Link>} />
          <AlertRows alerts={data.recent_alerts} empty="No alerts yet" />
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          {data.recent_activity.length ? (
            <ul className="space-y-3">
              {data.recent_activity.map((a) => (
                <li key={a.id} className="flex gap-2.5 text-[13px]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  <div className="min-w-0">
                    {a.link ? <Link href={a.link} className="leading-5 text-navy hover:text-primary hover:underline">{a.text}</Link> : <span className="leading-5 text-navy">{a.text}</span>}
                    <div className="text-xs text-muted">{relTime(a.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No activity yet" description="Experiments, alert changes and reports show up here." />}
        </Card>
      </div>
    </div>
  );
}
