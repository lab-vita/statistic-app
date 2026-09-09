"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { SlotItem } from "@/lib/api";
import { useTheme } from "next-themes";

export const INTERVALS = [
  { value: 1,   label: "1 мин"  },
  { value: 5,   label: "5 мин"  },
  { value: 10,  label: "10 мин" },
  { value: 15,  label: "15 мин" },
  { value: 30,  label: "30 мин" },
  { value: 60,  label: "1 час"  },
  { value: 120, label: "2 часа" },
];

// Минимальная ширина одного столбца (группы баров) в пикселях
const BAR_GROUP_MIN_WIDTH = 36;

interface HourlyChartProps {
  data: SlotItem[];
  interval: number;
  onIntervalChange: (v: number) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md">
        <p className="font-mono font-medium mb-1.5">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="flex items-center justify-between gap-4">
            <span style={{ color: p.fill }}>{p.name}</span>
            <span className="font-mono font-medium">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function HourlyChart({ data, interval, onIntervalChange }: HourlyChartProps) {
  const { theme } = useTheme();
  const isDark    = theme === "dark";
  const gridColor = isDark ? "#ffffff10" : "#00000010";
  const axisColor = isDark ? "#666" : "#999";

  // Вычисляем нужную ширину графика
  const minChartWidth = Math.max(data.length * BAR_GROUP_MIN_WIDTH, 500);

  // Прореживаем подписи по оси X чтобы не перекрывались
  const tickInterval = interval <= 5 ? 11 : interval <= 15 ? 3 : interval <= 30 ? 1 : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Шапка */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium">Распределение по времени</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

        {/* Селектор интервала */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {INTERVALS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onIntervalChange(value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                interval === value
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Скроллируемый контейнер */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${minChartWidth}px`, height: "240px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
              barGap={2}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: axisColor }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
              />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? "#ffffff08" : "#00000008" }} />
              <Bar dataKey="incoming" name="Входящие"    fill="#22c55e" radius={[3,3,0,0]} maxBarSize={18} />
              <Bar dataKey="outgoing" name="Исходящие"   fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={18} />
              <Bar dataKey="missed"   name="Пропущенные" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}