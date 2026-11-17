// Tracks progress through the guided demo (browser-only convenience, never sent anywhere).
export const DEMO_STEPS = [
  { id: "dashboard", title: "Open the dashboard", detail: "You are here. Look at the cards and charts.", href: "/" },
  { id: "inspect", title: "Inspect the Chest X-ray Classifier's performance", detail: "Select it in the top bar, then open Performance.", href: "/performance" },
  { id: "lab", title: "Open the Drift Detection Lab", detail: "This is where you run experiments.", href: "/drift-lab" },
  { id: "simulate", title: "Simulate an imaging equipment change", detail: "Choose it, press Run experiment and read the statistical results.", href: "/drift-lab" },
  { id: "alert", title: "Open the alert the experiment created", detail: "Each flagged experiment leaves an alert behind.", href: "/alerts" },
  { id: "investigate", title: "Investigate the alert", detail: "Mark it investigating and add a note.", href: "/alerts" },
  { id: "report", title: "Generate a monitoring report", detail: "Export it as PDF or CSV.", href: "/reports" },
] as const;

const KEY = "scanwatch.demoProgress";
export const DEMO_EVENT = "scanwatch:demo";

export function getProgress(): string[] {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
export function markStep(id: string) {
  try {
    const cur = getProgress();
    if (!cur.includes(id)) window.localStorage.setItem(KEY, JSON.stringify([...cur, id]));
    window.dispatchEvent(new Event(DEMO_EVENT));
  } catch { /* storage unavailable */ }
}
export function clearProgress() {
  try { window.localStorage.removeItem(KEY); window.dispatchEvent(new Event(DEMO_EVENT)); } catch { /* ignore */ }
}
