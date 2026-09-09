"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Line, ComposedChart, Area,
} from "recharts";
import { DailyItem } from "@/lib/api";
import { useTheme } from "next-themes";

interface DailyChartProps {
  data: DailyItem[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(label).toLocaleDateString("ru-RU", {
      day: "numeric", month: "short",
    });
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md">
        <p className="font-medium mb-1.5">{date}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="flex items-center justify-between gap-4">
            <span style={{ color: p.color || p.fill }}>{p.name}</span>
            <span className="font-mono font-medium">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function DailyChart({ data }: DailyChartProps) {
  const { theme } = useTheme();
  const isDark    = theme === "dark";
  const gridColor = isDark ? "#ffffff10" : "#00000010";
  const axisColor = isDark ? "#666" : "#999";

  const formatted = data.map(d => ({
    ...d,
    name: new Date(d.date).toLocaleDateString("ru-RU", {
      day: "numeric", month: "short",
    }),
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Динамика по дням</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" />Входящие
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-blue-500" />Исходящие
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-red-500" />Пропущенные
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={formatted} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? "#ffffff08" : "#00000008" }} />
          <Bar dataKey="incoming" name="Входящие"    fill="#22c55e" radius={[3,3,0,0]} maxBarSize={20} />
          <Bar dataKey="outgoing" name="Исходящие"   fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={20} />
          <Bar dataKey="missed"   name="Пропущенные" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={20} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}