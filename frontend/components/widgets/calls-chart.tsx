"use client";

import { useId, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import type { DailyItem } from "@/lib/api";
import { relativeDelta } from "@/lib/call-metrics";
import { useChartTheme } from "@/components/charts/base-chart";
import { WidgetCard, WidgetLabel, WidgetSkeleton, WidgetEmpty, DeltaBadge, C } from "./widget-card";
import { cn } from "@/lib/utils";

export type ChartMetric = "incoming" | "received" | "lost";

export const CHART_METRICS: { key: ChartMetric; label: string; bad: boolean; color: string }[] = [
  { key: "incoming", label: "Принято",   bad: false, color: C.green },
  { key: "received", label: "Поступило", bad: false, color: C.blue  },
  { key: "lost",     label: "Потеряно",  bad: true,  color: C.red   },
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
    <div className="space-y-1 rounded-lg border border-border bg-popover px-3 py-2 text-[12px] shadow-pop">
      <p className="mb-1 font-semibold">
        {new Date(`${p.date}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })}
      </p>
      <div className="flex justify-between gap-4">
        <span className="text-text-2">Текущий</span>
        <span className="font-bold tabular-nums">{p.cur.toLocaleString("ru-RU")}</span>
      </div>
      {p.prev !== null && (
        <div className="flex justify-between gap-4">
          <span className="text-text-3">Прошлый</span>
          <span className="tabular-nums text-text-2">{p.prev.toLocaleString("ru-RU")}</span>
        </div>
      )}
    </div>
  );
}

export function CallsChartWidget({ daily, prevDaily, loading, metric: initial = "incoming" }: {
  daily: DailyItem[]; prevDaily: DailyItem[] | null; loading: boolean; metric?: ChartMetric;
}) {
  const gradId = useId().replace(/:/g, "");
  const [metric, setMetric] = useState<ChartMetric>(initial);
  const ct = useChartTheme();

  if (loading) return <WidgetSkeleton />;

  const def     = CHART_METRICS.find(m => m.key === metric) ?? CHART_METRICS[0];
  const data    = buildChartData(daily, prevDaily, def.key);
  const hasPrev = data.some(p => p.prev !== null);
  const total   = sum(data.map(p => p.cur));
  const delta   = hasPrev ? relativeDelta(total, sum(data.map(p => p.prev ?? 0))) : null;

  return (
    <WidgetCard>
      <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <WidgetLabel>{def.label} по дням</WidgetLabel>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
              {total.toLocaleString("ru-RU")}
            </span>
            {delta && <DeltaBadge pct={delta.pct} dir={delta.dir} invert={def.bad} />}
          </div>
        </div>
        <div className="inline-flex items-center gap-1" role="tablist" aria-label="Показатель графика">
          {CHART_METRICS.map(m => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                "rounded-full border px-2.5 py-[3px] text-[11px] font-semibold transition-colors",
                metric === m.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-text-2 hover:border-brand hover:text-brand",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {data.length < 2 ? (
        <WidgetEmpty icon={LineChartIcon} text="Нужен период от двух дней" hint="Выберите неделю, месяц или квартал" />
      ) : (
        <>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={def.color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={def.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false}
                  interval="preserveStartEnd" minTickGap={28}
                  tick={{ fill: ct.axis, fontSize: 11 }} />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: ct.axis, strokeOpacity: 0.3, strokeWidth: 1 }} />
                {hasPrev && (
                  <Area type="monotone" dataKey="prev" stroke={C.slate} strokeWidth={1.5}
                    strokeDasharray="4 3" fill="none" dot={false} isAnimationActive={false} />
                )}
                <Area type="monotone" dataKey="cur" stroke={def.color} strokeWidth={2}
                  fill={`url(#${gradId})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex shrink-0 gap-4 text-[11px] text-text-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: def.color }} />Этот период
            </span>
            {hasPrev && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: C.slate }} />Прошлый
              </span>
            )}
          </div>
        </>
      )}
    </WidgetCard>
  );
}
