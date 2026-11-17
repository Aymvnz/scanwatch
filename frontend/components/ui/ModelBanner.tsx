"use client";

import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useModel } from "../layout/ModelContext";
import { StatusPill } from "./StatusPill";
import { Card } from "./Card";

export function ModelBanner() {
  const { selected } = useModel();
  const { data } = useApi(() => api.models(), [selected.id]);
  const live = data?.find((m) => m.id === selected.id);
  return (
    <Card className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 !py-3">
      <div className="min-w-0">
        <div className="eyebrow">Selected model</div>
        <div className="truncate text-sm font-semibold text-navy">{selected.name}</div>
      </div>
      <div className="text-[13px] text-muted">{selected.identifier} · {selected.version} · {selected.modality}</div>
      <div className="ml-auto"><StatusPill tone={live?.status ?? selected.initialStatus} /></div>
    </Card>
  );
}
