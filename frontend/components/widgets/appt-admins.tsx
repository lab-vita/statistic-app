"use client";

import { Users } from "lucide-react";
import type { AppointmentStatsResponse } from "@/lib/api";
import { formatPct } from "@/lib/call-metrics";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, num } from "./widget-card";
import { cn } from "@/lib/utils";

const TH = "px-3 py-2 text-[10px] font-bold uppercase tracking-[.06em] text-text-3 whitespace-nowrap border-b border-hairline";
const TD = "px-3 py-[9px] border-b border-hairline text-[12px] tabular-nums";

const noshowTone = (pct: number) =>
  pct > 15 ? "text-red-600 dark:text-red-400" : pct > 10 ? "text-amber-600 dark:text-amber-400" : "text-text-2";

export function ApptAdminsWidget({ data, loading }: { data: AppointmentStatsResponse | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;

  const rows = Object.entries(data?.by_admin ?? {})
    .map(([key, a]) => ({ key, ...a }))
    .filter(a => a.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <WidgetCard className="px-0 pb-0">
      <div className="px-5">
        <WidgetHeader title="Записи по сотрудникам" meta={rows.length ? `${rows.length} сотрудников` : undefined} />
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-1 px-5 pb-[18px]">
          <WidgetEmpty icon={Users} text="Нет записей за период" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className={cn(TH, "pl-5 text-left")}>Сотрудник</th>
                <th className={cn(TH, "text-right")}>Записей</th>
                <th className={cn(TH, "text-right")}>Явки</th>
                <th className={cn(TH, "pr-5 text-right @[30rem]:pr-3")}>Неявки</th>
                <th className={cn(TH, "hidden pr-5 text-right @[30rem]:table-cell")}>Новые</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.key} className="transition-colors hover:bg-accent/50">
                  <td className={cn(TD, "max-w-0 pl-5")}>
                    <span className="block truncate font-semibold" title={a.name}>{a.name}</span>
                    {a.group_label && <span className="block truncate text-[10px] text-text-3">{a.group_label}</span>}
                  </td>
                  <td className={cn(TD, "text-right font-bold")}>{num(a.total)}</td>
                  <td className={cn(TD, "text-right text-emerald-600 dark:text-emerald-400")}>{formatPct(a.visit_pct)}</td>
                  <td className={cn(TD, "pr-5 text-right @[30rem]:pr-3", noshowTone(a.noshow_pct))}>{formatPct(a.noshow_pct)}</td>
                  <td className={cn(TD, "hidden pr-5 text-right text-text-2 @[30rem]:table-cell")}>{num(a.new_patients)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}
