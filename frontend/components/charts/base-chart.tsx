"use client";

// Общие настройки и компоненты для всех графиков

import { useTheme } from "next-themes";

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    dark,
    grid:     dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    axis:     dark ? "#555" : "#aaa",
    cursor:   dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
    tooltip: {
      contentStyle: {
        background: dark ? "#1f2937" : "#ffffff",
        border:     `1px solid ${dark ? "rgba(255,255,255,0.1)" : "#e5e7eb"}`,
        borderRadius: 8,
        fontSize: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      },
      labelStyle: { fontWeight: 600, marginBottom: 4 },
      itemStyle:  { padding: "1px 0" },
    },
  };
}

// Палитра серий
export const CHART_COLORS = {
  incoming: "#16a34a",
  outgoing: "#2563eb",
  missed:   "#dc2626",
  received: "#6b7280",
  lost:     "#dc2626",
  amber:    "#d97706",
  violet:   "#7c3aed",
};

// Форматтеры
export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

export const fmtDateLong = (d: unknown) =>
  new Date(String(d)).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
