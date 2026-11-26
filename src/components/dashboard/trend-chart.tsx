"use client";

import { useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useI18n } from "@/components/app/i18n-provider";
import { Button } from "@/components/ui/button";
import { SKILLS } from "@/lib/ielts/bands";
import type { TrendRow } from "@/lib/ielts/trend";

const COLOR: Record<string, string> = {
  listening: "var(--series-listening)",
  reading: "var(--series-reading)",
  writing: "var(--series-writing)",
  speaking: "var(--series-speaking)",
};

function shortDate(d: string) {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}`;
}

export function TrendChart({ rows, target }: { rows: TrendRow[]; target: number }) {
  const { t } = useI18n();
  const [asTable, setAsTable] = useState(false);
  if (rows.length === 0) return <p className="py-6 text-sm text-muted-foreground">{t("dash.trendEmpty")}</p>;

  const values = rows.flatMap((r) => SKILLS.map((s) => r[s]).filter((v): v is number => v != null));
  const min = Math.max(0, Math.floor(Math.min(...values, target) - 0.5));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)}>
          {asTable ? t("dash.chart") : t("dash.table")}
        </Button>
      </div>
      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3 font-medium">{t("dash.date")}</th>
                {SKILLS.map((s) => (
                  <th key={s} className="py-1 pr-3 font-medium">{t(`skill.${s}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.date} className="border-t">
                  <td className="py-1.5 pr-3">{shortDate(r.date)}</td>
                  {SKILLS.map((s) => (
                    <td key={s} className="py-1.5 pr-3 tabular-nums">{r[s]?.toFixed(1) ?? "–"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-60 w-full">
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} stroke="var(--chart-axis)" fontSize={12} tickLine={false} />
              <YAxis domain={[min, 9]} ticks={Array.from({ length: 9 - min + 1 }, (_, i) => min + i)} stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
              <ReferenceLine y={target} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: t("dash.target", { band: target.toFixed(1) }), position: "insideTopLeft", fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" }}
                labelFormatter={(d) => shortDate(String(d))}
                formatter={(v, name) => [Number(v).toFixed(1), t(`skill.${name as (typeof SKILLS)[number]}`)]}
              />
              <Legend itemSorter={(item) => SKILLS.indexOf(item.dataKey as (typeof SKILLS)[number])} formatter={(name) => <span style={{ color: "var(--foreground)", fontSize: 12 }}>{t(`skill.${name as (typeof SKILLS)[number]}`)}</span>} />
              {SKILLS.map((s) => (
                <Line key={s} type="monotone" dataKey={s} stroke={COLOR[s]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
