"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ComparisonSeries, ComparisonMetric, OPERATOR_COLORS } from "@/lib/api";
import { useTheme } from "next-themes";

interface ComparisonChartProps {
  series: ComparisonSeries[];
  dates: string[];
  metric: ComparisonMetric;
  onMetricChange: (m: ComparisonMetric) => void;
}

const METRICS: { value: ComparisonMetric; label: string }[] = [
  { value: "total",    label: "Все"         },
  { value: "incoming", label: "Входящие"    },
  { value: "outgoing", label: "Исходящие"   },
  { value: "missed",   label: "Пропущенные" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const date = new Date(label).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md space-y-1">
      <p className="font-medium text-foreground mb-1">{date}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// Сокращаем имя оператора для легенды
function shortName(name: string): string {
  const parts = name.split(" ");
  return parts[0] + (parts[1] ? " " + parts[1][0] + "." : "");
}

export function ComparisonChart({ series, dates, metric, onMetricChange }: ComparisonChartProps) {
  const { theme } = useTheme();
  const isDark    = theme === "dark";
  const gridColor = isDark ? "#ffffff10" : "#00000010";
  const axisColor = isDark ? "#666" : "#999";

  // Готовим данные для recharts: [{date, name1: val, name2: val, ...}]
  const data = dates.map(d => {
    const row: Record<string, any> = { date: d };
    for (const s of series) {
      const found = s.values.find(v => v.date === d);
      row[s.operator_id] = found?.value ?? 0;
    }
    return row;
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  // Прореживаем подписи если дат много
  const tickInterval = dates.length > 30 ? 6 : dates.length > 14 ? 2 : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Сравнение операторов</h3>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {METRICS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onMetricChange(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                metric === value
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: axisColor }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => {
              const s = series.find(s => s.operator_id === value);
              return <span style={{ fontSize: 11 }}>{s ? shortName(s.name) : value}</span>;
            }}
          />
          {series.map((s, i) => {
            const colors = OPERATOR_COLORS[i % 4];
            return (
              <Line
                key={s.operator_id}
                type="monotone"
                dataKey={s.operator_id}
                name={s.operator_id}
                stroke={colors.text}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
