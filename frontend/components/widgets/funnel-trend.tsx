"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import type { ConversionDay } from "@/lib/api";
import { useChartTheme } from "@/components/charts/base-chart";
import { WidgetCard, WidgetLabel, WidgetSkeleton, WidgetEmpty, ChartTip, C, num, dayLabel, dayLong } from "./widget-card";

interface Point { date: string; label: string; calls: number; appt: number; conv: number | null }

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTip
      title={dayLong(p.date)}
      rows={[
        { label: "Принято звонков", value: num(p.calls), color: C.blue },
        { label: "Записей",         value: num(p.appt),  color: C.violet },
        { label: "Конверсия",       value: p.conv === null ? "—" : `${p.conv.toFixed(1)}%`, color: C.green },
      ]}
    />
  );
}

export function FunnelTrendWidget({ days, total, loading }: {
  days: ConversionDay[]; total: number | null; loading: boolean;
}) {
  const ct = useChartTheme();
  if (loading) return <WidgetSkeleton />;

  // Звонки и записи операторов колл-центра; записи — по дню создания (как в разделе «Звонки»)
  const data: Point[] = days.map(d => ({
    date: d.date, label: dayLabel(d.date), calls: d.incoming, appt: d.appointments,
    conv: d.incoming > 0 ? d.conversion_pct : null,
  }));
  const avgConv = total;

  return (
    <WidgetCard>
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <WidgetLabel>Конверсия звонков в записи по дням</WidgetLabel>
          <p className="mt-1.5 text-[26px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-blue-600 dark:text-blue-400">
            {avgConv === null ? "—" : `${avgConv.toFixed(1)}%`}
          </p>
        </div>
        <div className="hidden flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] text-text-3 @[26rem]:flex">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: C.blue }} />Звонки</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: C.violet }} />Записи</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 rounded" style={{ background: C.green }} />Конверсия</span>
        </div>
      </div>
      {data.length < 2 ? (
        <WidgetEmpty icon={LineChartIcon} text="Нужен период от двух дней" hint="Выберите неделю, месяц или квартал" />
      ) : (
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barGap={2} barCategoryGap="24%">
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28}
                tick={{ fill: ct.axis, fontSize: 11 }} />
              <YAxis yAxisId="n" hide />
              <YAxis yAxisId="p" hide orientation="right" domain={[0, 100]} />
              <Tooltip content={<Tip />} cursor={{ fill: ct.cursor }} />
              <Bar yAxisId="n" dataKey="calls" fill={`${C.blue}66`} radius={[2, 2, 0, 0]} maxBarSize={14} />
              <Bar yAxisId="n" dataKey="appt"  fill={C.violet} radius={[2, 2, 0, 0]} maxBarSize={14} />
              <Line yAxisId="p" type="monotone" dataKey="conv" stroke={C.green} strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetCard>
  );
}
