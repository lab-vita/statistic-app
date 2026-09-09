"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AppointmentDailyItem } from "@/lib/api";
import { useTheme } from "next-themes";

interface AppointmentsDailyChartProps {
  data: AppointmentDailyItem[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const date = new Date(label).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md space-y-1">
      <p className="font-medium mb-1">{date}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
            {p.name}
          </span>
          <span className="font-mono font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function AppointmentsDailyChart({ data }: AppointmentsDailyChartProps) {
  const { theme } = useTheme();
  const isDark    = theme === "dark";
  const gridColor = isDark ? "#ffffff10" : "#00000010";
  const axisColor = isDark ? "#666" : "#999";

  const formatted = data.map(d => ({
    ...d,
    name: new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
  }));

  const tickInterval = data.length > 30 ? 6 : data.length > 14 ? 2 : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Динамика записей по дням</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-blue-500" />Записей
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" />Явки
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-red-500" />Неявки
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-purple-500" />Новые
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={formatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }}
            axisLine={false} tickLine={false} interval={tickInterval} />
          <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />}
            cursor={{ fill: isDark ? "#ffffff08" : "#00000008" }} />
          <Bar dataKey="total"   name="Записей" fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={20} />
          <Bar dataKey="visits"  name="Явки"    fill="#22c55e" radius={[3,3,0,0]} maxBarSize={20} />
          <Bar dataKey="noshow"  name="Неявки"  fill="#ef4444" radius={[3,3,0,0]} maxBarSize={20} />
          <Line dataKey="new_patients" name="Новые" type="monotone"
            stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}