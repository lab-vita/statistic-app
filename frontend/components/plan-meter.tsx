"use client";

/**
 * План в разделах: сколько плана выполнено за выбранный период.
 *
 * Период любой — день, неделя, месяц, квартал, год или свой. План за период —
 * сумма дневного плана (его раскладывает страница «Планы»). Если выбран текущий
 * месяц/квартал/год, период заканчивается вчера — тогда дополнительно показываем
 * план на весь месяц (квартал, год) и прогноз при текущем темпе.
 */
import { useEffect, useState } from "react";
import { fetchPlanRange, toDateStr, type PlanRangeResponse } from "@/lib/api";
import type { Period } from "@/lib/periods";
import { fmtPlan, verdictOf, VERDICT_BAR, VERDICT_TEXT, type PlanUnit } from "@/lib/plans";
import { cn } from "@/lib/utils";

/** Ответ /api/plans/range с выручкой и целевыми процентами. */
export type PlanRangeFull = PlanRangeResponse & {
  totals: PlanRangeResponse["totals"] & { revenue?: number };
  targets?: Partial<Record<PlanPctKey, number>>;
};

export type PlanSumKey = "calls_incoming" | "calls_outgoing" | "appt_count" | "revenue";
export type PlanPctKey = "conversion_pct" | "visit_pct";

export interface PeriodPlan {
  dateFrom: string;
  dateTo:   string;
  /** план за выбранный период */
  plan:     Record<PlanSumKey, number>;
  /** план на весь календарный период (месяц, квартал, год), если выбранный обрезан вчерашним днём */
  full:     Record<PlanSumKey, number> | null;
  fullLabel: string;
  targets:  Partial<Record<PlanPctKey, number>>;
}

const SUM_KEYS: PlanSumKey[] = ["calls_incoming", "calls_outgoing", "appt_count", "revenue"];

/** Конец календарного периода, в который попадает начало выбранного. */
function calendarEnd(p: Period): Date | null {
  const y = p.dateFrom.getFullYear(), m = p.dateFrom.getMonth();
  if (p.type === "month")   return new Date(y, m + 1, 0);
  if (p.type === "quarter") return new Date(y, Math.floor(m / 3) * 3 + 3, 0);
  if (p.type === "year")    return new Date(y, 12, 0);
  return null;
}

const FULL_LABEL: Partial<Record<Period["type"], string>> = { month: "на месяц", quarter: "на квартал", year: "на год" };

function sumRange(r: PlanRangeFull, from: string, to: string): Record<PlanSumKey, number> {
  const out = Object.fromEntries(SUM_KEYS.map(k => [k, 0])) as Record<PlanSumKey, number>;
  for (const [d, row] of Object.entries(r.by_day)) {
    if (d < from || d > to) continue;
    for (const k of SUM_KEYS) out[k] += row[k] ?? 0;
  }
  return out;
}

export function toPeriodPlan(r: PlanRangeFull, dateFrom: string, dateTo: string, fullTo?: string, fullLabel = ""): PeriodPlan {
  const plan = sumRange(r, dateFrom, dateTo);
  const full = fullTo && fullTo > dateTo ? sumRange(r, dateFrom, fullTo) : null;
  return { dateFrom, dateTo, plan, full, fullLabel, targets: r.targets ?? {} };
}

/** План за выбранный период (и на весь месяц/квартал/год, если период ещё идёт). */
export function usePeriodPlan(period: Period, enabled = true): PeriodPlan | null {
  const dateFrom = toDateStr(period.dateFrom);
  const dateTo   = toDateStr(period.dateTo);
  const end      = calendarEnd(period);
  const fullTo   = end ? toDateStr(end) : dateTo;
  const label    = FULL_LABEL[period.type] ?? "";
  const key      = `${dateFrom}|${dateTo}|${fullTo}`;
  const [state, setState] = useState<{ key: string; data: PeriodPlan | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchPlanRange(dateFrom, fullTo > dateTo ? fullTo : dateTo)
      .then(r => { if (alive) setState({ key, data: toPeriodPlan(r, dateFrom, dateTo, fullTo, label) }); })
      .catch(() => { if (alive) setState({ key, data: null }); });
    return () => { alive = false; };
  }, [enabled, key, dateFrom, dateTo, fullTo, label]);

  return enabled && state?.key === key ? state.data : null;
}

