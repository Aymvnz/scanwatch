"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Activity, Bell, FlaskConical, Boxes, LayoutDashboard, Rocket, ShieldCheck, Sparkles, Users, Waves } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useModel } from "../layout/ModelContext";
import { DEMO_STEPS } from "@/lib/demo";
import { FOUR_QUESTIONS } from "@/lib/glossary";

export const TOUR_EVENT = "scanwatch:tour";
const KEY = "scanwatch.tourDone";
export const openTour = () => window.dispatchEvent(new Event(TOUR_EVENT));

function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">{icon}</span>
      <div className="min-w-0"><div className="text-sm font-semibold text-navy">{title}</div><p className="text-[13px] leading-5 text-muted">{children}</p></div>
    </div>
  );
}

export function TourHost() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const router = useRouter();
  const { select } = useModel();

  useEffect(() => {
    try { if (!window.localStorage.getItem(KEY)) setOpen(true); } catch { /* storage blocked: skip auto-open */ }
    const h = () => { setStep(0); setOpen(true); };
    window.addEventListener(TOUR_EVENT, h);
    return () => window.removeEventListener(TOUR_EVENT, h);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try { window.localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
  }, []);

  const steps: { title: string; body: ReactNode }[] = [
    { title: "Welcome to ScanWatch", body: (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-muted">Hospitals use AI to help read medical images. After such a system goes live, the world around it keeps changing: new scanners, different patients, new workflows. <strong className="text-navy">ScanWatch shows how a hospital could notice those changes.</strong></p>
        <div className="rounded-lg border border-warn/30 bg-warn-soft p-3 text-[13px] leading-5 text-navy"><strong>Everything here is synthetic.</strong> There are no real patients, and nothing in ScanWatch diagnoses, advises, or validates any model for clinical use. It is an educational prototype.</div>
        <p className="text-[13px] text-muted">This 2-minute tour explains how to find your way. You can reopen it any time from the <em>Tour</em> button at the top.</p>
      </div>) },
    { title: "Why watch a medical AI after launch?", body: (
      <div className="space-y-4">
        <Row icon={<Waves className="h-4 w-4" />} title="The incoming data can change">A new scanner or a different patient mix can make today’s images look different from the ones the model was checked on. That is called <em>data drift</em>.</Row>
        <Row icon={<Activity className="h-4 w-4" />} title="The model’s accuracy can change">Whether it still catches findings (<em>sensitivity</em>) and avoids false alarms (<em>specificity</em>) can only be confirmed once real outcomes are known, often days later.</Row>
        <Row icon={<Users className="h-4 w-4" />} title="Some patients can be affected more than others">An overall average can hide a group the model serves worse, so ScanWatch also looks by age group and care setting.</Row>
      </div>) },
    { title: "Finding your way around", body: (
      <div className="space-y-3">
        <Row icon={<LayoutDashboard className="h-4 w-4" />} title="Overview">The big picture across all three demo models.</Row>
        <Row icon={<Boxes className="h-4 w-4" />} title="Models and Performance">Each model’s details and its measured accuracy, compared with a baseline.</Row>
        <Row icon={<FlaskConical className="h-4 w-4" />} title="Drift Detection Lab (the main event)">Run an experiment that changes the data, then see what the statistics detect.</Row>
        <Row icon={<ShieldCheck className="h-4 w-4" />} title="Patient Safety">Performance for each age group and care setting.</Row>
        <Row icon={<Bell className="h-4 w-4" />} title="Alerts and Reports">Investigate what was flagged, then export a report.</Row>
        <p className="rounded-lg bg-canvas p-3 text-[13px] leading-5 text-muted">At the top of every page: the <strong className="text-navy">model selector</strong>, a <strong className="text-navy">glossary</strong> for any term you don’t know, and <strong className="text-navy">Reset demo</strong> to start over. Hover the small <em>i</em> icons for explanations.</p>
      </div>) },
    { title: "Four different questions", body: (
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted">The most common mix-up: <strong className="text-navy">a change in the data is not the same as a failing model.</strong> ScanWatch keeps these questions apart:</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FOUR_QUESTIONS.map((q) => <div key={q.q} className="rounded-lg border border-line p-3"><div className="text-sm font-semibold text-navy">{q.q}</div><div className="mt-0.5 text-[13px] leading-5 text-muted">{q.a}</div></div>)}
        </div>
        <p className="text-[13px] leading-5 text-muted">An alert is a reason for qualified people to look closer. It is never an instruction to stop a clinical system.</p>
      </div>) },
    { title: "Try the guided demo", body: (
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted">The fastest way to see everything is to follow this path with the Chest X-ray Classifier. A checklist on the Overview page tracks your progress.</p>
        <ol className="space-y-1.5">
          {DEMO_STEPS.map((s, i) => <li key={s.id} className="flex gap-2.5 text-[13px] text-navy"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">{i + 1}</span>{s.title}</li>)}
        </ol>
      </div>) },
  ];
  const last = step === steps.length - 1;

  return (
    <Modal open={open} onClose={close} title={steps[step].title} wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-primary" : "w-1.5 bg-slate-300"}`} />)}
          </div>
          <div className="flex items-center gap-2">
            {!last && <Button variant="ghost" onClick={close}>Skip</Button>}
            {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
            {!last ? <Button variant="primary" onClick={() => setStep(step + 1)}>Next</Button> : (
              <>
                <Button onClick={close}>Explore on my own</Button>
                <Button variant="primary" icon={<Rocket className="h-4 w-4" />} onClick={() => { select("chest-xray-classifier"); close(); router.push("/"); }}>Start the guided demo</Button>
              </>
            )}
          </div>
        </div>
      }>
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary"><Sparkles className="h-3.5 w-3.5" />Step {step + 1} of {steps.length}</div>
      {steps[step].body}
    </Modal>
  );
}
