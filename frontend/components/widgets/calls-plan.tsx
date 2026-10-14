"use client";

import { useState } from "react";
import { Target, TrendingUp } from "lucide-react";
import type { DailyItem, PlanRangeResponse } from "@/lib/api";
import { formatPct } from "@/lib/call-metrics";
import {
  PLAN_METRICS, computePlanProgress, todayKemerovo,
  type PlanMetric, type Verdict,
} from "@/lib/plan-forecast";
import { WidgetCard, WidgetHeader, WidgetLabel, WidgetSkeleton, WidgetEmpty } from "./widget-card";
import { cn } from "@/lib/utils";

const n = (v: number) => Math.round(v).toLocaleString("ru-RU");

const VERDICT_BAR: Record<Verdict, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad:  "bg-red-500",
};
const VERDICT_TEXT: Record<Verdict, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad:  "text-red-600 dark:text-red-400",
};
const VERDICT_PILL: Record<Verdict, string> = {
  good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  bad:  "bg-red-500/10 text-red-600 dark:text-red-400",
};
const VERDICT_NOTE: Record<Verdict, string> = {
  good: "Идём в план",
  warn: "Чуть не дотягиваем",
  bad:  "Не успеваем выполнить план",
};

export function CallsPlanWidget({ days, plan, dateFrom, dateTo, loading, metric: initial = "calls_incoming", today }: {
  days: DailyItem[];
  plan: PlanRangeResponse | null;
  dateFrom: string;
  dateTo: string;
  loading: boolean;
  metric?: PlanMetric;
  today?: string;
}) {
  const [metric, setMetric] = useState<PlanMetric>(initial);

  if (loading) return <WidgetSkeleton />;

  const p     = computePlanProgress({ byDay: plan?.by_day, metric, days, dateFrom, dateTo, today: today ?? todayKemerovo() });
  const label = PLAN_METRICS.find(m => m.key === metric)!.label;

  const switcher = (
    <div className="inline-flex items-center gap-1" role="tablist" aria-label="Показатель плана">
      {PLAN_METRICS.map(m => (
        <button
          key={m.key}
          type="button"
          role="tab"
          aria-selected={metric === m.key}
          onClick={() => setMetric(m.key)}
          className={cn(
            "rounded-full border px-2.5 py-[3px] text-[11px] font-semibold transition-colors",
            metric === m.key
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-text-2 hover:border-brand hover:text-brand",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  return (
    <WidgetCard>
      <WidgetHeader title="План и прогноз" meta={`${label.toLowerCase()} звонки`} right={switcher} />

      {p.state === "no-plan" ? (
        <WidgetEmpty icon={Target} text="План на период не задан" hint="Задайте его в разделе «Планы»" />
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <WidgetLabel className="mb-1">Факт</WidgetLabel>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{n(p.fact)}</span>
                <span className="text-[12px] text-text-3">из {n(p.planTotal)}</span>
              </div>
            </div>
            <div className="text-right">
              <WidgetLabel className="mb-1">Выполнено</WidgetLabel>
              <span className={cn(
                "text-[22px] font-extrabold leading-none tabular-nums",
                p.verdict ? VERDICT_TEXT[p.verdict] : "text-foreground",
              )}>
                {formatPct(p.factPct ?? 0)}
              </span>
            </div>
          </div>

          <div className="relative mb-1 h-2 overflow-hidden rounded-full bg-border">
            <div
              className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                p.verdict ? VERDICT_BAR[p.verdict] : "bg-brand")}
              style={{ width: `${Math.min(100, p.factPct ?? 0)}%` }}
            />
            {p.forecastPct !== null && (
              <div
                className="absolute inset-y-0 w-0.5 bg-amber-500"
                style={{ left: `${Math.min(99, p.forecastPct)}%` }}
                title={`Прогноз: ${n(p.forecast ?? 0)}`}
              />
            )}
          </div>
          <div className="mb-3 flex justify-between text-[10px] tabular-nums text-text-3">
            <span>0</span>
            {p.forecastPct !== null && p.forecast !== null && (
              <span className="font-semibold text-amber-600 dark:text-amber-400">прогноз {n(p.forecast)}</span>
            )}
            <span>{n(p.planTotal)}</span>
          </div>

          <div className="mt-auto">
            {p.state === "in-progress" && p.verdict && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-[11px] font-bold", VERDICT_PILL[p.verdict])}>
                  <TrendingUp className="h-3 w-3" />
                  {VERDICT_NOTE[p.verdict]}
                </span>
                {p.forecast !== null && p.forecast < p.planTotal && (
                  <span className="text-[11px] text-text-3">не хватает {n(p.planTotal - p.forecast)}</span>
                )}
              </div>
            )}
            {p.state === "in-progress" && p.forecast === null && (
              <p className="text-[11px] text-text-3">Прогноз появится после первого завершённого дня</p>
            )}
            {p.state === "finished" && p.verdict && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn("inline-flex items-center rounded-[5px] px-2 py-1 text-[11px] font-bold", VERDICT_PILL[p.verdict])}>
                  {(p.factPct ?? 0) >= 100 ? "План выполнен" : `Итог: ${formatPct(p.factPct ?? 0)}`}
                </span>
                {(p.factPct ?? 0) < 100 && (
                  <span className="text-[11px] text-text-3">не хватило {n(p.planTotal - p.fact)}</span>
                )}
              </div>
            )}
            {p.state === "upcoming" && <p className="text-[11px] text-text-3">Период ещё не начался</p>}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
