"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import type { DriftFeature, DriftResult } from "@/lib/types";
import { num, pct, pval } from "@/lib/format";
import { Card, CardHeader } from "../ui/Card";
import { OverlayHistogram, PsiBars } from "../charts/Charts";
import { InfoTip } from "../ui/InfoTip";
import { MetricCard } from "../ui/MetricCard";
import { StatusPill } from "../ui/StatusPill";

function PsiMeter({ psi, drifted }: { psi: number | null; drifted: boolean }) {
  if (psi === null) return <span className="text-muted">—</span>;
  const w = Math.min(100, (psi / 0.5) * 100);
  const color = !drifted ? "bg-slate-300" : psi >= 0.25 ? "bg-crit" : "bg-warn";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100" aria-hidden><div className={clsx("h-full rounded-full", color)} style={{ width: `${w}%` }} /></div>
      <span className="tabular-nums">{psi.toFixed(3)}</span>
    </div>
  );
}

function valueText(f: DriftFeature) {
  if (f.reference_value === null || f.current_value === null) return "—";
  return f.kind === "missingness" ? `${pct(f.reference_value)} → ${pct(f.current_value)}` : `${f.reference_value.toFixed(f.reference_value > 50 ? 1 : 2)} → ${f.current_value.toFixed(f.current_value > 50 ? 1 : 2)}`;
}

export function DriftPanel({ drift, compact }: { drift: DriftResult; compact?: boolean }) {
  const top = useMemo(() => [...drift.features].filter((f) => f.psi !== null).sort((a, b) => (b.psi ?? 0) - (a.psi ?? 0))[0]?.feature, [drift]);
  const [sel, setSel] = useState<string | undefined>(top);
  useEffect(() => setSel(top), [top]);
  const feature = drift.features.find((f) => f.feature === sel) ?? drift.features[0];
  const o = drift.overall, mmd = drift.mmd;
  const psiData = [...drift.features].filter((f) => f.psi !== null).sort((a, b) => (b.psi ?? 0) - (a.psi ?? 0)).map((f) => ({ name: f.label, psi: f.psi as number, drifted: f.drifted }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Features flagged" tip="A feature is flagged only when its Bonferroni-adjusted test is significant AND the shift is practically meaningful (PSI ≥ 0.10, or a ≥ 2-point change in a missing rate)."
          value={`${o.n_drifted} of ${o.n_features_tested}`} sub={o.verdict === "none" ? "No drift detected" : o.verdict === "limited" ? "Limited drift" : "Widespread drift"} />
        <MetricCard label="Largest PSI" tip="Population Stability Index. Under 0.10 is small, 0.10–0.25 moderate, over 0.25 large. Conventions, not clinical thresholds." value={num(o.max_psi, 2)} sub={o.max_psi_feature ?? ""} />
        <MetricCard label="MMD (joint test)" tip="Maximum Mean Discrepancy compares the image features, age and prediction score together using an RBF kernel and a permutation test."
          value={mmd.available ? num(mmd.statistic, 4) : "unavailable"} sub={mmd.available ? `permutation p = ${pval(mmd.p_value)}` : mmd.reason} />
        <MetricCard label="Sample sizes" tip="Both datasets are used in full for KS, PSI and chi-square. MMD uses random subsamples for speed." value={`${o.n_reference.toLocaleString()} / ${o.n_current.toLocaleString()}`}
          sub={`baseline / current · adj. α ${o.alpha_adjusted.toFixed(4)}`} />
      </div>

      <Card padded={false}>
        <div className="p-5 pb-3"><CardHeader title="Feature-level results" description="Click a row to see its baseline-versus-current distribution. p-values are Bonferroni-adjusted for the number of features compared." /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-y border-line bg-canvas text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2 font-semibold">Feature</th><th className="px-3 py-2 font-semibold">Test</th>
                <th className="px-3 py-2 font-semibold">Baseline → current</th><th className="px-3 py-2 font-semibold">Statistic</th>
                <th className="px-3 py-2 font-semibold">p (adj.)</th><th className="px-3 py-2 font-semibold">PSI <InfoTip text="Population Stability Index with reference-based deciles and smoothing for empty bins." align="right" /></th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {drift.features.map((f) => (
                <tr key={f.feature} onClick={() => setSel(f.feature)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(f.feature); } }}
                  aria-selected={sel === f.feature} className={clsx("cursor-pointer border-b border-line last:border-0 hover:bg-canvas", sel === f.feature && "bg-primary-soft/60")}>
                  <td className="px-5 py-2.5 font-medium text-navy">{f.label}</td>
                  <td className="px-3 py-2.5 text-muted">{f.test}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{valueText(f)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{num(f.statistic, 3)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{pval(f.p_adjusted)}</td>
                  <td className="px-3 py-2.5"><PsiMeter psi={f.psi} drifted={f.drifted} /></td>
                  <td className="px-3 py-2.5">{f.drifted ? <StatusPill tone={f.severity === "significant" ? "critical" : "warning"} label={f.severity === "significant" ? "Large shift" : "Moderate shift"} /> : <StatusPill tone="healthy" label="Stable" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {!compact && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Drift severity by feature" description="PSI per feature. Dashed lines mark 0.10 (moderate) and 0.25 (large). Grey bars did not meet the flagging criteria." />
            <PsiBars data={psiData} />
          </Card>
          {feature && (
            <Card>
              <CardHeader title={`${feature.label}: baseline vs current`} description={feature.kind === "missingness" ? "Share of records with the value present or missing." : "Share of records at each value. The overlap shows what has not changed."} />
              <OverlayHistogram data={feature.histogram} />
            </Card>
          )}
        </div>
      )}
      {compact && feature && (
        <Card>
          <CardHeader title={`${feature.label}: baseline vs current`} />
          <OverlayHistogram data={feature.histogram} />
        </Card>
      )}
    </div>
  );
}
