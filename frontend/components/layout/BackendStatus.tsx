"use client";

import { ServerCrash } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { BackendHelp } from "../ui/States";
import { Button } from "../ui/Button";

export function BackendStatus() {
  const { error, reload } = useApi(() => api.health(), []);
  if (!error?.network) return null;
  return (
    <div role="alert" className="mb-6 rounded-card border border-crit/25 bg-crit-soft p-4">
      <div className="flex items-start gap-3">
        <ServerCrash className="mt-0.5 h-5 w-5 shrink-0 text-crit" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-navy">The ScanWatch API isn’t running</div>
          <p className="text-[13px] leading-5 text-muted">The interface loads, but metrics, experiments and reports come from the Python backend.</p>
          <BackendHelp />
        </div>
        <Button size="sm" onClick={reload}>Retry</Button>
      </div>
    </div>
  );
}
