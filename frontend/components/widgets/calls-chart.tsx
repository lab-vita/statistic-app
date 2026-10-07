"use client";
import { useId, useState } from "react";
import { LineChart, TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { DailyItem } from "@/lib/api";
import { deltaIsGood, relativeDelta } from "@/lib/call-metrics";

export type ChartMetric = "incoming" | "received" | "lost";

export const CHART_METRICS: { key: ChartMetric; label: string; /** рост — это плохо */ bad: boolean }[] = [
  { key: "incoming", label: "Принято",   bad: false },
  { key: "received", label: "Поступило", bad: false },
  { key: "lost",     label: "Потеряно",  bad: true  },
];

export interface ChartPoint { date: string; label: string; cur: number; prev: number | null }

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

/** Точки графика: i-й день текущего периода сопоставляется с i-м днём прошлого. */
export function buildChartData(
  daily: DailyItem[], prevDaily: DailyItem[] | null, metric: ChartMetric,
): ChartPoint[] {
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
    <div className="rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-[11px] text-white shadow-lg">
      <div className="mb-0.5 font-medium">{new Date(`${p.date}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })}</div>
      <div>Сейчас: <b>{p.cur.toLocaleString("ru-RU")}</b></div>
      {p.prev !== null && <div className="text-white/60">Прошлый: {p.prev.toLocaleString("ru-RU")}</div>}
    </div>
  );
}

/**
 * «Динамика по дням»: сплошная линия — этот период, пунктир — прошлый.
 * Метрику можно переключать: принято / поступило / потеряно.
 */
export function CallsChartWidget({ daily, prevDaily, loading, metric: initial = "incoming" }: {
  daily: DailyItem[]; prevDaily: DailyItem[] | null; loading: boolean; metric?: ChartMetric;
}) {
  const gradId = useId();
  const [metric, setMetric] = useState<ChartMetric>(initial);
  if (loading) return <div className="h-full rounded-2xl bg-muted/40 animate-pulse" />;

  const def  = CHART_METRICS.find(m => m.key === metric)!;
  const data = buildChartData(daily, prevDaily, metric);
  const hasPrev = data.some(p => p.prev !== null);

  const total = sum(data.map(p => p.cur));
  const delta = hasPrev ? relativeDelta(total, sum(data.map(p => p.prev ?? 0))) : null;
  const good  = delta ? deltaIsGood(delta.dir, def.bad) : null;

  return (
    <div className="relative h-full rounded-2xl overflow-hidden p-4 flex flex-col gap-2 text-white
      bg-gradient-to-br from-blue-600 to-indigo-700">
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -right-3 -bottom-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />

      <div className="z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <LineChart className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-xs text-white/60">{def.label}, по дням</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight tabular-nums">{total.toLocaleString("ru-RU")}</span>
              {delta && delta.pct !== null && delta.dir && delta.dir !== "flat" && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${good ? "text-emerald-200" : "text-red-200"}`}>
                  {delta.dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {delta.dir === "up" ? "+" : "−"}{delta.pct}%
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0" role="group" aria-label="Показатель">
          {CHART_METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                metric === m.key ? "bg-white/25 text-white font-medium" : "text-white/60 hover:bg-white/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {data.length < 2 ? (
        <div className="z-10 flex-1 flex items-center justify-center text-center text-xs text-white/60">
          Для графика выберите период от двух дней: неделю или месяц
        </div>
      ) : (
        <>
          <div className="z-10 flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#fff" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#fff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28}
                       tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.35)" }} />
                {hasPrev && (
                  <Area type="monotone" dataKey="prev" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5}
                        strokeDasharray="4 3" fill="none" dot={false} isAnimationActive={false} />
                )}
                <Area type="monotone" dataKey="cur" stroke="#fff" strokeWidth={2} fill={`url(#${gradId})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="z-10 flex gap-4 text-[11px] text-white/60">
            <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-white" />Этот период</span>
            {hasPrev && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-dashed border-white/60" />Прошлый
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
