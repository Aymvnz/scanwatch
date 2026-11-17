"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Rocket } from "lucide-react";
import { Card } from "../ui/Card";
import { DEMO_EVENT, DEMO_STEPS, getProgress } from "@/lib/demo";

export function GuidedDemoCard() {
  const [done, setDone] = useState<string[]>([]);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const sync = () => setDone(getProgress());
    sync();
    window.addEventListener(DEMO_EVENT, sync);
    return () => window.removeEventListener(DEMO_EVENT, sync);
  }, []);
  const count = DEMO_STEPS.filter((s) => done.includes(s.id)).length;
  const next = DEMO_STEPS.find((s) => !done.includes(s.id));
  return (
    <Card className="mb-6">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Rocket className="h-[18px] w-[18px]" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-navy">Guided demo · {count} of {DEMO_STEPS.length} done</div>
          <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100" aria-hidden><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(count / DEMO_STEPS.length) * 100}%` }} /></div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ol className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
          {DEMO_STEPS.map((s, i) => {
            const isDone = done.includes(s.id);
            return (
              <li key={s.id}>
                <Link href={s.href} className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-canvas">
                  {isDone ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-label="Done" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-label="Not done" />}
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-medium ${isDone ? "text-muted line-through" : "text-navy"}`}>{i + 1}. {s.title}</span>
                    <span className="block text-xs leading-4 text-muted">{s.detail}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {open && !next && <p className="mt-3 text-[13px] font-medium text-ok">You have completed the full workflow. Try a different simulation or model next.</p>}
    </Card>
  );
}
