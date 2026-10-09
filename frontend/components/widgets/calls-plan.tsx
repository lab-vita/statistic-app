"use client";

import { useState } from "react";
import { Target, TrendingUp } from "lucide-react";
import type { DailyItem, PlanRangeResponse } from "@/lib/api";
import { formatPct } from "@/lib/call-metrics";
import {
  PLAN_METRICS, computePlanProgress, todayKemerovo,
  type PlanMetric, type Verdict,
} from "@/lib/plan-forecast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const n = (v: number) => Math.round(v).toLocaleString("ru-RU");

const VERDICT_BAR: Record<Verdict, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad:  "bg-red-500",
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

  if (loading) return <div className="h-full rounded-lg bg-muted/60 animate-pulse" />;

  const p     = computePlanProgress({ byDay: plan?.by_day, metric, days, dateFrom, dateTo, today: today ?? todayKemerovo() });
  const label = PLAN_METRICS.find(m => m.key === metric)!.label;

  return (
    <Card className="h-full flex flex-col p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
            <Target className="h-3.5 w-3.5 text-muted-foreground/70" />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-none">План и прогноз</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{label.toLowerCase()} звонки</p>
          </div>
        </div>
        <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5">
          {PLAN_METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150",
                metric === m.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* No plan */}
      {p.state === "no-plan" ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1">
          <Target className="h-7 w-7 text-muted-foreground/30 mb-1" />
          <p className="text-[13px] font-medium text-muted-foreground">План на период не задан</p>
          <p className="text-[11px] text-muted-foreground/60">Задайте его в разделе «Планы»</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between">
          {/* Числа */}
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">Факт</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">{n(p.fact)}</span>
                <span className="text-[13px] text-muted-foreground/60">из {n(p.planTotal)}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">Выполнено</p>
              <span className={cn(
                "text-[22px] font-semibold leading-none tabular-nums",
                p.verdict ? (p.verdict === "good" ? "text-emerald-600 dark:text-emerald-400"
                           : p.verdict === "warn" ? "text-amber-600 dark:text-amber-400"
                           : "text-red-600 dark:text-red-400") : "text-foreground"
              )}>
                {formatPct(p.factPct ?? 0)}
              </span>
            </div>
          </div>

          {/* Прогресс-бар */}
          <div className="relative h-2 rounded-full bg-border overflow-hidden mb-1">
            <div
              className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                p.verdict ? VERDICT_BAR[p.verdict] : "bg-foreground"
              )}
              style={{ width: `${Math.min(100, p.factPct ?? 0)}%` }}
            />
            {p.forecastPct !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 opacity-80"
                style={{ left: `${Math.min(99, p.forecastPct)}%` }}
                title={`Прогноз: ${n(p.forecast ?? 0)}`}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/50 mb-4 tabular-nums">
            <span>0</span>
            {p.forecastPct !== null && p.forecast !== null && (
              <span className="text-amber-600 dark:text-amber-400">прогноз {n(p.forecast)}</span>
            )}
            <span>{n(p.planTotal)}</span>
          </div>

          {/* Вердикт */}
          {p.state === "in-progress" && p.verdict && (
            <div className="flex items-center justify-between gap-2">
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium", VERDICT_PILL[p.verdict])}>
                <TrendingUp className="h-3 w-3" />
                {VERDICT_NOTE[p.verdict]}
              </span>
              {p.forecast !== null && p.forecast < p.planTotal && (
                <span className="text-[11px] text-muted-foreground/60">
                  не хватает {n(p.planTotal - p.forecast)}
                </span>
              )}
            </div>
          )}
          {p.state === "in-progress" && p.forecast === null && (
            <p className="text-[11px] text-muted-foreground/60">
              Прогноз появится после первого завершённого дня
            </p>
          )}
          {p.state === "finished" && p.verdict && (
            <div className="flex items-center justify-between gap-2">
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium", VERDICT_PILL[p.verdict])}>
                {(p.factPct ?? 0) >= 100 ? "План выполнен" : `Итог: ${formatPct(p.factPct ?? 0)}`}
              </span>
              {(p.factPct ?? 0) < 100 && (
                <span className="text-[11px] text-muted-foreground/60">не хватило {n(p.planTotal - p.fact)}</span>
              )}
            </div>
          )}
          {p.state === "upcoming" && (
            <p className="text-[11px] text-muted-foreground/60">Период ещё не начался</p>
          )}
        </div>
      )}
    </Card>
  );
}
