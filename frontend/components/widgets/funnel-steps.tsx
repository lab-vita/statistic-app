"use client";

import { ChevronRight } from "lucide-react";
import type { HomeData } from "@/lib/home-data";
import { WidgetCard, WidgetSkeleton, num, rub, rubShort } from "./widget-card";
import { cn } from "@/lib/utils";

const tone = (pct: number, good: number, bad: number) =>
  pct >= good ? "text-emerald-600 dark:text-emerald-400"
  : pct >= bad ? "text-amber-600 dark:text-amber-400"
  : "text-red-600 dark:text-red-400";

/**
 * Те же формулы, что в разделе «Воронка». Колл-центр: звонки операторов →
 * записанные ими пациенты → сколько из них пришли. Клиника: все записи на приём
 * в периоде (кто бы их ни сделал) → явки → выручка.
 */
export function funnelOf(data: HomeData) {
  const conv    = data.conversionData?.total ?? null;
  const t       = data.appointments?.total ?? null;
  const revenue = data.payments?.total_paid ?? null;
  const resolved = t ? t.visits + t.noshow + t.cancels : 0;
  return {
    calls:       conv?.incoming ?? null,
    appts:       conv?.appointments ?? null,
    callsToAppt: conv ? conv.conversion_pct : null,
    ccVisits:    conv?.visited ?? null,
    ccVisitPct:  conv?.visited !== undefined ? (conv.visit_pct ?? null) : null,
    clinicTotal:  t?.total ?? null,
    clinicVisits: t?.visits ?? null,
    clinicVisitPct: t && resolved ? (t.visits / resolved) * 100 : null,
    revenue,
    perVisit: revenue !== null && t?.visits ? revenue / t.visits : null,
  };
}

const pctSub = (pct: number | null, what: string) => (pct === null ? undefined : `${pct.toFixed(0)}% ${what}`);

function Step({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg bg-background px-3 py-2">
      <p className="truncate text-[10px] font-bold uppercase tracking-[.07em] text-text-3">{label}</p>
      <p className={cn("mt-1 truncate text-[20px] font-extrabold leading-none tracking-[-0.04em] tabular-nums @[40rem]:text-[24px]", accent)}>
        {value}
      </p>
      {sub && <p className="mt-1 truncate text-[10px] text-text-3">{sub}</p>}
    </div>
  );
}

function Arrow({ pct, good = 0, bad = 0 }: { pct?: number | null; good?: number; bad?: number }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-0.5">
      {pct !== undefined && (
        <span className={cn("text-[11px] font-bold tabular-nums", pct === null ? "text-text-3" : tone(pct, good, bad))}>
          {pct === null ? "—" : `${pct.toFixed(0)}%`}
        </span>
      )}
      <ChevronRight className="h-4 w-4 text-text-3/50" />
    </div>
  );
}

export function FunnelStepsWidget({ data, loading }: { data: HomeData; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;
  const f = funnelOf(data);
  const v = (n: number | null) => (n === null ? "—" : num(n));

  return (
    <WidgetCard className="py-3.5">
      <p className="metric-label mb-2 shrink-0">Воронка: от звонка до оплаты</p>
      {/* широко — один ряд шагов */}
      <div className="hidden min-h-0 flex-1 items-stretch gap-1 @[40rem]:flex">
        <Step label="Принято звонков" value={v(f.calls)} sub="колл-центр" accent="text-foreground" />
        <Arrow pct={f.callsToAppt} good={50} bad={30} />
        <Step label="Записались" value={v(f.appts)} sub="пациентов колл-центра" accent="text-blue-600 dark:text-blue-400" />
        <Arrow pct={f.ccVisitPct} good={80} bad={60} />
        <Step label="Пришли" value={v(f.ccVisits)} sub="из записанных колл-центром" accent="text-emerald-600 dark:text-emerald-400" />
        <div aria-hidden="true" className="mx-1.5 w-px shrink-0 self-stretch bg-hairline" />
        <Step
          label="Явки клиники"
          value={v(f.clinicVisits)}
          sub={f.clinicTotal !== null ? `из ${num(f.clinicTotal)} записей` : undefined}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <Arrow />
        <Step
          label="Выручка"
          value={f.revenue === null ? "—" : rubShort(f.revenue)}
          sub={f.perVisit !== null ? `${rub(f.perVisit)} на визит` : undefined}
          accent="text-emerald-600 dark:text-emerald-400"
        />
      </div>
      {/* узко — две группы плиток: колл-центр и вся клиника */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 @[40rem]:hidden">
        <div className="grid flex-1 grid-cols-3 gap-1.5">
          <Step label="Звонки" value={v(f.calls)} sub="колл-центр" accent="text-foreground" />
          <Step label="Записались" value={v(f.appts)} sub={pctSub(f.callsToAppt, "от звонков")} accent="text-blue-600 dark:text-blue-400" />
          <Step label="Пришли" value={v(f.ccVisits)} sub={pctSub(f.ccVisitPct, "явка")} accent="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <Step
            label="Явки клиники"
            value={v(f.clinicVisits)}
            sub={f.clinicTotal !== null ? `из ${num(f.clinicTotal)} записей` : undefined}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <Step
            label="Выручка"
            value={f.revenue === null ? "—" : rubShort(f.revenue)}
            sub={f.perVisit !== null ? `${rub(f.perVisit)} на визит` : undefined}
            accent="text-emerald-600 dark:text-emerald-400"
          />
        </div>
      </div>
    </WidgetCard>
  );
}
