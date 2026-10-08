"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ComparisonSeries, ComparisonMetric, OPERATOR_COLORS } from "@/lib/api";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ComparisonChartProps {
  series:         ComparisonSeries[];
  dates:          string[];
  metric:         ComparisonMetric;
  onMetricChange: (m: ComparisonMetric) => void;
}

const METRICS: { value: ComparisonMetric; label: string }[] = [
  { value: "total",    label: "Все"         },
  { value: "incoming", label: "Принятые"    },
  { value: "outgoing", label: "Исходящие"   },
  { value: "missed",   label: "Пропущенные" },
];

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const date = new Date(label).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-[12px] shadow-md space-y-1">
      <p className="font-medium mb-1.5">{date}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function shortName(name: string): string {
  const parts = name.split(" ");
  return parts[0] + (parts[1] ? " " + parts[1][0] + "." : "");
}

export function ComparisonChart({ series, dates, metric, onMetricChange }: ComparisonChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark    = resolvedTheme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const axisColor = isDark ? "#555" : "#aaa";

  const data = dates.map(d => {
    const row: Record<string, any> = { date: d };
    for (const s of series) {
      const found = s.values.find(v => v.date === d);
      row[s.operator_id] = found?.value ?? 0;
    }
    return row;
  });

  const formatDate    = (d: string) => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const tickInterval  = dates.length > 30 ? 6 : dates.length > 14 ? 2 : 0;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">Сравнение операторов</h3>
        <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5">
          {METRICS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onMetricChange(value)}
              className={cn(
                "rounded-md px-3 py-1 text-[12px] font-medium transition-all duration-150",
                metric === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
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
            axisLine={false} tickLine={false}
            interval={tickInterval}
          />
          <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
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
    </Card>
  );
}
