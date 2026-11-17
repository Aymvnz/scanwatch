"use client";

import { ChevronDown } from "lucide-react";
import { useModel } from "./ModelContext";

export function ModelSelector() {
  const { models, selected, select } = useModel();
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">Selected model</span>
      <select
        value={selected.id}
        onChange={(e) => select(e.target.value)}
        className="h-9 w-full min-w-0 max-w-[15rem] cursor-pointer appearance-none truncate rounded-lg border border-line bg-white pl-3 pr-8 text-sm font-medium text-navy shadow-card hover:border-slate-300"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </label>
  );
}
