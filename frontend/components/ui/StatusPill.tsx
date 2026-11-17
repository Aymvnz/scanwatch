import clsx from "clsx";
import type { MonitoringStatus } from "@/lib/models";

export type Tone = MonitoringStatus | "info" | "neutral";

const TONES: Record<Tone, { wrap: string; dot: string; label: string }> = {
  healthy: { wrap: "bg-ok-soft text-ok", dot: "bg-ok", label: "Healthy" },
  warning: { wrap: "bg-warn-soft text-warn", dot: "bg-warn", label: "Warning" },
  critical: { wrap: "bg-crit-soft text-crit", dot: "bg-crit", label: "Critical" },
  info: { wrap: "bg-info-soft text-info", dot: "bg-info", label: "Informational" },
  neutral: { wrap: "bg-slate-100 text-muted", dot: "bg-slate-400", label: "Neutral" },
};

export function StatusPill({ tone, label }: { tone: Tone; label?: string }) {
  const t = TONES[tone];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", t.wrap)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden />
      {label ?? t.label}
    </span>
  );
}
