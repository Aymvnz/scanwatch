import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import clsx from "clsx";

export function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-navy">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-4 text-muted">{hint}</span>}
    </label>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block min-w-0">
      <select {...rest} className={clsx("h-9 w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border border-line bg-white pl-3 pr-8 text-sm text-navy shadow-card hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60", className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </span>
  );
}
