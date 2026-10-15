"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useChartTheme, CHART_COLORS } from "./base-chart";
import { TabGroup } from "@/components/ui/primitives";
import type { SlotItem, DailyItem } from "@/lib/api";

const SLOTS = ["1м","5м","10м","15м","30м","1ч","2ч"];
const SLOT_VALS = [1, 5, 10, 15, 30, 60, 120];

interface Props {
  hourly?: SlotItem[];
  daily?:  DailyItem[];
  isDay:   boolean;
  interval:    number;
  onInterval:  (v: number) => void;
}

export function CallsTimeChart({ hourly, daily, isDay, interval, onInterval }: Props) {
  const ct = useChartTheme();
  const activeSlot = SLOTS[SLOT_VALS.indexOf(interval)] ?? "1ч";

  const data = isDay
    ? (hourly ?? [])
    : (daily ?? []).map(d => ({
        time: new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
        incoming: d.incoming,
        outgoing: d.outgoing,
        missed:   d.missed,
      }));

  const legend = [
    { color: CHART_COLORS.incoming, label: "Принятые" },
    { color: CHART_COLORS.outgoing, label: "Исходящие" },
    { color: CHART_COLORS.missed,   label: "Пропущенные" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <h3 className="text-[13px] font-semibold">
            {isDay ? "Распределение по времени" : "Динамика по дням"}
          </h3>
          <div className="hidden sm:flex items-center gap-3">
            {legend.map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <span className="h-2 w-2 rounded-sm inline-block" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
        {isDay && (
          <TabGroup
            small
            items={SLOTS}
            active={activeSlot}
            onChange={s => onInterval(SLOT_VALS[SLOTS.indexOf(s)])}
          />
        )}
      </div>
      <div className="p-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[12px] text-muted-foreground/50">
            Нет данных
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} barGap={2} barCategoryGap="35%"
              margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: ct.axis }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd" minTickGap={20}
              />
              <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} />
              <Tooltip
                {...ct.tooltip}
                cursor={{ fill: ct.cursor }}
              />
              <Bar dataKey="incoming" name="Принятые"    fill={CHART_COLORS.incoming} radius={[3,3,0,0]} maxBarSize={20} />
              <Bar dataKey="outgoing" name="Исходящие"   fill={CHART_COLORS.outgoing} radius={[3,3,0,0]} maxBarSize={20} />
              <Bar dataKey="missed"   name="Пропущенные" fill={CHART_COLORS.missed}   radius={[3,3,0,0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
