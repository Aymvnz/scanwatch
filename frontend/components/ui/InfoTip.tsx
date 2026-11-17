import { Info } from "lucide-react";

export function InfoTip({ text, align = "center" }: { text: string; align?: "center" | "left" | "right" }) {
  const pos = align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" aria-label={text} className="rounded-full p-0.5 text-slate-400 hover:text-primary focus-visible:text-primary">
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span role="tooltip" className={`pointer-events-none absolute bottom-full z-40 mb-1.5 hidden w-64 max-w-[70vw] rounded-lg bg-navy px-3 py-2 text-left text-xs font-normal normal-case leading-5 tracking-normal text-white shadow-pop group-hover:block group-focus-within:block ${pos}`}>
        {text}
      </span>
    </span>
  );
}
