"use client";

import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { DailyItem } from "@/lib/api";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";

interface DailyChartProps {
  data: DailyItem[];
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const date = new Date(label).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-[12px] shadow-md space-y-1">
      <p className="font-medium text-foreground mb-1.5">{date}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: p.fill }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const LEGEND = [
  { label: "Принятые",    color: "bg-emerald-500" },
  { label: "Исходящие",   color: "bg-blue-500"    },
  { label: "Пропущенные", color: "bg-red-500"     },
];

export function DailyChart({ data }: DailyChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark    = resolvedTheme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const axisColor = isDark ? "#555" : "#aaa";

  const formatted = data.map(d => ({
    ...d,
    name: new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
  }));

  const tickInterval = data.length > 30 ? 6 : data.length > 14 ? 2 : 0;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">Динамика по дням</h3>
        <div className="flex items-center gap-3">
          {LEGEND.map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`h-2 w-2 rounded-sm ${color}`} />{label}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={formatted} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} interval={tickInterval} />
          <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="incoming" name="Принятые"    fill="#22c55e" radius={[3,3,0,0]} maxBarSize={20} />
          <Bar dataKey="outgoing" name="Исходящие"   fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={20} />
          <Bar dataKey="missed"   name="Пропущенные" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={20} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
