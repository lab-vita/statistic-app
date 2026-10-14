"use client";

import { useId } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useChartTheme, fmtDate, fmtDateLong } from "./base-chart";
import type { PaymentDailyItem } from "@/lib/api";

interface Props { data: PaymentDailyItem[] }

export function RevenueChart({ data }: Props) {
  const ct  = useChartTheme();
  const id  = useId();
  const fmtY = (v: number) => v >= 1_000_000
    ? `${(v/1_000_000).toFixed(1)}M`
    : v >= 1_000 ? `${Math.round(v/1_000)}K` : String(v);

  const tick = data.length > 60 ? 6 : data.length > 30 ? 2 : 0;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#1a9e6e" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#1a9e6e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate}
          tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} interval={tick} />
        <YAxis tickFormatter={fmtY}
          tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} width={42} />
        <Tooltip
          {...ct.tooltip}
          labelFormatter={fmtDateLong}
          formatter={(v) => [new Intl.NumberFormat("ru-RU").format(Number(v)) + " ₽", "Выручка"]}
        />
        <Area type="monotone" dataKey="total_paid" name="Выручка"
          stroke="#1a9e6e" strokeWidth={2} fill={`url(#${id})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
