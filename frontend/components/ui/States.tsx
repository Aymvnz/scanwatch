"use client";

import { AlertCircle, Inbox, ServerCrash } from "lucide-react";
import type { ReactNode } from "react";
import { API_BASE, ApiError } from "@/lib/api";
import { Button } from "./Button";
import { Card } from "./Card";

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-slate-200/60 ${className}`} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  );
}

export function BackendHelp() {
  return (
    <div className="mt-3 rounded-lg bg-canvas p-3 text-left text-xs leading-5 text-muted">
      <div className="font-medium text-navy">Start the backend in a second terminal:</div>
      <pre className="mt-1 overflow-x-auto whitespace-pre text-[12px] text-navy">{`cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload`}</pre>
      <div className="mt-1">Expected at <code>{API_BASE}</code>. Set <code>NEXT_PUBLIC_API_URL</code> if it runs elsewhere.</div>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const network = error.network;
  return (
    <Card className="mx-auto max-w-xl text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-crit-soft text-crit">
        {network ? <ServerCrash className="h-5 w-5" aria-hidden /> : <AlertCircle className="h-5 w-5" aria-hidden />}
      </div>
      <h2 className="mt-3 text-[15px] font-semibold text-navy">{network ? "Can’t reach the ScanWatch API" : "Something went wrong"}</h2>
      <p className="mt-1 text-[13px] leading-5 text-muted">{error.message}</p>
      {network && <BackendHelp />}
      {onRetry && <Button className="mt-4" onClick={onRetry}>Try again</Button>}
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <Inbox className="h-7 w-7 text-slate-300" aria-hidden />
      <h3 className="mt-3 text-sm font-semibold text-navy">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
