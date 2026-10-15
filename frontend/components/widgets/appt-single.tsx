"use client";

import type { AppointmentDailyItem, AppointmentStatsResponse } from "@/lib/api";
import { formatPct } from "@/lib/call-metrics";
import { SparkLine } from "@/components/ui/primitives";
import { WidgetCard, WidgetLabel, WidgetSkeleton, DeltaBadge, C, num } from "./widget-card";
import { cn } from "@/lib/utils";

export type ApptMetric = "total" | "visits" | "noshow" | "new_patients" | "visit_pct" | "noshow_pct";

export const APPT_METRICS: { key: ApptMetric; label: string; hint: string }[] = [
  { key: "total",        label: "Записи",          hint: "все записи на приём" },
  { key: "visits",       label: "Явки",            hint: "пациент пришёл" },
  { key: "noshow",       label: "Неявки",          hint: "записан, но не пришёл" },
  { key: "new_patients", label: "Новые пациенты",  hint: "первая запись в клинику" },
  { key: "visit_pct",    label: "% явок",          hint: "явки от всех записей" },
  { key: "noshow_pct",   label: "% неявок",        hint: "неявки от всех записей" },
];

const ACCENT: Record<ApptMetric, string> = {
  total:        "text-foreground",
  visits:       "text-emerald-600 dark:text-emerald-400",
  noshow:       "text-red-600 dark:text-red-400",
  new_patients: "text-violet-600 dark:text-violet-400",
  visit_pct:    "text-emerald-600 dark:text-emerald-400",
  noshow_pct:   "text-red-600 dark:text-red-400",
};

const SPARK: Partial<Record<ApptMetric, { key: keyof AppointmentDailyItem; color: string }>> = {
  total:        { key: "total",        color: C.blue },
  visits:       { key: "visits",       color: C.green },
  noshow:       { key: "noshow",       color: C.red },
  new_patients: { key: "new_patients", color: C.violet },
};

export function ApptSingleWidget({ data, daily, loading, metric = "total" }: {
  data: AppointmentStatsResponse | null; daily?: AppointmentDailyItem[]; loading: boolean; metric?: ApptMetric;
}) {
  if (loading) return <WidgetSkeleton />;

  const def = APPT_METRICS.find(m => m.key === metric) ?? APPT_METRICS[0];
  const t = data?.total;
  let value: string = "—";
  let delta: { pct: number | null; dir: string | null; invert?: boolean } | null = null;
  if (t) {
    switch (def.key) {
      case "total":        value = num(t.total);        delta = { pct: t.total_delta_pct, dir: t.total_delta_dir }; break;
      case "visits":       value = num(t.visits);       delta = { pct: t.visits_delta_pct, dir: t.visits_delta_dir }; break;
      case "noshow":       value = num(t.noshow);       delta = { pct: t.noshow_delta_pct, dir: t.noshow_delta_dir, invert: true }; break;
      case "new_patients": value = num(t.new_patients); delta = { pct: t.new_patients_delta_pct, dir: t.new_patients_delta_dir }; break;
      case "visit_pct":    value = formatPct(t.visit_pct); break;
      case "noshow_pct":   value = formatPct(t.noshow_pct); break;
    }
  }
  const spark = SPARK[def.key];
  const series = spark && daily && daily.length > 1 ? daily.map(d => Number(d[spark.key]) || 0) : null;
  const sub = t && (def.key === "visit_pct" || def.key === "noshow_pct")
    ? `${num(def.key === "visit_pct" ? t.visits : t.noshow)} из ${num(t.total)}`
    : def.hint;

  return (
    <WidgetCard>
      <div className="flex items-start justify-between gap-2">
        <WidgetLabel className="pt-0.5">{def.label}</WidgetLabel>
        {series && <div className="-mt-1 hidden shrink-0 @[13rem]:block"><SparkLine values={series} color={spark!.color} width={72} height={28} /></div>}
      </div>
      <p className={cn(
        "mt-1.5 truncate text-[length:min(30px,16cqw)] font-extrabold leading-none tracking-[-0.04em] tabular-nums",
        t ? ACCENT[def.key] : "text-text-3",
      )}>
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-text-3">{sub}</p>
      <div className="mt-auto pt-2">
        {delta ? <DeltaBadge pct={delta.pct} dir={delta.dir} invert={delta.invert} /> : <span className="text-[11px]">&nbsp;</span>}
      </div>
    </WidgetCard>
  );
}
