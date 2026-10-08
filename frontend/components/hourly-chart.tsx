"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { SlotItem } from "@/lib/api";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export const INTERVALS = [
  { value: 1,   label: "1м"   },
  { value: 5,   label: "5м"   },
  { value: 10,  label: "10м"  },
  { value: 15,  label: "15м"  },
  { value: 30,  label: "30м"  },
  { value: 60,  label: "1ч"   },
  { value: 120, label: "2ч"   },
];

const BAR_GROUP_MIN_WIDTH = 36;

interface HourlyChartProps {
  data:             SlotItem[];
  interval:         number;
  onIntervalChange: (v: number) => void;
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-[12px] shadow-md space-y-1">
      <p className="font-medium tabular-nums mb-1.5">{label}</p>
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

export function HourlyChart({ data, interval, onIntervalChange }: HourlyChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark    = resolvedTheme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const axisColor = isDark ? "#555" : "#aaa";

  const minChartWidth  = Math.max(data.length * BAR_GROUP_MIN_WIDTH, 500);
  const tickInterval   = interval <= 5 ? 11 : interval <= 15 ? 3 : interval <= 30 ? 1 : 0;

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h3 className="text-[13px] font-semibold tracking-tight">Распределение по времени</h3>
          <div className="hidden items-center gap-3 sm:flex">
            {LEGEND.map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={`h-2 w-2 rounded-sm ${color}`} />{label}
              </span>
            ))}
          </div>
        </div>

        <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5">
          {INTERVALS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onIntervalChange(value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150",
                interval === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${minChartWidth}px`, height: "240px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="incoming" name="Принятые"    fill="#22c55e" radius={[3,3,0,0]} maxBarSize={18} />
              <Bar dataKey="outgoing" name="Исходящие"   fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={18} />
              <Bar dataKey="missed"   name="Пропущенные" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
