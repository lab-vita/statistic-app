"use client";

import { HeatmapCell } from "@/lib/api";
import { useTheme } from "next-themes";

interface HeatmapChartProps {
  cells: HeatmapCell[];
}

const HOURS      = Array.from({ length: 24 }, (_, i) => i);
const DAYS       = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WORK_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export function HeatmapChart({ cells }: HeatmapChartProps) {
  const { theme } = useTheme();
  const isDark    = theme === "dark";

  // Строим lookup: {weekday_hour: total}
  const lookup: Record<string, number> = {};
  let maxVal = 0;
  for (const c of cells) {
    const key = `${c.weekday}_${c.hour}`;
    lookup[key] = c.total;
    if (c.total > maxVal) maxVal = c.total;
  }

  function getColor(val: number): string {
    if (val === 0) return isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
    const intensity = maxVal > 0 ? val / maxVal : 0;
    if (isDark) {
      // Синий → зелёный в тёмной теме
      const r = Math.round(34  + (59  - 34)  * (1 - intensity));
      const g = Math.round(197 + (130 - 197) * (1 - intensity));
      const b = Math.round(94  + (246 - 94)  * (1 - intensity));
      return `rgba(${r},${g},${b},${0.15 + intensity * 0.75})`;
    } else {
      const r = Math.round(34  + (59  - 34)  * (1 - intensity));
      const g = Math.round(197 + (130 - 197) * (1 - intensity));
      const b = Math.round(94  + (246 - 94)  * (1 - intensity));
      return `rgba(${r},${g},${b},${0.12 + intensity * 0.7})`;
    }
  }

  function getTextColor(val: number): string {
    if (val === 0) return "transparent";
    const intensity = maxVal > 0 ? val / maxVal : 0;
    return isDark
      ? `rgba(255,255,255,${0.3 + intensity * 0.5})`
      : `rgba(0,0,0,${0.3 + intensity * 0.5})`;
  }

  const CELL_W = 28;
  const CELL_H = 26;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Тепловая карта нагрузки</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Меньше</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((v, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-sm"
                style={{ background: getColor(Math.round(v * maxVal)) }}
              />
            ))}
          </div>
          <span>Больше</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${24 * CELL_W + 36}px` }}>
          {/* Заголовок часов */}
          <div className="flex mb-1" style={{ marginLeft: "36px" }}>
            {HOURS.map(h => (
              <div
                key={h}
                style={{ width: `${CELL_W}px`, flexShrink: 0 }}
                className={`text-center text-[9px] font-mono ${
                  WORK_HOURS.includes(h) ? "text-muted-foreground" : "text-muted-foreground/40"
                }`}
              >
                {h === 0 || h % 3 === 0 ? `${h}` : ""}
              </div>
            ))}
          </div>

          {/* Строки по дням недели */}
          {DAYS.map((day, wd) => (
            <div key={wd} className="flex items-center mb-0.5">
              <div
                style={{ width: "36px", flexShrink: 0 }}
                className="text-[11px] text-muted-foreground font-medium text-right pr-2"
              >
                {day}
              </div>
              {HOURS.map(h => {
                const val = lookup[`${wd}_${h}`] ?? 0;
                return (
                  <div
                    key={h}
                    style={{
                      width: `${CELL_W}px`,
                      height: `${CELL_H}px`,
                      flexShrink: 0,
                      background: getColor(val),
                    }}
                    className="rounded-sm mx-px flex items-center justify-center cursor-default group relative"
                    title={`${day} ${h}:00 — ${val} звонков`}
                  >
                    <span
                      style={{ fontSize: "9px", color: getTextColor(val), fontFamily: "var(--font-mono)" }}
                      className="group-hover:opacity-100"
                    >
                      {val > 0 ? val : ""}
                    </span>

                    {/* Tooltip при наведении */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 pointer-events-none">
                      <div className="rounded-md border border-border bg-background px-2 py-1 text-[10px] whitespace-nowrap shadow-md">
                        {day} {String(h).padStart(2,"0")}:00 — <span className="font-mono font-medium">{val}</span> зв.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
