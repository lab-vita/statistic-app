"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3 } from "lucide-react";
import type { AppointmentDailyItem } from "@/lib/api";
import { useChartTheme } from "@/components/charts/base-chart";
import { WidgetCard, WidgetLabel, WidgetSkeleton, WidgetEmpty, ChartTip, C, num, dayLabel, dayLong } from "./widget-card";

interface Point { date: string; label: string; visits: number; noshow: number; other: number; total: number }

const SERIES = [
  { key: "visits", label: "Явки",            color: C.green },
  { key: "noshow", label: "Неявки",          color: C.red   },
  { key: "other",  label: "Ожидают и прочие", color: C.slate },
] as const;

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTip
      title={dayLong(p.date)}
      rows={[
        { label: "Всего записей", value: num(p.total) },
        ...SERIES.map(s => ({ label: s.label, value: num(p[s.key]), color: s.color })),
      ]}
    />
  );
}

export function ApptChartWidget({ days, loading }: { days: AppointmentDailyItem[]; loading: boolean }) {
  const ct = useChartTheme();
  if (loading) return <WidgetSkeleton />;

  const data: Point[] = days.map(d => ({
    date: d.date, label: dayLabel(d.date), total: d.total,
    visits: d.visits, noshow: d.noshow, other: Math.max(0, d.total - d.visits - d.noshow),
  }));
  const total  = data.reduce((s, p) => s + p.total, 0);
  const visits = data.reduce((s, p) => s + p.visits, 0);

  return (
    <WidgetCard>
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <WidgetLabel>Записи по дням</WidgetLabel>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{num(total)}</span>
            {total > 0 && (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {Math.round((visits / total) * 100)}% явок
              </span>
            )}
          </div>
        </div>
        <div className="hidden flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] text-text-3 @[24rem]:flex">
          {SERIES.map(s => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />{s.label}
            </span>
          ))}
        </div>
      </div>
      {data.length < 2 ? (
        <WidgetEmpty icon={BarChart3} text="Нужен период от двух дней" hint="Выберите неделю, месяц или квартал" />
      ) : (
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28}
                tick={{ fill: ct.axis, fontSize: 11 }} />
              <YAxis hide />
              <Tooltip content={<Tip />} cursor={{ fill: ct.cursor }} />
              {SERIES.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color}
                  radius={i === SERIES.length - 1 ? [3, 3, 0, 0] : 0} maxBarSize={28} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetCard>
  );
}
