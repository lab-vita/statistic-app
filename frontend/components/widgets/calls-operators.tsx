"use client";

import { Users } from "lucide-react";
import type { ConversionResponse, OperatorStats } from "@/lib/api";
import { formatPct, formatReaction } from "@/lib/call-metrics";
import { lostStatus, missedStatus, reactionStatus, type Status } from "@/lib/thresholds";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty } from "./widget-card";
import { cn } from "@/lib/utils";

const PROFOSMOTR_IDS = new Set(["544"]);
const n = (v: number) => v.toLocaleString("ru-RU");

const STATUS_PILL: Record<Status, string> = {
  good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  bad:  "bg-red-500/10 text-red-600 dark:text-red-400",
};

function StatusVal({ value, status, sub }: { value: string; status: Status | null; sub?: string }) {
  if (!status) {
    return (
      <span className="text-[12px] tabular-nums text-text-2">
        {value}{sub && <span className="ml-1 text-text-3">{sub}</span>}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[11px] font-bold tabular-nums", STATUS_PILL[status])}>
      {value}{sub && <span className="ml-1 font-semibold opacity-70">{sub}</span>}
    </span>
  );
}

const TH = "px-3 py-2 text-[10px] font-bold uppercase tracking-[.06em] text-text-3 whitespace-nowrap border-b border-hairline";
const TD = "px-3 py-[9px] border-b border-hairline";

export function CallsOperatorsWidget({ operators, conversion, loading }: {
  operators: Record<string, OperatorStats> | null;
  conversion: ConversionResponse | null;
  loading: boolean;
}) {
  if (loading) return <WidgetSkeleton />;

  const convOf = (id: string) => conversion?.operators.find(o => o.operator_id === id)?.conversion_pct ?? null;

  const rows = Object.entries(operators ?? {})
    .filter(([id]) => id !== "total")
    .sort(([, a], [, b]) => b.incoming - a.incoming)
    .map(([id, op]) => ({ id, op, conv: convOf(id), plain: PROFOSMOTR_IDS.has(id) }));
  const total = operators?.["total"];

  return (
    <WidgetCard className="px-0 pb-0">
      <div className="px-5">
        <WidgetHeader title="Качество работы операторов" meta="цвет — оценка показателя: норма, внимание, плохо" />
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-1 px-5 pb-[18px]">
          <WidgetEmpty icon={Users} text="Нет данных по операторам" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className={cn(TH, "pl-5 text-left")}>Оператор</th>
                <th className={cn(TH, "text-right")}>Принято</th>
                <th className={cn(TH, "text-right")}>Пропущено</th>
                <th className={cn(TH, "text-right")}>Потеряно</th>
                <th className={cn(TH, "text-right")}>До перезвона</th>
                <th className={cn(TH, "pr-5 text-right")}>Конверсия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ id, op, conv, plain }) => {
                const st = (s: Status | null) => (plain || op.received === 0 ? null : s);
                return (
                  <tr key={id} className="transition-colors hover:bg-accent/50">
                    <td className={cn(TD, "whitespace-nowrap pl-5")}>
                      <span className="text-[12px] font-semibold">{op.name}</span>
                      {plain && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-text-3">профосмотры</span>}
                    </td>
                    <td className={cn(TD, "text-right text-[12px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400")}>{n(op.incoming)}</td>
                    <td className={cn(TD, "text-right")}>
                      <StatusVal value={n(op.missed)} sub={`(${formatPct(op.missed_pct)})`} status={st(missedStatus(op.missed_pct))} />
                    </td>
                    <td className={cn(TD, "text-right")}>
                      <StatusVal value={n(op.lost)} sub={`(${formatPct(op.lost_pct)})`} status={st(lostStatus(op.lost_pct))} />
                    </td>
                    <td className={cn(TD, "text-right")}>
                      <StatusVal value={formatReaction(op.avg_reaction_sec)} status={plain ? null : reactionStatus(op.avg_reaction_sec)} />
                    </td>
                    <td className={cn(TD, "pr-5 text-right text-[12px] tabular-nums text-text-2")}>
                      {conv === null ? "—" : formatPct(conv)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {total && (
              <tfoot className="sticky bottom-0 bg-card">
                <tr className="bg-accent/40">
                  <td className={cn(TD, "pl-5 text-[12px] font-bold")}>Итого</td>
                  <td className={cn(TD, "text-right text-[12px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400")}>{n(total.incoming)}</td>
                  <td className={cn(TD, "text-right")}>
                    <StatusVal value={n(total.missed)} sub={`(${formatPct(total.missed_pct)})`} status={missedStatus(total.missed_pct)} />
                  </td>
                  <td className={cn(TD, "text-right")}>
                    <StatusVal value={n(total.lost)} sub={`(${formatPct(total.lost_pct)})`} status={lostStatus(total.lost_pct)} />
                  </td>
                  <td className={cn(TD, "text-right")}>
                    <StatusVal value={formatReaction(total.avg_reaction_sec)} status={reactionStatus(total.avg_reaction_sec)} />
                  </td>
                  <td className={cn(TD, "pr-5 text-right text-[12px] tabular-nums text-text-2")}>
                    {conversion ? formatPct(conversion.total.conversion_pct) : "—"}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </WidgetCard>
  );
}
