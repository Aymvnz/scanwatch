"use client";

import type { MetricKey, PerformanceResponse } from "@/lib/types";
import { int, num, pct, pts } from "@/lib/format";
import { Card, CardHeader } from "../ui/Card";
import { MetricCard } from "../ui/MetricCard";
import { ConfusionMatrix } from "../ui/ConfusionMatrix";
import { CalibrationChart, TrendChart } from "../charts/Charts";
import { Callout } from "../ui/Callout";
import { InfoTip } from "../ui/InfoTip";
import { EmptyState } from "../ui/States";

const CARDS: { key: MetricKey; label: string; defKey: string; goodWhen: "up" | "down" }[] = [
  { key: "sensitivity", label: "Sensitivity", defKey: "sensitivity", goodWhen: "up" },
  { key: "specificity", label: "Specificity", defKey: "specificity", goodWhen: "up" },
  { key: "accuracy", label: "Accuracy", defKey: "accuracy", goodWhen: "up" },
  { key: "precision", label: "Precision", defKey: "precision", goodWhen: "up" },
  { key: "fnr", label: "False-negative rate", defKey: "fnr", goodWhen: "down" },
  { key: "fpr", label: "False-positive rate", defKey: "fpr", goodWhen: "down" },
  { key: "f1", label: "F1 score", defKey: "f1", goodWhen: "up" },
];

export function PerformancePanel({ perf }: { perf: PerformanceResponse }) {
  const b = perf.baseline.metrics, c = perf.current.metrics;
  const ci = (v: [number, number] | null) => (v ? `95% CI ${(v[0] * 100).toFixed(0)}–${(v[1] * 100).toFixed(0)}%` : "");
  const trend = perf.trend.map((w) => ({ week: w.week, sensitivity: w.sensitivity, specificity: w.specificity }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((k) => (
          <MetricCard key={k.key} label={k.label} tip={perf.definitions[k.defKey]} value={pct(c[k.key])}
            delta={{ text: `${pts(perf.deltas[k.key])} vs baseline`, value: perf.deltas[k.key] }} deltaGoodWhen={k.goodWhen}
            sub={<span>baseline {pct(b[k.key])}{k.key === "sensitivity" && c.sensitivity_ci ? ` · ${ci(c.sensitivity_ci)}` : k.key === "specificity" && c.specificity_ci ? ` · ${ci(c.specificity_ci)}` : ""}</span>} />
        ))}
        <MetricCard label="Calibration (ECE)" tip={perf.definitions.calibration} value={num(c.calibration?.ece, 3)}
          delta={c.calibration && b.calibration ? { text: `${(c.calibration.ece - b.calibration.ece >= 0 ? "+" : "") + (c.calibration.ece - b.calibration.ece).toFixed(3)} vs baseline`, value: c.calibration.ece - b.calibration.ece } : null}
          deltaGoodWhen="down" sub={<span>Brier {num(c.calibration?.brier, 3)} · lower is better</span>} />
      </div>

      <Card>
        <CardHeader title="Dataset sample sizes" description="Metrics from small samples swing widely by chance, so check these before trusting a difference." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([["Baseline", perf.baseline, b], ["Current", perf.current, c]] as const).map(([name, side, m]) => (
            <div key={name} className="rounded-lg bg-canvas p-3 text-[13px]">
              <div className="font-semibold text-navy">{name}: {int(m.n)} records</div>
              <div className="mt-0.5 text-muted">{side.dataset.label}</div>
              <div className="mt-0.5 text-muted">{side.dataset.start} to {side.dataset.end}</div>
              <div className="mt-1 text-muted">{int(m.positives)} confirmed positive · {int(m.negatives)} confirmed negative</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><ConfusionMatrix m={b} title="Baseline confusion matrix" /></Card>
        <Card><ConfusionMatrix m={c} title="Current confusion matrix" /></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Weekly sensitivity and specificity" description="Each point is one week of the current period (weeks with fewer than 40 cases are hidden). Dashed lines show the baseline." />
          {trend.length >= 2 ? (
            <TrendChart data={trend} domain={[0.5, 1]} series={[{ key: "sensitivity", name: "Sensitivity", color: "#246B8E" }, { key: "specificity", name: "Specificity", color: "#1B998B" }]}
              refLines={[...(b.sensitivity !== null ? [{ y: b.sensitivity, label: "Baseline sensitivity", color: "#246B8E" }] : []), ...(b.specificity !== null ? [{ y: b.specificity, label: "Baseline specificity", color: "#1B998B" }] : [])]} />
          ) : <EmptyState title="Not enough weekly data" description="Select a longer date range to see a trend." />}
        </Card>
        <Card>
          <CardHeader title="Calibration" description="Do predicted scores match what actually happened? Points near the dashed line mean yes." />
          {c.calibration ? <CalibrationChart bins={c.calibration.bins} /> : <EmptyState title="Unavailable" description="No records." />}
        </Card>
      </div>

      <Callout tone="warn" title="Performance needs outcome labels">{perf.label_note}</Callout>
    </div>
  );
}

export function WhyItMatters({ children }: { children: React.ReactNode }) {
  return <Callout tone="why" title="Why does this matter?">{children}</Callout>;
}
