"use client";

import { Field, Select } from "./Field";

export type DaysValue = "all" | "30" | "60";
export const daysToNumber = (v: DaysValue) => (v === "all" ? null : Number(v));

export function DaysSelect({ value, onChange, label = "Date range" }: { value: DaysValue; onChange: (v: DaysValue) => void; label?: string }) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value as DaysValue)}>
        <option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="all">Full current period</option>
      </Select>
    </Field>
  );
}

export function SiteSelect({ value, onChange, sites = ["HOSP-A", "HOSP-B", "HOSP-C"], label = "Site" }: { value: string; onChange: (v: string) => void; sites?: string[]; label?: string }) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All hospitals</option>{sites.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
    </Field>
  );
}

import type { DatasetBrief } from "@/lib/types";
export function DatasetSelect({ label, value, options, onChange, hint }: { label: string; value: string; options: DatasetBrief[]; onChange: (v: string) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={!options.length}>
        {options.map((d) => <option key={d.id} value={d.id}>{d.label} · n={d.n.toLocaleString()}</option>)}
      </Select>
    </Field>
  );
}
