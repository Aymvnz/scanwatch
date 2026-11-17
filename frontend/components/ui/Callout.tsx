import clsx from "clsx";
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "why"; title?: string; children: ReactNode }) {
  const Icon = tone === "warn" ? AlertTriangle : tone === "why" ? Lightbulb : Info;
  return (
    <div className={clsx("flex gap-3 rounded-card border p-4 text-[13px] leading-5",
      tone === "warn" ? "border-warn/30 bg-warn-soft text-navy" : tone === "why" ? "border-primary/20 bg-primary-soft text-navy" : "border-line bg-white text-muted")}>
      <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", tone === "warn" ? "text-warn" : "text-primary")} aria-hidden />
      <div className="min-w-0">{title && <div className="mb-0.5 font-semibold text-navy">{title}</div>}{children}</div>
    </div>
  );
}
