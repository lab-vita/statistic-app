"use client";

import { CalendarX } from "lucide-react";
import type { AppointmentStatsResponse } from "@/lib/api";
import { formatPct } from "@/lib/call-metrics";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, DeltaBadge } from "./widget-card";
import { cn } from "@/lib/utils";

const n = (v: number) => v.toLocaleString("ru-RU");

export function ApptSummaryWidget({ data, loading }: { data: AppointmentStatsResponse | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;

  const t = data?.total;
  if (!t) {
    return (
      <WidgetCard>
        <WidgetHeader title="Записи за период" />
        <WidgetEmpty icon={CalendarX} text="Нет данных о записях" />
      </WidgetCard>
    );
  }

  const tiles = [
    { label: "Явки",           value: t.visits,       accent: "text-emerald-600 dark:text-emerald-400", sub: `${formatPct(t.visit_pct)} от записей`,
      delta: <DeltaBadge pct={t.visits_delta_pct} dir={t.visits_delta_dir} /> },
    { label: "Неявки",         value: t.noshow,       accent: t.noshow_pct > 10 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400", sub: formatPct(t.noshow_pct),
      delta: <DeltaBadge pct={t.noshow_delta_pct} dir={t.noshow_delta_dir} invert /> },
    { label: "Новые пациенты", value: t.new_patients, accent: "text-violet-600 dark:text-violet-400", sub: `${formatPct(t.new_pct)} от записей`,
      delta: <DeltaBadge pct={t.new_patients_delta_pct} dir={t.new_patients_delta_dir} /> },
    { label: "Ожидают",        value: t.pending,      accent: "text-foreground", sub: "не подтверждены", delta: null },
  ];

  return (
    <WidgetCard>
      <WidgetHeader
        title="Записи за период"
        meta={`всего ${n(t.total)}`}
        right={<DeltaBadge pct={t.total_delta_pct} dir={t.total_delta_dir} />}
      />
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        {tiles.map(x => (
          <div key={x.label} className="flex min-w-0 flex-col justify-center rounded-lg bg-background px-3 py-2.5">
            <p className="truncate text-[10px] font-bold uppercase tracking-[.07em] text-text-3">{x.label}</p>
            <p className={cn("mt-1 truncate text-[22px] font-extrabold leading-none tracking-[-0.04em] tabular-nums", x.accent)}>
              {n(x.value)}
            </p>
            <p className="mt-1 truncate text-[10px] text-text-3">{x.sub}</p>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
