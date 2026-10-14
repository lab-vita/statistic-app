"use client";

import { useId } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useChartTheme, fmtDate, fmtDateLong } from "./base-chart";
import type { PaymentDailyItem } from "@/lib/api";

interface Props {
  current: PaymentDailyItem[];
  prev:    PaymentDailyItem[] | null;
}

export function RevenuePeriodChart({ current, prev }: Props) {
  const ct = useChartTheme();
  const id = useId();

  const fmtY = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `${Math.round(v / 1_000)}K`
    : String(v);

  // Совмещаем текущий и предыдущий по индексу (не по дате, т.к. разные периоды)
  const data = current.map((item, i) => ({
    date:    item.date,
    current: item.total_paid,
    prev:    prev?.[i]?.total_paid ?? null,
  }));

  const tick = data.length > 60 ? 6 : data.length > 30 ? 2 : 0;
  const hasPrev = prev && prev.length > 0;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fontSize: 10, fill: ct.axis }}
          axisLine={false}
          tickLine={false}
          interval={tick}
        />
        <YAxis
          tickFormatter={fmtY}
          tick={{ fontSize: 10, fill: ct.axis }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip
          {...ct.tooltip}
          labelFormatter={fmtDateLong}
          formatter={(v: number, name: string) => [
            new Intl.NumberFormat("ru-RU").format(Math.round(v)) + " ₽",
            name === "current" ? "Текущий период" : "Предыдущий период",
          ]}
        />
        {hasPrev && (
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
            formatter={(name) => name === "current" ? "Текущий период" : "Предыдущий период"}
          />
        )}
        <Bar dataKey="current" name="current" fill="#16a34a" fillOpacity={0.85} radius={[2, 2, 0, 0]} maxBarSize={24} />
        {hasPrev && (
          <Line
            dataKey="prev"
            name="prev"
            type="monotone"
            stroke="#9ca3af"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
