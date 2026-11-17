import clsx from "clsx";
import type { ReactNode } from "react";
import { Card } from "./Card";
import { InfoTip } from "./InfoTip";

export function MetricCard({ label, value, sub, tip, delta, deltaGoodWhen = "up", icon }: {
  label: string; value: ReactNode; sub?: ReactNode; tip?: string; delta?: { text: string; value: number | null } | null; deltaGoodWhen?: "up" | "down"; icon?: ReactNode;
}) {
  let tone = "text-muted";
  if (delta && delta.value !== null && Math.abs(delta.value) >= 0.005) {
    const good = deltaGoodWhen === "up" ? delta.value > 0 : delta.value < 0;
    tone = good ? "text-ok" : "text-crit";
  }
  return (
    <Card className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow flex items-center gap-1">{label}{tip && <InfoTip text={tip} align="left" />}</div>
        {icon}
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-navy">{value}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        {delta && <span className={clsx("font-medium", tone)}>{delta.text}</span>}
        {sub}
      </div>
    </Card>
  );
}
