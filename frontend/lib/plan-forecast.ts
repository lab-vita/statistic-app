/**
 * План и прогноз по звонкам.
 *
 * Прогноз считается ПО ПЛАНУ, а не по календарю: темп = факт ÷ план за уже ЗАВЕРШЁННЫЕ дни,
 * прогноз = темп × план на весь период. Так выходные и праздники (где в плане ноль)
 * не искажают результат. Сегодняшний день в темп не входит — он ещё не закончился.
 */
import type { DailyItem } from "@/lib/api";

export type PlanMetric = "calls_incoming" | "calls_outgoing";

export const PLAN_METRICS: { key: PlanMetric; label: string }[] = [
  { key: "calls_incoming", label: "Принятые"  },
  { key: "calls_outgoing", label: "Исходящие" },
];

export type Verdict = "good" | "warn" | "bad";

export interface PlanProgress {
  /** no-plan — плана нет; upcoming — период ещё не начался; in-progress — идёт; finished — закончился */
  state:       "no-plan" | "upcoming" | "in-progress" | "finished";
  planTotal:   number;
  fact:        number;
  /** факт ÷ план на весь период, % */
  factPct:     number | null;
  /** прогноз на конец периода (только пока период идёт) */
  forecast:    number | null;
  forecastPct: number | null;
  /** оценка: по прогнозу (идёт) или по итогу (закончился) */
  verdict:     Verdict | null;
}

/** Сегодняшняя дата по Кемерово (UTC+7), как и на сервере. */
export function todayKemerovo(nowMs: number = Date.now()): string {
  return new Date(nowMs + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Все даты от from до to включительно (ISO-строки). */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function verdictOf(pct: number): Verdict {
  return pct >= 100 ? "good" : pct >= 90 ? "warn" : "bad";
}

export function computePlanProgress(args: {
  byDay:    Record<string, Record<string, number>> | null | undefined;
  metric:   PlanMetric;
  days:     Pick<DailyItem, "date" | "incoming" | "outgoing">[];
  dateFrom: string;
  dateTo:   string;
  today:    string;
}): PlanProgress {
  const { byDay, metric, days, dateFrom, dateTo, today } = args;
  const dates = eachDate(dateFrom, dateTo);
  const planOf = (d: string) => byDay?.[d]?.[metric] ?? 0;
  const factByDate = new Map(days.map(d => [d.date, metric === "calls_incoming" ? d.incoming : d.outgoing]));
  const factOf = (d: string) => factByDate.get(d) ?? 0;

  const planTotal = dates.reduce((s, d) => s + planOf(d), 0);
  const fact      = dates.reduce((s, d) => s + factOf(d), 0);
  const base = { planTotal, fact, factPct: null, forecast: null, forecastPct: null, verdict: null } as const;

  if (planTotal <= 0) return { ...base, state: "no-plan" };

  const factPct = fact / planTotal * 100;

  if (dateTo < today) {
    return { ...base, state: "finished", factPct, verdict: verdictOf(factPct) };
  }
  if (dateFrom > today) {
    return { ...base, state: "upcoming", factPct };
  }

  // период идёт: темп по завершённым дням (строго до сегодняшнего)
  const done = dates.filter(d => d < today);
  const donePlan = done.reduce((s, d) => s + planOf(d), 0);
  const doneFact = done.reduce((s, d) => s + factOf(d), 0);
  if (donePlan <= 0) return { ...base, state: "in-progress", factPct };

  const pace = doneFact / donePlan;
  const forecastPct = pace * 100;
  return {
    ...base, state: "in-progress", factPct,
    forecast: Math.round(pace * planTotal), forecastPct, verdict: verdictOf(forecastPct),
  };
}
