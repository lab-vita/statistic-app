"use client";
import { useState } from "react";
import { Target } from "lucide-react";
import type { DailyItem, PlanRangeResponse } from "@/lib/api";
import { formatPct } from "@/lib/call-metrics";
import {
  PLAN_METRICS, computePlanProgress, todayKemerovo,
  type PlanMetric, type Verdict,
} from "@/lib/plan-forecast";

const n = (v: number) => Math.round(v).toLocaleString("ru-RU");

const CHIP: Record<Verdict, string> = {
  good: "bg-white/25 text-white",
  warn: "bg-amber-300 text-amber-950",
  bad:  "bg-rose-500 text-white",
};
const NOTE: Record<Verdict, string> = {
  good: "идём в план",
  warn: "чуть не дотягиваем до плана",
  bad:  "не успеваем выполнить план",
};

/**
 * «План и прогноз»: факт против плана из раздела «Планы» и прогноз на конец периода.
 * Прогноз считается по плану (темп по завершённым дням), поэтому выходные его не искажают.
 */
export function CallsPlanWidget({ days, plan, dateFrom, dateTo, loading, metric: initial = "calls_incoming", today }: {
  days: DailyItem[]; plan: PlanRangeResponse | null; dateFrom: string; dateTo: string; loading: boolean;
  metric?: PlanMetric;
  /** только для тестов: «сегодняшняя» дата по Кемерово */
  today?: string;
}) {
  const [metric, setMetric] = useState<PlanMetric>(initial);
  if (loading) return <div className="h-full rounded-2xl bg-muted/40 animate-pulse" />;

  const p = computePlanProgress({
    byDay: plan?.by_day, metric, days, dateFrom, dateTo, today: today ?? todayKemerovo(),
  });
  const label = PLAN_METRICS.find(m => m.key === metric)!.label.toLowerCase();

  return (
    <div className="relative h-full rounded-2xl overflow-hidden p-4 flex flex-col gap-3 text-white
      bg-gradient-to-br from-emerald-600 to-teal-700">
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -right-3 -bottom-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />

      <div className="z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Target className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">План и прогноз</div>
            <div className="text-[11px] text-white/60">{label} звонки</div>
          </div>
        </div>
        <div className="flex gap-1" role="group" aria-label="Показатель плана">
          {PLAN_METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                metric === m.key ? "bg-white/25 text-white font-medium" : "text-white/60 hover:bg-white/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {p.state === "no-plan" ? (
        <div className="z-10 flex-1 flex flex-col items-center justify-center text-center gap-1">
          <div className="text-sm font-medium">План на этот период не задан</div>
          <div className="text-[11px] text-white/60">Его можно задать в разделе «Планы»</div>
        </div>
      ) : (
        <>
          <div className="z-10 flex items-end justify-between">
            <div>
              <span className="text-3xl font-bold tracking-tight tabular-nums">{n(p.fact)}</span>
              <span className="ml-1.5 text-sm text-white/60">из {n(p.planTotal)}</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold tabular-nums">{formatPct(p.factPct ?? 0)}</div>
              <div className="text-[11px] text-white/60">плана выполнено</div>
            </div>
          </div>

          <div className="z-10">
            <div
              className="relative h-3 rounded-full bg-white/20"
              role="progressbar" aria-label="Выполнение плана"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(p.factPct ?? 0))}
            >
              <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${Math.min(100, p.factPct ?? 0)}%` }} />
              {p.forecastPct !== null && (
                <div
                  title={`Прогноз: ${n(p.forecast ?? 0)}`}
                  className="absolute -top-1 -bottom-1 w-0.5 rounded bg-amber-200"
                  style={{ left: `${Math.min(100, p.forecastPct)}%` }}
                />
              )}
            </div>
          </div>

          <div className="z-10 mt-auto flex items-center justify-between gap-2 text-xs">
            {p.state === "in-progress" && p.forecast !== null && p.verdict && (
              <>
                <span className={`rounded-md px-2 py-1 font-semibold ${CHIP[p.verdict]}`}>
                  Прогноз {n(p.forecast)} · {formatPct(p.forecastPct ?? 0)} плана
                </span>
                <span className="text-white/70 text-right">
                  {NOTE[p.verdict]}
                  {p.forecast < p.planTotal && <>, не хватает {n(p.planTotal - p.forecast)}</>}
                </span>
              </>
            )}
            {p.state === "in-progress" && p.forecast === null && (
              <span className="text-white/70">Прогноз появится после первого завершённого дня</span>
            )}
            {p.state === "finished" && p.verdict && (
              <>
                <span className={`rounded-md px-2 py-1 font-semibold ${CHIP[p.verdict]}`}>
                  Итог: {formatPct(p.factPct ?? 0)} плана
                </span>
                <span className="text-white/70 text-right">
                  {(p.factPct ?? 0) >= 100 ? "план выполнен" : `не хватило ${n(p.planTotal - p.fact)}`}
                </span>
              </>
            )}
            {p.state === "upcoming" && <span className="text-white/70">Период ещё не начался</span>}
          </div>
        </>
      )}
    </div>
  );
}
