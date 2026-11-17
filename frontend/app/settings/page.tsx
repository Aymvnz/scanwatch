"use client";

import { CircleHelp, Database } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { ResetDemoButton } from "@/components/layout/ResetDemo";
import { openTour } from "@/components/onboarding/Tour";
import { GlossaryList } from "@/components/onboarding/Glossary";

const SWATCHES = [["Background", "#F7F9FC", "bg-canvas"], ["Card", "#FFFFFF", "bg-white"], ["Primary", "#246B8E", "bg-primary"], ["Navy text", "#18354A", "bg-navy"], ["Muted text", "#5F7587", "bg-muted"], ["Healthy", "#1F8A5B", "bg-ok"], ["Warning", "#B7791F", "bg-warn"], ["Critical", "#C0392B", "bg-crit"]];

const THRESHOLD_LABELS: Record<string, [string, string]> = {
  alpha: ["Significance level (family-wise)", "Divided across all compared features (Bonferroni)."],
  psi_moderate: ["PSI: moderate shift", "A feature needs at least this PSI, plus a significant test, to be flagged."],
  psi_significant: ["PSI: large shift", "Marks a large distribution shift."],
  min_missing_shift: ["Missing-rate change to flag", "Absolute change in a missing-value rate."],
  drift_share_critical: ["Share of features for critical drift", "With a large PSI, this share of features flagged makes a drift alert critical."],
  perf_drop_warning: ["Performance drop: warning", "Absolute drop in sensitivity or specificity (also needs statistical support)."],
  perf_drop_critical: ["Performance drop: critical", "Absolute drop in sensitivity or specificity."],
  subgroup_gap_warning: ["Subgroup sensitivity gap: warning", "Gap below overall sensitivity, for groups with enough samples."],
  subgroup_gap_critical: ["Subgroup sensitivity gap: critical", ""],
  missing_increase_warning: ["Missing data increase: warning", "Absolute increase in a missing-value rate."],
  missing_increase_critical: ["Missing data increase: critical", ""],
  min_positives: ["Minimum confirmed positives", "Below this, sensitivity is flagged as unreliable."],
  min_negatives: ["Minimum confirmed negatives", "Below this, specificity is flagged as unreliable."],
  min_subgroup_n: ["Minimum cases per subgroup", ""],
};

export default function SettingsPage() {
  const { data, error, reload } = useApi(() => api.config(), []);
  return (
    <>
      <PageHeader title="Settings" subtitle="Workspace, alert thresholds, data storage and help. No sign-in or API keys are needed." />
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Workspace and data" />
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3"><dt className="text-muted">Workspace</dt><dd className="font-medium text-navy">Demo Hospital Network</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Data</dt><dd className="font-medium text-navy">Synthetic only, deterministic seeds</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-1.5 text-muted"><Database className="h-3.5 w-3.5" />Persistence</dt>
                <dd>{data ? <StatusPill tone="info" label={data.persistence === "supabase" ? "Supabase (mirrored)" : "Local file (no setup needed)"} /> : <span className="text-muted">…</span>}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Demo" description="Start over or replay the introduction." />
            <div className="flex flex-wrap gap-2"><ResetDemoButton /><Button onClick={openTour} icon={<CircleHelp className="h-4 w-4" />}>Replay the tour</Button></div>
          </Card>
        </div>

        <Card padded={false}>
          <div className="p-5 pb-3"><CardHeader title="Alert thresholds" description="Read-only in this prototype. Alerts are produced by comparing measured values with these settings." /></div>
          {error && !data ? <div className="p-5"><ErrorState error={error} onRetry={reload} /></div> : !data ? <div className="p-5"><Skeleton className="h-48" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead className="border-y border-line bg-canvas text-[11px] uppercase tracking-wide text-muted"><tr><th className="px-5 py-2 font-semibold">Setting</th><th className="px-3 py-2 font-semibold">Value</th><th className="px-3 py-2 font-semibold">Meaning</th></tr></thead>
                <tbody>{Object.entries(data.thresholds).map(([k, v]) => (
                  <tr key={k} className="border-b border-line last:border-0"><td className="px-5 py-2.5 font-medium text-navy">{THRESHOLD_LABELS[k]?.[0] ?? k}</td><td className="px-3 py-2.5 tabular-nums">{v}</td><td className="px-3 py-2.5 text-muted">{THRESHOLD_LABELS[k]?.[1]}</td></tr>))}</tbody>
              </table>
            </div>
          )}
        </Card>

        <Card><CardHeader title="Glossary" description="Plain-English definitions of the terms used throughout ScanWatch." /><GlossaryList /></Card>

        <Card>
          <CardHeader title="Visual system" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {SWATCHES.map(([n, h, c]) => <div key={n}><div className={`h-10 rounded-lg border border-line ${c}`} /><div className="mt-1 truncate text-xs font-medium text-navy">{n}</div><div className="text-[11px] text-muted">{h}</div></div>)}
          </div>
        </Card>
      </div>
    </>
  );
}
