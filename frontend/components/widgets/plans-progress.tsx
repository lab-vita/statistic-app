"use client";

import { Target } from "lucide-react";
import type { HomeData } from "@/lib/home-data";
import { eachDate, todayKemerovo, verdictOf, type Verdict } from "@/lib/plan-forecast";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, num } from "./widget-card";
import { cn } from "@/lib/utils";

const ROWS = [
  { key: "calls_incoming", label: "Принятые звонки" },
  { key: "calls_outgoing", label: "Исходящие" },
  { key: "appt_count",     label: "Записи" },
] as const;

const BAR: Record<Verdict, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad:  "bg-red-500",
};
const TEXT: Record<Verdict, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad:  "text-red-600 dark:text-red-400",
};

export function PlansProgressWidget({ data, loading }: { data: HomeData; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;

  const plan = data.plan;
  const total = data.stats?.operators["total"];
  const fact: Record<string, number | null> = {
    calls_incoming: total ? total.incoming : null,
    calls_outgoing: total ? total.outgoing : null,
    appt_count:     data.appointments?.total.total ?? null,
  };

  // Сколько плана «должно» быть выполнено к сегодняшнему дню — по плану завершённых дней
  const today = todayKemerovo();
  const dates = data.dateFrom && data.dateTo ? eachDate(data.dateFrom, data.dateTo) : [];
  const expectedShare = (metric: string, planTotal: number) => {
    if (!plan || planTotal <= 0) return null;
    if (data.dateTo < today) return 1;
    const done = dates.filter(d => d < today).reduce((s, d) => s + (plan.by_day[d]?.[metric] ?? 0), 0);
    return done / planTotal;
  };

  const rows = ROWS.map(r => {
    const planTotal = plan?.totals[r.key] ?? 0;
    const f = fact[r.key];
    const share = expectedShare(r.key, planTotal);
    const pct = f !== null && planTotal > 0 ? (f / planTotal) * 100 : null;
    // оценка — по темпу: факт против ожидаемого к этому дню
    const verdict = pct !== null && share ? verdictOf(pct / share) : null;
    return { ...r, planTotal, fact: f, pct, share, verdict };
  }).filter(r => r.planTotal > 0);

  return (
    <WidgetCard>
      <WidgetHeader title="Выполнение планов" meta="отметка — где нужно быть сегодня" />
      {rows.length === 0 ? (
        <WidgetEmpty icon={Target} text="План на период не задан" hint="Задайте его в разделе «Планы»" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-2.5">
          {rows.map(r => (
            <div key={r.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
                <span className="truncate font-medium text-text-2">{r.label}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-bold">{r.fact === null ? "—" : num(r.fact)}</span>
                  <span className="text-text-3"> / {num(r.planTotal)}</span>
                  {r.pct !== null && (
                    <span className={cn("ml-2 font-bold", r.verdict ? TEXT[r.verdict] : "text-text-3")}>{Math.round(r.pct)}%</span>
                  )}
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-border">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", r.verdict ? BAR[r.verdict] : "bg-brand")}
                  style={{ width: `${Math.min(r.pct ?? 0, 100)}%` }}
                />
                {r.share !== null && r.share > 0 && r.share < 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-foreground/60"
                    style={{ left: `calc(${r.share * 100}% - 1px)` }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
