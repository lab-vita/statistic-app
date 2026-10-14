"use client";

// Общие настройки и компоненты для всех графиков

import { useTheme } from "next-themes";

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    dark,
    grid:     dark ? "#192f45" : "#e8f2f9",
    axis:     dark ? "#7b9db8" : "#6f9fbd",
    cursor:   dark ? "rgba(74,163,224,0.08)" : "rgba(50,143,205,0.06)",
    tooltip: {
      contentStyle: {
        background: dark ? "#142739" : "#ffffff",
        border:     `1px solid ${dark ? "#1f3a54" : "#d6e8f5"}`,
        borderRadius: 8,
        fontSize: 12,
        color: dark ? "#e4eef7" : "#0d2236",
        boxShadow: dark ? "0 10px 28px rgba(0,0,0,0.45)" : "0 8px 24px rgba(15,60,100,0.12)",
      },
      labelStyle: { fontWeight: 600, marginBottom: 4 },
      itemStyle:  { padding: "1px 0" },
    },
  };
}

// Палитра серий
export const CHART_COLORS = {
  incoming: "#1a9e6e",
  outgoing: "#328fcd",
  missed:   "#e03a5a",
  received: "#94b3c9",
  lost:     "#e03a5a",
  amber:    "#e09020",
  violet:   "#8b5cf6",
};

// Форматтеры
export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

export const fmtDateLong = (d: unknown) =>
  new Date(String(d)).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
