"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { clearProgress } from "@/lib/demo";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export function ResetDemoButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reset() {
    setBusy(true); setErr(null);
    try {
      await api.resetDemo();
      clearProgress();
      window.location.assign("/");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Reset failed."); setBusy(false);
    }
  }
  return (
    <>
      <Button variant={iconOnly ? "ghost" : "secondary"} onClick={() => setOpen(true)} aria-label="Reset demo" title="Reset demo" icon={<RotateCcw className="h-4 w-4" />}>
        {iconOnly ? <span className="sr-only">Reset demo</span> : "Reset demo"}
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Reset demo?"
        footer={<div className="flex justify-end gap-2"><Button onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button variant="danger" loading={busy} onClick={reset}>Reset demo</Button></div>}>
        <p className="text-sm leading-6 text-muted">This restores the original synthetic datasets and seeded alerts. Experiments you ran, alert status changes, investigation notes and generated reports will be removed, and your guided-demo progress will clear.</p>
        {err && <p role="alert" className="mt-3 text-sm text-crit">{err}</p>}
      </Modal>
    </>
  );
}
