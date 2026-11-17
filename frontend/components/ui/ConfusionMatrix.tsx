import clsx from "clsx";
import type { Metrics } from "@/lib/types";
import { int } from "@/lib/format";

export function ConfusionMatrix({ m, title }: { m: Metrics; title: string }) {
  const cell = (label: string, value: number, good: boolean, rowTotal: number) => (
    <div className={clsx("rounded-lg border p-3 text-center", good ? "border-ok/20 bg-ok-soft" : "border-crit/20 bg-crit-soft")}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-navy">{int(value)}</div>
      <div className="text-[11px] text-muted">{rowTotal ? ((value / rowTotal) * 100).toFixed(1) : "0.0"}% of row</div>
    </div>
  );
  return (
    <div>
      <div className="mb-2 text-[13px] font-semibold text-navy">{title}</div>
      <div className="grid grid-cols-[auto_1fr_1fr] items-stretch gap-2 text-xs">
        <div />
        <div className="text-center font-medium text-muted">Model: positive</div>
        <div className="text-center font-medium text-muted">Model: negative</div>
        <div className="flex items-center font-medium text-muted [writing-mode:vertical-rl] rotate-180 justify-center">Confirmed positive</div>
        {cell("True positive", m.tp, true, m.tp + m.fn)}
        {cell("False negative", m.fn, false, m.tp + m.fn)}
        <div className="flex items-center font-medium text-muted [writing-mode:vertical-rl] rotate-180 justify-center">Confirmed negative</div>
        {cell("False positive", m.fp, false, m.fp + m.tn)}
        {cell("True negative", m.tn, true, m.fp + m.tn)}
      </div>
    </div>
  );
}
