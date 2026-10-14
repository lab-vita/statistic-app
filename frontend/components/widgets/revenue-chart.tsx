"use client";

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { BarChart3 } from "lucide-react";
import type { PaymentDailyItem } from "@/lib/api";
import { useChartTheme } from "@/components/charts/base-chart";
import { WidgetCard, WidgetLabel, WidgetSkeleton, WidgetEmpty, ChartTip, C, num, rub, rubShort, dayLabel, dayLong } from "./widget-card";

interface Point { date: string; label: string; paid: number; count: number }

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTip
      title={dayLong(p.date)}
      rows={[
        { label: "Выручка", value: rub(p.paid), color: C.green },
        { label: "Платежей", value: num(p.count) },
      ]}
    />
  );
}

export function RevenueChartWidget({ days, loading }: { days: PaymentDailyItem[]; loading: boolean }) {
  const ct = useChartTheme();
  if (loading) return <WidgetSkeleton />;

  const data: Point[] = days.map(d => ({ date: d.date, label: dayLabel(d.date), paid: d.total_paid, count: d.count }));
  const total = data.reduce((s, p) => s + p.paid, 0);
  const working = data.filter(p => p.paid > 0);
  const avg = working.length ? total / working.length : 0;
  const best = working.reduce<Point | null>((b, p) => (!b || p.paid > b.paid ? p : b), null);

  return (
    <WidgetCard>
      <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <WidgetLabel>Выручка по дням</WidgetLabel>
          <p className="mt-1.5 text-[26px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-emerald-600 dark:text-emerald-400">
            {rub(total)}
          </p>
        </div>
        {working.length > 0 && (
          <div className="flex gap-4 text-right">
            <div>
              <p className="metric-label">В среднем</p>
              <p className="mt-1 text-[13px] font-bold tabular-nums">{rubShort(avg)}</p>
            </div>
            {best && (
              <div className="hidden @[26rem]:block">
                <p className="metric-label">Лучший день</p>
                <p className="mt-1 text-[13px] font-bold tabular-nums">{rubShort(best.paid)} <span className="font-medium text-text-3">· {best.label}</span></p>
              </div>
            )}
          </div>
        )}
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
              {avg > 0 && <ReferenceLine y={avg} stroke={C.slate} strokeDasharray="4 3" />}
              <Bar dataKey="paid" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {data.map(p => (
                  <Cell key={p.date} fill={best && p.date === best.date ? C.green : `${C.green}99`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetCard>
  );
}
