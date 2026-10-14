"use client";

import { Grid3x3 } from "lucide-react";
import type { HeatmapResponse } from "@/lib/api";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, num } from "./widget-card";

export type HeatmapMetric = "total" | "incoming" | "missed";

export const HEATMAP_METRICS: { key: HeatmapMetric; label: string; hint: string }[] = [
  { key: "total",    label: "Все звонки",  hint: "входящие и исходящие" },
  { key: "incoming", label: "Принятые",    hint: "отвеченные входящие" },
  { key: "missed",   label: "Пропущенные", hint: "когда не успевают ответить" },
];

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Цвет ячейки — бренд или красный, насыщенность по доле от максимума. */
const cellColor = (metric: HeatmapMetric, share: number) =>
  share <= 0 ? "transparent"
  : metric === "missed"
    ? `color-mix(in oklab, var(--color-red-500) ${Math.round(12 + share * 78)}%, transparent)`
    : `color-mix(in oklab, var(--color-brand) ${Math.round(10 + share * 80)}%, transparent)`;

export function CallsHeatmapWidget({ data, loading, metric = "total" }: {
  data: HeatmapResponse | null; loading: boolean; metric?: HeatmapMetric;
}) {
  if (loading) return <WidgetSkeleton />;

  const def = HEATMAP_METRICS.find(m => m.key === metric) ?? HEATMAP_METRICS[0];
  const cells = data?.cells ?? [];
  const val = new Map<string, number>();
  for (const c of cells) val.set(`${c.weekday}-${c.hour}`, (val.get(`${c.weekday}-${c.hour}`) ?? 0) + (c[def.key] ?? 0));

  const active = cells.filter(c => c.total > 0).map(c => c.hour);
  const fromH = active.length ? Math.min(...active) : 8;
  const toH   = active.length ? Math.max(...active) : 20;
  const hours = Array.from({ length: toH - fromH + 1 }, (_, i) => fromH + i);

  let max = 0, peak: { d: number; h: number; v: number } | null = null;
  for (const [k, v] of val) {
    if (v > max) {
      max = v;
      const [d, h] = k.split("-").map(Number);
      peak = { d, h, v };
    }
  }

  return (
    <WidgetCard>
      <WidgetHeader
        title={`Нагрузка по часам · ${def.label.toLowerCase()}`}
        meta={peak ? `пик — ${DAYS[peak.d]} ${String(peak.h).padStart(2, "0")}:00, ${num(peak.v)}` : def.hint}
      />
      {max === 0 ? (
        <WidgetEmpty icon={Grid3x3} text="Нет звонков за период" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-[3px]">
          {DAYS.map((dName, d) => (
            <div key={dName} className="flex min-h-0 flex-1 items-stretch gap-[3px]">
              <span className="flex w-6 shrink-0 items-center text-[10px] font-semibold text-text-3">{dName}</span>
              {hours.map(h => {
                const v = val.get(`${d}-${h}`) ?? 0;
                return (
                  <div
                    key={h}
                    title={`${dName} ${String(h).padStart(2, "0")}:00 — ${num(v)}`}
                    className="min-w-0 flex-1 rounded-[3px] bg-accent/50"
                    style={{ background: v > 0 ? cellColor(def.key, v / max) : undefined }}
                  />
                );
              })}
            </div>
          ))}
          <div className="flex shrink-0 gap-[3px] pt-0.5">
            <span className="w-6 shrink-0" />
            {hours.map(h => (
              <span key={h} className="min-w-0 flex-1 text-center text-[9px] tabular-nums text-text-3">
                {h % 2 === fromH % 2 ? h : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
