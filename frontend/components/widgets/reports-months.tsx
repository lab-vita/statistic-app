"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CalendarRange } from "lucide-react";
import type { HomeData } from "@/lib/home-data";
import { useChartTheme } from "@/components/charts/base-chart";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, ChartTip, C, num } from "./widget-card";

export type ReportsMetric = "calls" | "appts";

export const REPORTS_METRICS: { key: ReportsMetric; label: string; hint: string }[] = [
  { key: "calls", label: "Звонки", hint: "принятые и пропущенные по месяцам" },
  { key: "appts", label: "Записи", hint: "записи и явки по месяцам" },
];

const SERIES: Record<ReportsMetric, { a: { key: string; label: string; color: string }; b: { key: string; label: string; color: string } }> = {
  calls: { a: { key: "incoming", label: "Принятые", color: C.green }, b: { key: "missed", label: "Пропущенные", color: C.red } },
  appts: { a: { key: "total",    label: "Записи",   color: C.blue  }, b: { key: "visits", label: "Явки",        color: C.green } },
};

const monthLabel = (period: string, long = false) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("ru-RU", long ? { month: "long", year: "numeric" } : { month: "short" }).replace(".", "");
};

type Point = { period: string; label: string; a: number; b: number };
type Series = (typeof SERIES)[ReportsMetric];

function Tip({ active, payload, s }: { active?: boolean; payload?: { payload: Point }[]; s: Series }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTip
      title={monthLabel(p.period, true)}
      rows={[
        { label: s.a.label, value: num(p.a), color: s.a.color },
        { label: s.b.label, value: num(p.b), color: s.b.color },
      ]}
    />
  );
}

export function ReportsMonthsWidget({ data, loading, metric = "calls" }: {
  data: HomeData; loading: boolean; metric?: ReportsMetric;
}) {
  const ct = useChartTheme();
  if (loading) return <WidgetSkeleton />;

  const s = SERIES[metric] ?? SERIES.calls;
  const rows = (metric === "appts" ? data.reports?.appts?.rows : data.reports?.calls?.rows) ?? [];
  const points: Point[] = rows.map(r => {
    const rec = r as unknown as Record<string, number | string>;
    return { period: String(rec.period), label: monthLabel(String(rec.period)), a: Number(rec[s.a.key]) || 0, b: Number(rec[s.b.key]) || 0 };
  });
  const any = points.some(p => p.a > 0 || p.b > 0);

  return (
    <WidgetCard>
      <WidgetHeader
        title={`${metric === "appts" ? "Записи" : "Звонки"} за полгода`}
        meta="по месяцам, независимо от выбранного периода"
        right={
          <div className="hidden shrink-0 gap-3 text-[11px] text-text-3 @[24rem]:flex">
            {[s.a, s.b].map(x => (
              <span key={x.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: x.color }} />{x.label}
              </span>
            ))}
          </div>
        }
      />
      {!any ? (
        <WidgetEmpty icon={CalendarRange} text="Нет данных за последние месяцы" />
      ) : (
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barGap={3} barCategoryGap="26%">
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: ct.axis, fontSize: 11 }} />
              <YAxis hide />
              <Tooltip content={<Tip s={s} />} cursor={{ fill: ct.cursor }} />
              <Bar dataKey="a" fill={s.a.color} radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Bar dataKey="b" fill={s.b.color} radius={[3, 3, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetCard>
  );
}
