"use client";

import type { PaymentStatsResponse } from "@/lib/api";
import { WidgetCard, WidgetLabel, WidgetSkeleton, DeltaBadge } from "./widget-card";
import { cn } from "@/lib/utils";

export type RevenueMetric = "total_paid" | "count" | "avg_check";

export const REVENUE_METRICS: { key: RevenueMetric; label: string; hint: string }[] = [
  { key: "total_paid", label: "Выручка",     hint: "оплачено за период" },
  { key: "count",      label: "Платежей",    hint: "число оплат" },
  { key: "avg_check",  label: "Средний чек", hint: "выручка ÷ платежи" },
];

const rub = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(v)) + " ₽";

export function RevenueSingleWidget({ data, loading, metric = "total_paid" }: {
  data: PaymentStatsResponse | null; loading: boolean; metric?: RevenueMetric;
}) {
  if (loading) return <WidgetSkeleton />;

  const def = REVENUE_METRICS.find(m => m.key === metric) ?? REVENUE_METRICS[0];
  let value: string = "—";
  let delta: { pct: number | null; dir: string | null } | null = null;
  if (data) {
    if (def.key === "total_paid") {
      value = rub(data.total_paid);
      delta = { pct: data.total_paid_delta_pct, dir: data.total_paid_delta_dir };
    } else if (def.key === "count") {
      value = data.count.toLocaleString("ru-RU");
      delta = { pct: data.count_delta_pct, dir: data.count_delta_dir };
    } else {
      value = data.count > 0 ? rub(data.total_paid / data.count) : "—";
    }
  }

  return (
    <WidgetCard>
      <WidgetLabel>{def.label}</WidgetLabel>
      <p className={cn(
        "mt-1.5 truncate text-[length:min(30px,16cqw)] font-extrabold leading-none tracking-[-0.04em] tabular-nums",
        !data ? "text-text-3" : def.key === "total_paid" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
      )} title={value}>
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-text-3">
        {def.key === "total_paid" && data ? `${data.count.toLocaleString("ru-RU")} платежей` : def.hint}
      </p>
      <div className="mt-auto pt-2">
        {delta ? <DeltaBadge pct={delta.pct} dir={delta.dir} /> : <span className="text-[11px] text-text-3">&nbsp;</span>}
      </div>
    </WidgetCard>
  );
}
