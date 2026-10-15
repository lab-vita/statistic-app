"use client";

import { ChevronRight } from "lucide-react";
import type { HomeData } from "@/lib/home-data";
import { WidgetCard, WidgetSkeleton, num, rub, rubShort } from "./widget-card";
import { cn } from "@/lib/utils";

const tone = (pct: number, good: number, bad: number) =>
  pct >= good ? "text-emerald-600 dark:text-emerald-400"
  : pct >= bad ? "text-amber-600 dark:text-amber-400"
  : "text-red-600 dark:text-red-400";

/** Те же формулы, что в разделе «Воронка»: звонки и записи — операторов колл-центра. */
export function funnelOf(data: HomeData) {
  const conv    = data.conversionData?.total ?? null;
  const calls   = conv?.incoming ?? null;
  const appts   = conv?.appointments ?? null;
  const visits  = data.appointments?.total.visits ?? null;
  const revenue = data.payments?.total_paid ?? null;
  const pct = (a: number | null, b: number | null) => (a !== null && b ? (a / b) * 100 : null);
  return {
    calls, appts, visits, revenue,
    callsToAppt: conv ? conv.conversion_pct : null,
    apptToVisit: pct(visits, appts),
    perVisit:    revenue !== null && visits ? revenue / visits : null,
  };
}

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
      <div className="flex min-h-0 flex-1 items-stretch gap-1">
        <Step label="Принято звонков" value={v(f.calls)} sub="колл-центр" accent="text-foreground" />
        <Arrow pct={f.callsToAppt} good={50} bad={30} />
        <Step label="Записались" value={v(f.appts)} sub="через колл-центр" accent="text-blue-600 dark:text-blue-400" />
        <Arrow pct={f.apptToVisit} good={80} bad={60} />
        <Step label="Пришли" value={v(f.visits)} sub="явки по всем записям" accent="text-emerald-600 dark:text-emerald-400" />
        <Arrow />
        <Step
          label="Выручка"
          value={f.revenue === null ? "—" : rubShort(f.revenue)}
          sub={f.perVisit !== null ? `${rub(f.perVisit)} на визит` : undefined}
          accent="text-emerald-600 dark:text-emerald-400"
        />
      </div>
    </WidgetCard>
  );
}
