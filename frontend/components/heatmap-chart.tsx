"use client";

import { HeatmapCell } from "@/lib/api";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";

interface HeatmapChartProps {
  cells: HeatmapCell[];
}

const HOURS      = Array.from({ length: 24 }, (_, i) => i);
const DAYS       = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WORK_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const CELL_W     = 28;
const CELL_H     = 26;

export function HeatmapChart({ cells }: HeatmapChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const lookup: Record<string, number> = {};
  let maxVal = 0;
  for (const c of cells) {
    const key = `${c.weekday}_${c.hour}`;
    lookup[key] = c.total;
    if (c.total > maxVal) maxVal = c.total;
  }

  function getColor(val: number): string {
    if (val === 0) return isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
    const t = maxVal > 0 ? val / maxVal : 0;
    // emerald gradient: light → dark
    const r = Math.round(167 - (167 - 4)  * t);
    const g = Math.round(243 - (243 - 120) * t);
    const b = Math.round(208 - (208 - 87)  * t);
    const a = isDark ? 0.2 + t * 0.7 : 0.15 + t * 0.65;
    return `rgba(${r},${g},${b},${a})`;
  }

  function getTextColor(val: number): string {
    if (val === 0) return "transparent";
    const t = maxVal > 0 ? val / maxVal : 0;
    return isDark
      ? `rgba(255,255,255,${0.3 + t * 0.55})`
      : `rgba(0,0,0,${0.3 + t * 0.55})`;
  }

  const scaleSteps = [0.12, 0.3, 0.5, 0.7, 0.9];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">Тепловая карта нагрузки</h3>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
          <span>Меньше</span>
          <div className="flex gap-0.5">
            {scaleSteps.map((v, i) => (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-sm"
                style={{ background: getColor(Math.round(v * maxVal)) }}
              />
            ))}
          </div>
          <span>Больше</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${24 * CELL_W + 36}px` }}>
          {/* Часы */}
          <div className="flex mb-1" style={{ marginLeft: "36px" }}>
            {HOURS.map(h => (
              <div
                key={h}
                style={{ width: `${CELL_W}px`, flexShrink: 0 }}
                className={`text-center text-[9px] font-mono ${
                  WORK_HOURS.includes(h) ? "text-muted-foreground/60" : "text-muted-foreground/25"
                }`}
              >
                {h % 3 === 0 ? `${h}` : ""}
              </div>
            ))}
          </div>

          {/* Строки дней */}
          {DAYS.map((day, wd) => (
            <div key={wd} className="flex items-center mb-px">
              <div
                style={{ width: "36px", flexShrink: 0 }}
                className="text-[11px] text-muted-foreground/60 font-medium text-right pr-2"
              >
                {day}
              </div>
              {HOURS.map(h => {
                const val = lookup[`${wd}_${h}`] ?? 0;
                return (
                  <div
                    key={h}
                    style={{ width: `${CELL_W}px`, height: `${CELL_H}px`, flexShrink: 0, background: getColor(val) }}
                    className="rounded-sm mx-px flex items-center justify-center cursor-default group relative"
                    title={`${day} ${h}:00 — ${val} звонков`}
                  >
                    <span style={{ fontSize: "9px", color: getTextColor(val), fontVariantNumeric: "tabular-nums" }}>
                      {val > 0 ? val : ""}
                    </span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 pointer-events-none">
                      <div className="rounded-md border border-border bg-card px-2 py-1 text-[10px] whitespace-nowrap shadow-md">
                        {day} {String(h).padStart(2, "0")}:00 — <span className="font-medium tabular-nums">{val}</span> зв.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
