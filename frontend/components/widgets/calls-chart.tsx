"use client";

import { useId, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { DailyItem } from "@/lib/api";
import { deltaIsGood, relativeDelta } from "@/lib/call-metrics";
import { Card } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export type ChartMetric = "incoming" | "received" | "lost";

export const CHART_METRICS: { key: ChartMetric; label: string; bad: boolean }[] = [
  { key: "incoming", label: "Принято",   bad: false },
  { key: "received", label: "Поступило", bad: false },
  { key: "lost",     label: "Потеряно",  bad: true  },
];

export interface ChartPoint { date: string; label: string; cur: number; prev: number | null }

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

export function buildChartData(daily: DailyItem[], prevDaily: DailyItem[] | null, metric: ChartMetric): ChartPoint[] {
  return daily.map((d, i) => ({
    date:  d.date,
    label: dayLabel(d.date),
    cur:   d[metric] ?? 0,
    prev:  prevDaily && prevDaily[i] ? (prevDaily[i][metric] ?? 0) : null,
  }));
}

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] shadow-md space-y-1">
      <p className="font-medium mb-1">
        {new Date(`${p.date}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })}
      </p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Текущий</span>
        <span className="font-medium tabular-nums">{p.cur.toLocaleString("ru-RU")}</span>
      </div>
      {p.prev !== null && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground/60">Прошлый</span>
          <span className="tabular-nums text-muted-foreground">{p.prev.toLocaleString("ru-RU")}</span>
        </div>
      )}
    </div>
  );
}

export function CallsChartWidget({ daily, prevDaily, loading, metric: initial = "incoming" }: {
  daily: DailyItem[]; prevDaily: DailyItem[] | null; loading: boolean; metric?: ChartMetric;
}) {
  const gradId = useId();
  const [metric, setMetric] = useState<ChartMetric>(initial);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (loading) return <div className="h-full rounded-lg bg-muted/60 animate-pulse" />;

  const def      = CHART_METRICS.find(m => m.key === metric)!;
  const data     = buildChartData(daily, prevDaily, metric);
  const hasPrev  = data.some(p => p.prev !== null);
  const total    = sum(data.map(p => p.cur));
  const delta    = hasPrev ? relativeDelta(total, sum(data.map(p => p.prev ?? 0))) : null;
  const good     = delta ? deltaIsGood(delta.dir, def.bad) : null;
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const axisColor = isDark ? "#555" : "#aaa";
  const strokeColor = "#22c55e";

  return (
    <Card className="h-full flex flex-col p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1">
            {def.label} по дням
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums">
              {total.toLocaleString("ru-RU")}
            </span>
            {delta && delta.pct !== null && delta.dir && delta.dir !== "flat" && (
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                good ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                     : "bg-red-500/10 text-red-600 dark:text-red-400"
              )}>
                {delta.dir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {delta.dir === "up" ? "+" : "−"}{delta.pct}%
              </span>
            )}
          </div>
        </div>
        <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5">
          {CHART_METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150",
                metric === m.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {data.length < 2 ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-muted-foreground/50">
          Выберите период от двух дней для отображения графика
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={strokeColor} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false}
                  interval="preserveStartEnd" minTickGap={28}
                  tick={{ fill: axisColor, fontSize: 11 }} />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip content={<ChartTooltip />}
                  cursor={{ stroke: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)", strokeWidth: 1 }} />
                {hasPrev && (
                  <Area type="monotone" dataKey="prev"
                    stroke={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}
                    strokeWidth={1.5} strokeDasharray="4 3" fill="none" dot={false} isAnimationActive={false} />
                )}
                <Area type="monotone" dataKey="cur"
                  stroke={strokeColor} strokeWidth={2} fill={`url(#${gradId})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-[11px] text-muted-foreground/60 mt-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-emerald-500 rounded" />Текущий
            </span>
            {hasPrev && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t border-dashed border-muted-foreground/40" />Прошлый
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
