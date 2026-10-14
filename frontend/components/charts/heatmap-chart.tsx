"use client";

import { useState } from "react";
import { useChartTheme } from "./base-chart";
import type { HeatmapCell } from "@/lib/api";

const DAYS  = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type Metric = "total" | "incoming" | "missed";

const METRICS: { key: Metric; label: string }[] = [
  { key: "total",    label: "Все" },
  { key: "incoming", label: "Принятые" },
  { key: "missed",   label: "Пропущенные" },
];

interface Props { cells: HeatmapCell[] }

export function HeatmapChart({ cells }: Props) {
  const { dark } = useChartTheme();
  const [metric, setMetric] = useState<Metric>("total");

  // Индекс: weekday_hour → значение
  const lookup: Record<string, number> = {};
  let maxVal = 0;
  let peakDay = 0, peakHour = 0, peakVal = 0;

  for (const c of cells) {
    const val = metric === "incoming" ? c.incoming
              : metric === "missed"   ? c.missed
              : c.total;
    lookup[`${c.weekday}_${c.hour}`] = val;
    if (val > maxVal) maxVal = val;
    if (val > peakVal) { peakVal = val; peakDay = c.weekday; peakHour = c.hour; }
  }

  const getColor = (val: number): string => {
    if (val === 0) return dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
    const t = maxVal > 0 ? val / maxVal : 0;
    if (metric === "missed") {
      const a = dark ? 0.15 + t * 0.70 : 0.12 + t * 0.68;
      return `rgba(220, 38, 38, ${a})`; // red
    }
    if (metric === "incoming") {
      const a = dark ? 0.15 + t * 0.65 : 0.12 + t * 0.62;
      return `rgba(22, 163, 74, ${a})`; // green
    }
    // total — blue
    const a = dark ? 0.15 + t * 0.65 : 0.12 + t * 0.62;
    return `rgba(37, 99, 235, ${a})`;
  };

  const cellW = 28;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3 flex-wrap">
        <h3 className="text-[13px] font-semibold">Тепловая карта нагрузки</h3>

        {/* Переключатель метрики */}
        <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 gap-0.5">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={[
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150",
                metric === m.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Легенда */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/50">
          <span>Меньше</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((v, i) => (
              <div key={i} className="w-3 h-3 rounded-sm"
                style={{ background: getColor(Math.round(v * (maxVal || 1))) }} />
            ))}
          </div>
          <span>Больше</span>
        </div>
      </div>

      <div className="p-4 overflow-x-auto">
        <div style={{ minWidth: 24 * cellW + 36 }}>
          {/* часы */}
          <div className="flex mb-0.5" style={{ marginLeft: 36 }}>
            {HOURS.map(h => (
              <div key={h} style={{ width: cellW, flexShrink: 0 }}
                className="text-center text-[9px] text-muted-foreground/40 font-mono">
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>

          {/* Строки */}
          {DAYS.map((day, wd) => (
            <div key={wd} className="flex items-center mb-px">
              <div style={{ width: 36, flexShrink: 0 }}
                className="text-[11px] text-muted-foreground/60 font-medium text-right pr-2">
                {day}
              </div>
              {HOURS.map(h => {
                const val = lookup[`${wd}_${h}`] ?? 0;
                const isPeak = peakVal > 0 && wd === peakDay && h === peakHour;
                return (
                  <div key={h}
                    style={{ width: cellW, height: 22, flexShrink: 0, background: getColor(val) }}
                    className="rounded-sm mx-px flex items-center justify-center cursor-default group relative"
                    title={`${day} ${h}:00 — ${val} зв.`}
                  >
                    {isPeak && (
                      <div className="absolute inset-0 rounded-sm ring-1 ring-foreground/30 pointer-events-none" />
                    )}
                    {val > 0 && (
                      <span className="text-[9px] tabular-nums"
                        style={{
                          color: dark
                            ? `rgba(255,255,255,${0.3 + (val / maxVal) * 0.5})`
                            : `rgba(0,0,0,${0.3 + (val / maxVal) * 0.5})`,
                        }}>
                        {val}
                      </span>
                    )}
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 pointer-events-none">
                      <div className="rounded-md border border-border bg-card px-2 py-1 text-[10px] whitespace-nowrap shadow-md">
                        {day} {String(h).padStart(2, "0")}:00
                        {" — "}
                        <span className="font-semibold">{val}</span> зв.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Пиковая подсказка */}
      {peakVal > 0 && (
        <div className="px-4 pb-3 text-[11px] text-muted-foreground/50">
          Пик:{" "}
          <span className="font-semibold text-foreground/70">
            {DAYS[peakDay]}, {String(peakHour).padStart(2, "0")}:00–{String(peakHour + 1).padStart(2, "0")}:00
          </span>
          {" — "}{peakVal} зв.
        </div>
      )}
    </div>
  );
}
