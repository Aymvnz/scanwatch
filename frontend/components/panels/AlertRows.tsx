import Link from "next/link";
import type { Alert } from "@/lib/types";
import { relTime, valueByFormat } from "@/lib/format";
import { AlertStatusPill, SeverityPill } from "../ui/SeverityPill";
import { EmptyState } from "../ui/States";

export function AlertRows({ alerts, empty = "No alerts." }: { alerts: Alert[]; empty?: string }) {
  if (!alerts.length) return <EmptyState title={empty} description="Alerts appear here when a monitoring threshold is exceeded." />;
  return (
    <ul className="divide-y divide-line">
      {alerts.map((a) => (
        <li key={a.id}>
          <Link href={`/alerts?id=${a.id}`} className="flex flex-col gap-1.5 py-3 hover:bg-canvas sm:px-2 sm:-mx-2 sm:rounded-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-navy">{a.type_label}</span>
              <SeverityPill severity={a.severity} /><AlertStatusPill status={a.status} />
            </div>
            <div className="text-xs text-muted">{a.id} · {a.model_name} · {a.trigger_metric}: {valueByFormat(a.baseline_value, a.value_format)} → {valueByFormat(a.current_value, a.value_format)} · {relTime(a.created_at)}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
