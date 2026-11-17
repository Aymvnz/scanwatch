export const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? "unavailable" : `${(v * 100).toFixed(digits)}%`);
export const pctShort = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(0)}%`);
export const num = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? "—" : v.toFixed(digits));
export const pts = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} pts`);
export const int = (v: number) => v.toLocaleString("en-US");
export const pval = (p: number | null | undefined) => (p === null || p === undefined ? "—" : p < 0.0001 ? "<0.0001" : p.toFixed(4));

export function shortDate(iso: string) {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
export function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
export function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return dateTime(iso);
}
export function valueByFormat(v: number | null, f: "pct" | "number" | "count") {
  if (v === null) return "—";
  return f === "pct" ? pct(v) : f === "count" ? String(Math.round(v)) : v.toFixed(2);
}
export const SEVERITY_LABEL = { info: "Informational", warning: "Warning", critical: "Critical" } as const;
export const STATUS_LABEL = { open: "Open", investigating: "Investigating", resolved: "Resolved" } as const;
export const MODEL_COLORS: Record<string, string> = {
  "chest-xray-classifier": "#246B8E", "lung-finding-classifier": "#1B998B", "imaging-triage-model": "#8A6FBF",
};
