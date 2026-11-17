"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { dateTime, pct, int } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { Callout } from "@/components/ui/Callout";

export default function ModelsPage() {
  const { data, error, reload } = useApi(() => api.models(), []);
  return (
    <>
      <PageHeader title="Models" subtitle="Three fictional demonstration models. They are not validated medical devices and must not be used for clinical decisions." />
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {data.map((m) => (
            <Link key={m.id} href={`/models/${m.id}`} className="group block">
              <Card className="h-full transition-shadow group-hover:shadow-pop">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[15px] font-semibold text-navy">{m.name}</h2><StatusPill tone={m.status} />
                </div>
                <p className="mt-1 text-xs text-muted">{m.identifier} · {m.version}</p>
                <p className="mt-3 text-[13px] leading-5 text-muted">{m.purpose}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-[13px]">
                  <div><dt className="eyebrow">Modality</dt><dd className="mt-0.5 text-navy">{m.modality}</dd></div>
                  <div><dt className="eyebrow">Last monitored</dt><dd className="mt-0.5 text-navy">{dateTime(m.last_monitored + "T00:00:00").replace(/, \d+:\d+ [AP]M/, "")}</dd></div>
                  <div><dt className="eyebrow">Sensitivity</dt><dd className="mt-0.5 text-navy">{pct(m.latest.sensitivity)}</dd></div>
                  <div><dt className="eyebrow">Specificity</dt><dd className="mt-0.5 text-navy">{pct(m.latest.specificity)}</dd></div>
                </dl>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>{int(m.latest.n)} records · {m.open_alerts} open alert{m.open_alerts === 1 ? "" : "s"}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary">Details <ArrowRight className="h-3.5 w-3.5" /></span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-6"><Callout title="About these models">Each model’s predictions and confirmed outcomes are generated from fixed random seeds, so numbers stay the same every time you reload. Latest performance is measured on the current period’s synthetic records.</Callout></div>
    </>
  );
}
