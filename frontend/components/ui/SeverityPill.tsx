import type { AlertStatus, Severity } from "@/lib/types";
import { SEVERITY_LABEL, STATUS_LABEL } from "@/lib/format";
import { StatusPill } from "./StatusPill";

export const SeverityPill = ({ severity }: { severity: Severity }) => (
  <StatusPill tone={severity === "info" ? "info" : severity} label={SEVERITY_LABEL[severity]} />
);
export const AlertStatusPill = ({ status }: { status: AlertStatus }) => (
  <StatusPill tone={status === "resolved" ? "healthy" : status === "investigating" ? "info" : "neutral"} label={STATUS_LABEL[status]} />
);
