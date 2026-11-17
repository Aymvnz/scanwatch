"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CalibrationBin, HistBin } from "@/lib/types";
import { shortDate } from "@/lib/format";

const AXIS = { fontSize: 11, fill: "#5F7587" };
const GRID = "#E3E9EF";
export const BASE_COLOR = "#9FB3C2";
export const CUR_COLOR = "#246B8E";
/* eslint-disable @typescript-eslint/no-explicit-any */
const tooltipStyle = { borderRadius: 10, border: "1px solid #E3E9EF", boxShadow: "0 8px 24px rgba(24,53,74,0.12)", fontSize: 12 };

export interface Series { key: string; name: string; color: string }

export function TrendChart({ data, series, format = (v: number) => `${(v * 100).toFixed(0)}%`, domain, refLines = [], height = 260 }: {
  data: Record<string, string | number | null>[]; series: Series[]; format?: (v: number) => string; domain?: [number | "auto", number | "auto"];
  refLines?: { y: number; label: string; color?: string }[]; height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="week" tick={AXIS} tickFormatter={(v) => shortDate(String(v))} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
          <YAxis tick={AXIS} tickFormatter={format} domain={domain ?? ["auto", "auto"]} tickLine={false} axisLine={false} width={48} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Week of ${shortDate(String(v))}`} formatter={(v: any, n: any) => [v === null || v === undefined ? "unavailable" : format(v), n]} />
          {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
          {refLines.map((r) => <ReferenceLine key={r.label} y={r.y} stroke={r.color ?? "#B7791F"} strokeDasharray="4 4" label={{ value: r.label, position: "insideTopRight", fontSize: 10, fill: r.color ?? "#B7791F" }} />)}
          {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GroupedBars({ data, series, format = (v: number) => `${(v * 100).toFixed(0)}%`, height = 260, yMax }: {
  data: Record<string, string | number | null>[]; series: Series[]; format?: (v: number) => string; height?: number; yMax?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={3}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
          <YAxis tick={AXIS} tickFormatter={format} domain={[0, yMax ?? 1]} tickLine={false} axisLine={false} width={44} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F7F9FC" }} formatter={(v: any, n: any) => [v === null || v === undefined ? "unavailable" : format(v), n]} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeverityBars({ counts }: { counts: { info: number; warning: number; critical: number } }) {
  const data = [
    { name: "Informational", value: counts.info, color: "#246B8E" },
    { name: "Warning", value: counts.warning, color: "#B7791F" },
    { name: "Critical", value: counts.critical, color: "#C0392B" },
  ];
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={92} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F7F9FC" }} formatter={(v: any) => [v, "Active alerts"]} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PsiBars({ data }: { data: { name: string; psi: number; drifted: boolean }[] }) {
  return (
    <div style={{ height: Math.max(220, data.length * 30 + 40) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} domain={[0, (max: number) => Math.max(0.3, Math.ceil(max * 10) / 10)]} />
          <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={150} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F7F9FC" }} formatter={(v: any) => [v.toFixed(3), "PSI"]} />
          <ReferenceLine x={0.1} stroke="#B7791F" strokeDasharray="4 4" />
          <ReferenceLine x={0.25} stroke="#C0392B" strokeDasharray="4 4" />
          <Bar dataKey="psi" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d) => <Cell key={d.name} fill={!d.drifted ? "#9FB3C2" : d.psi >= 0.25 ? "#C0392B" : "#B7791F"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OverlayHistogram({ data, height = 260, asPercent = true }: { data: HistBin[]; height?: number; asPercent?: boolean }) {
  const fmt = (v: number) => (asPercent ? `${(v * 100).toFixed(0)}%` : v.toFixed(2));
  const many = data.length > 12;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        {many ? (
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="x" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={20} />
            <YAxis tick={AXIS} tickFormatter={fmt} tickLine={false} axisLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [(v * 100).toFixed(1) + "% of records", n]} labelFormatter={(l) => `Value ≈ ${l}`} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
            <Area type="stepAfter" dataKey="baseline" name="Baseline" stroke={BASE_COLOR} fill={BASE_COLOR} fillOpacity={0.45} strokeWidth={1.5} />
            <Area type="stepAfter" dataKey="current" name="Current" stroke={CUR_COLOR} fill={CUR_COLOR} fillOpacity={0.35} strokeWidth={1.5} />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="x" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
            <YAxis tick={AXIS} tickFormatter={fmt} tickLine={false} axisLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F7F9FC" }} formatter={(v: any, n: any) => [(v * 100).toFixed(1) + "% of records", n]} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="baseline" name="Baseline" fill={BASE_COLOR} radius={[3, 3, 0, 0]} />
            <Bar dataKey="current" name="Current" fill={CUR_COLOR} radius={[3, 3, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function CalibrationChart({ bins, height = 260 }: { bins: CalibrationBin[]; height?: number }) {
  const pts = bins.filter((b) => b.n > 0 && b.mean_predicted !== null).map((b) => ({ x: b.mean_predicted as number, observed: b.observed_rate as number, ideal: b.mean_predicted as number, n: b.n }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={pts} margin={{ top: 8, right: 12, left: -4, bottom: 16 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis dataKey="x" type="number" domain={[0, 1]} tick={AXIS} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tickLine={false} axisLine={{ stroke: GRID }} label={{ value: "Predicted score", position: "insideBottom", offset: -8, fontSize: 11, fill: "#5F7587" }} />
          <YAxis type="number" domain={[0, 1]} tick={AXIS} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tickLine={false} axisLine={false} width={44} label={{ value: "Observed", angle: -90, position: "insideLeft", fontSize: 11, fill: "#5F7587" }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [`${(v * 100).toFixed(1)}%`, n]} labelFormatter={(l) => `Mean predicted ${(Number(l) * 100).toFixed(0)}%`} />
          <Legend iconType="plainline" verticalAlign="top" wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="ideal" name="Perfect calibration" stroke="#9FB3C2" strokeDasharray="4 4" dot={false} />
          <Line dataKey="observed" name="Observed outcome rate" stroke={CUR_COLOR} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