function Bar({ pct, cls, mark }: { pct: number; cls: string; mark?: number | null }) {
  return (
    <div className="relative h-1.5 rounded-full bg-border">
      <div className={cn("h-full rounded-full transition-all duration-500", cls)} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
      {mark != null && mark > 0 && mark < 100 && (
        <span aria-hidden="true" className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-foreground/60"
              style={{ left: `calc(${mark}% - 1px)` }} />
      )}
    </div>
  );
}

const fmtPctNum = (v: number) => `${Math.round(v)}%`;

/**
 * Выполнение плана-суммы: «план N · X%», полоса и, если период ещё идёт,
 * план на месяц (квартал, год) с прогнозом. Без плана ничего не рисует.
 */
export function PlanMeter({ info, metric, fact, unit = "count", className }: {
  info: PeriodPlan | null; metric: PlanSumKey; fact: number | null | undefined; unit?: PlanUnit; className?: string;
}) {
  if (!info || fact == null) return null;
  const plan = info.plan[metric];
  const full = info.full?.[metric] ?? 0;
  if (plan <= 0 && full <= 0) return null;

  // план за период есть — оцениваем по нему; нет (выходные) — только план на месяц
  const pct = plan > 0 ? fact / plan * 100 : null;
  const verdict = pct != null ? verdictOf(pct) : null;
  const showFull = full > plan;
  const forecast = showFull && plan > 0 ? Math.round(fact / plan * full) : null;
  const forecastVerdict = forecast != null ? verdictOf(forecast / full * 100) : null;

  return (
    <div className={cn("mt-3.5 space-y-1.5 border-t border-hairline pt-3", className)}>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate text-text-3">
          {plan > 0 ? <>План <span className="font-semibold text-text-2 tabular-nums">{fmtPlan(plan, unit)}</span></> : "Плана за период нет"}
        </span>
        {pct != null && verdict && (
          <span className={cn("shrink-0 font-bold tabular-nums", VERDICT_TEXT[verdict])}>{fmtPctNum(pct)}</span>
        )}
      </div>
      {pct != null && verdict && <Bar pct={pct} cls={VERDICT_BAR[verdict]} />}
      {showFull && (
        <p className="text-[11px] leading-snug text-text-3">
          {info.fullLabel} <span className="tabular-nums">{fmtPlan(full, unit)}</span>
          {forecast != null && forecastVerdict && (
            <> · прогноз <span className={cn("font-semibold tabular-nums", VERDICT_TEXT[forecastVerdict])}>{fmtPlan(forecast, unit)}</span></>
          )}
        </p>
      )}
    </div>
  );
}

/** Целевой процент: «цель 35% · выше / ниже на N п.п.». Без цели ничего не рисует. */
export function TargetMeter({ info, metric, value, label = "Цель", className }: {
  info: PeriodPlan | null; metric: PlanPctKey; value: number | null | undefined; label?: string; className?: string;
}) {
  const target = info?.targets[metric];
  if (target == null || target <= 0 || value == null) return null;
  const ratio = value / target * 100;
  const verdict = verdictOf(ratio);
  const diff = value - target;
  const pp = Math.abs(diff).toFixed(1).replace(".", ",").replace(",0", "");
  return (
    <div className={cn("mt-3.5 space-y-1.5 border-t border-hairline pt-3", className)}>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate text-text-3">
          {label} <span className="font-semibold text-text-2 tabular-nums">{fmtPlan(target, "pct")}</span>
        </span>
        <span className={cn("shrink-0 font-bold tabular-nums", VERDICT_TEXT[verdict])}>
          {Math.abs(diff) < 0.05 ? "в цели" : diff > 0 ? `+${pp} п.п.` : `−${pp} п.п.`}
        </span>
      </div>
      <Bar pct={ratio} cls={VERDICT_BAR[verdict]} />
    </div>
  );
}
