import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

/**
 * Stage 1 scaffold: marks a region of a page whose real, data-backed content
 * is built in a later stage. Visible so the layout can be reviewed honestly
 * without faking charts or numbers.
 */
export function PlannedSection({
  icon: Icon, title, description, stage, className,
}: { icon: LucideIcon; title: string; description: string; stage: number; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-navy">{title}</h3>
            <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">Stage {stage}</span>
          </div>
          <p className="mt-1 text-[13px] leading-5 text-muted">{description}</p>
        </div>
      </div>
    </Card>
  );
}
