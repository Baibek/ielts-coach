"use client";

import { useId } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowDown, ArrowRight, RotateCcw } from "lucide-react";
import type { Task1Visual as Visual } from "@/lib/writing/schemas";

const CAT = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"];
const tooltipStyle = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)",
};
const legendText = (name: string) => <span style={{ color: "var(--foreground)", fontSize: 12 }}>{name}</span>;

export function Task1Visual({ visual }: { visual: Visual }) {
  return (
    <figure className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <figcaption className="text-center text-sm font-semibold">{visual.title}</figcaption>
      {visual.kind === "bar" || visual.kind === "line" ? <BarLine v={visual} /> : null}
      {visual.kind === "pie" ? <Pies v={visual} /> : null}
      {visual.kind === "table" ? <DataTable v={visual} /> : null}
      {visual.kind === "process" ? <Process v={visual} /> : null}
      {visual.kind === "map" ? <Maps v={visual} /> : null}
    </figure>
  );
}

function BarLine({ v }: { v: Extract<Visual, { kind: "bar" | "line" }> }) {
  const data = v.categories.map((c, i) => Object.fromEntries([["category", c], ...v.series.map((s) => [s.name, s.values[i]])]));
  const common = (
    <>
      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
      <XAxis dataKey="category" stroke="var(--chart-axis)" fontSize={12} tickLine={false}
        label={v.xLabel ? { value: v.xLabel, position: "insideBottom", offset: -4, fill: "var(--muted-foreground)", fontSize: 12 } : undefined} />
      <YAxis stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} width={44}
        label={{ value: v.yLabel, angle: -90, position: "insideLeft", offset: 12, fill: "var(--muted-foreground)", fontSize: 12, style: { textAnchor: "middle" } }} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(val) => `${val}${v.unit && v.unit.length <= 2 ? v.unit : ""}`} />
      <Legend verticalAlign="top" height={28} formatter={legendText} />
    </>
  );
  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer>
        {v.kind === "bar" ? (
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 16, left: 4 }} barGap={2}>
            {common}
            {v.series.map((s, i) => (
              <Bar key={s.name} dataKey={s.name} fill={CAT[i]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 12, bottom: 16, left: 4 }}>
            {common}
            {v.series.map((s, i) => (
              <Line key={s.name} dataKey={s.name} stroke={CAT[i]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }} isAnimationActive={false} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function Pies({ v }: { v: Extract<Visual, { kind: "pie" }> }) {
  const names = [...new Set(v.charts.flatMap((c) => c.slices.map((s) => s.name)))];
  const color = (name: string) => CAT[names.indexOf(name) % CAT.length];
  return (
    <div className="flex flex-col gap-2">
      <div className={`grid gap-2 ${v.charts.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {v.charts.map((c) => (
          <div key={c.label} className="flex flex-col items-center">
            <span className="text-sm font-medium">{c.label}</span>
            <div className="h-60 w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={c.slices} dataKey="value" nameKey="name" outerRadius="70%" stroke="var(--card)" strokeWidth={2}
                    label={({ value }) => `${value}%`} labelLine={false} isAnimationActive={false}>
                    {c.slices.map((s) => <Cell key={s.name} fill={color(s.name)} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(val, n) => [`${val}%`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {names.map((n) => (
          <li key={n} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: color(n) }} />
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({ v }: { v: Extract<Visual, { kind: "table" }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border bg-muted px-2 py-1.5 text-left font-medium">{v.unit ? `(${v.unit})` : ""}</th>
            {v.columns.map((c) => (
              <th key={c} className="border bg-muted px-2 py-1.5 text-right font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.rows.map((r) => (
            <tr key={r.label}>
              <th className="border px-2 py-1.5 text-left font-medium">{r.label}</th>
              {r.values.map((val, i) => (
                <td key={i} className="border px-2 py-1.5 text-right tabular-nums">{val}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Process({ v }: { v: Extract<Visual, { kind: "process" }> }) {
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col items-stretch gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        {v.steps.map((s, i) => (
          <li key={i} className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
            <div className="flex w-full items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 sm:w-44">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-sm leading-tight">
                <span className="font-medium">{s.label}</span>
                {s.detail && <span className="block text-xs text-muted-foreground">{s.detail}</span>}
              </span>
            </div>
            {i < v.steps.length - 1 && (
              <>
                <ArrowDown className="size-4 text-muted-foreground sm:hidden" aria-hidden />
                <ArrowRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
              </>
            )}
          </li>
        ))}
      </ol>
      {v.cyclic && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <RotateCcw className="size-3.5" /> {`${v.steps.length} → 1`}
        </p>
      )}
    </div>
  );
}

function Maps({ v }: { v: Extract<Visual, { kind: "map" }> }) {
  const uid = "m" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <div className="grid gap-3">
      {v.maps.map((m, mi) => (
        <div key={m.label} className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium">{m.label}</span>
          <svg viewBox="0 0 100 70" className="w-full rounded-md border" role="img" aria-label={`${v.title} — ${m.label}`}>
            <defs>
              <pattern id={`${uid}-trees-${mi}`} width="5" height="5" patternUnits="userSpaceOnUse">
                <rect width="5" height="5" fill="var(--map-trees)" />
                <circle cx="2.5" cy="2.5" r="1.4" fill="var(--map-park)" stroke="var(--map-stroke)" strokeWidth="0.2" />
              </pattern>
            </defs>
            <rect width="100" height="70" fill="var(--map-bg)" />
            {m.features.map((f, i) => (
              <g key={i}>
                <rect x={f.x} y={f.y} width={f.w} height={f.h}
                  fill={f.type === "trees" ? `url(#${uid}-trees-${mi})` : `var(--map-${f.type})`}
                  stroke="var(--map-stroke)" strokeWidth={f.type === "road" || f.type === "water" ? 0 : 0.3} rx={f.type === "building" ? 0.6 : 0} />
                <text x={f.x + f.w / 2} y={f.y + f.h / 2} textAnchor="middle" dominantBaseline="central"
                  fontSize={f.h < 5 ? 2.4 : 3.2} fill="var(--foreground)" style={{ paintOrder: "stroke", stroke: "var(--map-bg)", strokeWidth: 0.6 }}>
                  {f.type === "car_park" ? `P  ${f.name}` : f.name}
                </text>
              </g>
            ))}
            <g transform="translate(94 8)">
              <path d="M0 -4 L2 2 L0 1 L-2 2 Z" fill="var(--foreground)" />
              <text y="5.5" textAnchor="middle" fontSize="2.6" fill="var(--foreground)">N</text>
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}
