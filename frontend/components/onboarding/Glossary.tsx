"use client";

import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { GLOSSARY } from "@/lib/glossary";

export const GLOSSARY_EVENT = "scanwatch:glossary";
export const openGlossary = () => window.dispatchEvent(new Event(GLOSSARY_EVENT));

export function GlossaryList() {
  return (
    <dl className="divide-y divide-line">
      {GLOSSARY.map((g) => (
        <div key={g.term} className="py-3">
          <dt className="text-sm font-semibold text-navy">{g.term}</dt>
          <dd className="mt-0.5 text-[13px] font-medium text-primary">{g.short}</dd>
          <dd className="mt-1 text-[13px] leading-5 text-muted">{g.long}</dd>
        </div>
      ))}
    </dl>
  );
}

export function GlossaryHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener(GLOSSARY_EVENT, h);
    return () => window.removeEventListener(GLOSSARY_EVENT, h);
  }, []);
  return <Modal open={open} onClose={() => setOpen(false)} title="Glossary" wide><GlossaryList /></Modal>;
}
