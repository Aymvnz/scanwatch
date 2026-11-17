"use client";

import clsx from "clsx";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { SubgroupResponse } from "@/lib/types";
import { int, pct, pts } from "@/lib/format";
import { Card, CardHeader } from "../ui/Card";
import { GroupedBars, BASE_COLOR, CUR_COLOR } from "../charts/Charts";
import { Callout } from "../ui/Callout";
import { InfoTip } from "../ui/InfoTip";

type MetricSel = "sensitivity" | "specificity" | "fnr";
const LABEL: Record<MetricSel, string> = { sensitivity: "Sensitivity", specificity: "Specificity", fnr: "False-negative rate" };

export function SubgroupPanel({ data }: { data: SubgroupResponse }) {
  const [metric, setMetric] = useState<MetricSel>("sensitivity");
  const chart = data.groups.map((g) => ({ name: g.group, baseline: g.baseline[metric], current: g.current[metric] }));
  const withSens = data.groups.filter((g) => g.current.sensitivity !== null && !g.current.low_sample);
  const hi = withSens.length ? withSens.reduce((a, b) => ((a.current.sensitivity as number) > (b.current.sensitivity as number) ? a : b)) : null;
  const lo = withSens.length ? withSens.reduce((a, b) => ((a.current.sensitivity as number) < (b.current.sensitivity as number) ? a : b)) : null;
  return (
    <div className="space-y-6">
      {data.low_sample_groups.length > 0 && (
        <Callout tone="warn" title="Some groups have too few cases">
          {data.low_sample_groups.join(", ")} {data.low_sample_groups.length === 1 ? "has" : "have"} too few confirmed cases in this selection for reliable estimates. Treat those numbers as unstable and avoid comparing them.
        </Callout>
      )}
      <Card>
        <CardHeader title="Performance by subgroup" description="Baseline versus current for each group. Hover a bar for the exact value."
          action={<div className="flex rounded-lg border border-line bg-white p-0.5 text-xs">
            {(Object.keys(LABEL) as MetricSel[]).map((k) => (
              <button key={k} onClick={() => setMetric(k)} aria-pressed={metric === k}
                className={clsx("rounded-md px-2.5 py-1 font-medium", metric === k ? "bg-primary text-white" : "text-muted hover:text-navy")}>{LABEL[k]}</button>
            ))}
          </div>} />
        <GroupedBars data={chart} yMax={metric === "fnr" ? 0.5 : 1} series={[{ key: "baseline", name: "Baseline", color: BASE_COLOR }, { key: "current", name: "Current", color: CUR_COLOR }]} />
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-3"><CardHeader title="Comparison table" description="Sample counts are shown for every group. Intervals are 95% Wilson confidence intervals for current sensitivity." /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="border-y border-line bg-canvas text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2 font-semibold">Group</th><th className="px-3 py-2 font-semibold">Cases</th>
                <th className="px-3 py-2 font-semibold">Positives</th>
                <th className="px-3 py-2 font-semibold">Sensitivity (base → current)</th><th className="px-3 py-2 font-semibold">Change</th>
                <th className="px-3 py-2 font-semibold">Specificity (base → current)</th><th className="px-3 py-2 font-semibold">FNR now</th>
                <th className="px-3 py-2 font-semibold">Sample check</th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map((g) => {
                const d = g.current.sensitivity !== null && g.baseline.sensitivity !== null ? g.current.sensitivity - g.baseline.sensitivity : null;
                const ci = g.current.sensitivity_ci;
                return (
                  <tr key={g.group} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5"><div className="font-medium text-navy">{g.group}</div><div className="text-[11px] text-muted">{g.dimension}</div></td>
                    <td className="px-3 py-2.5 tabular-nums">{int(g.current.n)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{int(g.current.positives)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{pct(g.baseline.sensitivity)} → <span className="font-medium text-navy">{pct(g.current.sensitivity)}</span>
                      {ci && <div className="text-[11px] text-muted">{(ci[0] * 100).toFixed(0)}–{(ci[1] * 100).toFixed(0)}%</div>}</td>
                    <td className={clsx("px-3 py-2.5 tabular-nums", d !== null && d <= -0.05 ? "text-crit" : "text-muted")}>{pts(d)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{pct(g.baseline.specificity)} → <span className="font-medium text-navy">{pct(g.current.specificity)}</span></td>
                    <td className="px-3 py-2.5 tabular-nums">{pct(g.current.fnr)}</td>
                    <td className="px-3 py-2.5">{g.current.low_sample
                      ? <span className="inline-flex items-center gap-1 text-warn" title={g.current.low_sample_reason ?? ""}><AlertTriangle className="h-3.5 w-3.5" aria-hidden />Low sample <InfoTip text={g.current.low_sample_reason ?? ""} align="right" /></span>
                      : <span className="text-ok">Adequate</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Callout tone="why" title="Why can overall performance hide subgroup differences?">
        An overall number is an average across everyone. {hi && lo && hi.group !== lo.group
          ? <>Here, overall sensitivity is {pct(data.overall.current.sensitivity)}, yet it ranges from {pct(lo.current.sensitivity)} ({lo.group}) to {pct(hi.current.sensitivity)} ({hi.group}). </>
          : null}
        A large group performing well can mask a smaller group performing worse. Differences in these synthetic data are statistical observations only: they do not establish biological causes and do not show discrimination. Investigating why requires clinical and technical review.
      </Callout>
    </div>
  );
}
