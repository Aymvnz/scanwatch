import { FlaskConical } from "lucide-react";

export function SyntheticBadge() {
  return (
    <span
      title="All data in ScanWatch is synthetic. Nothing here is clinical validation."
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-muted"
    >
      <FlaskConical className="h-3.5 w-3.5 text-primary" aria-hidden />
      Synthetic data only
    </span>
  );
}
