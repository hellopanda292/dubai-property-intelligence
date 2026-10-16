"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aed, num } from "@/lib/format";

const AXIS = { fontSize: 12, fill: "#5a6283" };
const GRID = "rgba(13,18,48,0.07)";
const k = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));

export interface SeriesSpec {
  key: string;
  label: string;
  color: string;
}

export function StackedBars({ data, xKey, series, height = 260 }: { data: object[]; xKey: string; series: SeriesSpec[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={k} />
        <Tooltip formatter={(v) => num(Number(v))} cursor={{ fill: "rgba(122,77,255,0.06)" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} radius={i === series.length - 1 ? [6, 6, 0, 0] : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines({ data, xKey, series, height = 260, money = true }: { data: object[]; xKey: string; series: SeriesSpec[]; height?: number; money?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => num(v)} width={56} />
        <Tooltip formatter={(v) => (money ? aed(Number(v)) : num(Number(v)))} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
