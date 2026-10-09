"use client";

import { Users } from "lucide-react";
import type { ConversionResponse, OperatorStats } from "@/lib/api";
import { formatPct, formatReaction } from "@/lib/call-metrics";
import { lostStatus, missedStatus, reactionStatus, type Status } from "@/lib/thresholds";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PROFOSMOTR_IDS = new Set(["544"]);
const n = (v: number) => v.toLocaleString("ru-RU");

const STATUS_PILL: Record<Status, string> = {
  good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  bad:  "bg-red-500/10 text-red-600 dark:text-red-400",
};

function StatusVal({ value, status, sub }: { value: string; status: Status | null; sub?: string }) {
  if (!status) return (
    <span className="text-[12px] tabular-nums text-muted-foreground">{value}{sub && <span className="ml-1 text-muted-foreground/50">{sub}</span>}</span>
  );
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums", STATUS_PILL[status])}>
      {value}{sub && <span className="ml-1 opacity-60">{sub}</span>}
    </span>
  );
}

interface Row { id: string; op: OperatorStats; conversion: number | null; plain: boolean; isTotal: boolean }

export function CallsOperatorsWidget({ operators, conversion, loading }: {
  operators: Record<string, OperatorStats> | null;
  conversion: ConversionResponse | null;
  loading: boolean;
}) {
  if (loading) return <div className="h-full rounded-lg bg-muted/60 animate-pulse" />;

  const convOf = (id: string) => {
    const c = conversion?.operators.find(o => o.operator_id === id);
    return c ? c.conversion_pct : null;
  };

  const rows: Row[] = Object.entries(operators ?? {})
    .filter(([id]) => id !== "total")
    .sort(([, a], [, b]) => b.incoming - a.incoming)
    .slice(0, 8)
    .map(([id, op]) => ({ id, op, conversion: convOf(id), plain: PROFOSMOTR_IDS.has(id), isTotal: false }));

  const total = operators?.["total"];
  const totalRow: Row | null = total
    ? { id: "total", op: total, conversion: conversion ? conversion.total.conversion_pct : null, plain: false, isTotal: true }
    : null;

  const HEADERS = ["Оператор", "Принято", "Пропущено", "Потеряно", "До перезвона", "Конверсия"];

  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <CardHeader className="border-b px-5 py-3.5 shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground/60" />
          <CardTitle className="text-sm font-semibold">Качество работы операторов</CardTitle>
          <span className="ml-auto text-[11px] text-muted-foreground/50">точка = показатель в норме</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[12px] text-muted-foreground/50">
            Нет данных
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {HEADERS.map((h, i) => (
                  <th key={h} className={cn(
                    "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap",
                    i === 0 ? "text-left" : "text-right"
                  )}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const { op, plain, isTotal } = r;
                const hasCalls = op.received > 0;
                const st = (s: Status | null) => plain || !hasCalls ? null : s;
                return (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{op.name}</span>
                        {plain && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                            профосмотры
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[13px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {n(op.incoming)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusVal
                        value={n(op.missed)}
                        sub={`(${formatPct(op.missed_pct)})`}
                        status={st(missedStatus(op.missed_pct))}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusVal
                        value={n(op.lost)}
                        sub={`(${formatPct(op.lost_pct)})`}
                        status={st(lostStatus(op.lost_pct))}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusVal
                        value={formatReaction(op.avg_reaction_sec)}
                        status={plain ? null : reactionStatus(op.avg_reaction_sec)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[12px] tabular-nums text-muted-foreground">
                        {r.conversion === null ? "—" : formatPct(r.conversion)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {totalRow && (
                <tr className="bg-muted/30 border-t border-border font-semibold">
                  <td className="px-4 py-3 text-[12px]">Итого</td>
                  <td className="px-4 py-3 text-right text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {n(totalRow.op.incoming)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusVal
                      value={n(totalRow.op.missed)}
                      sub={`(${formatPct(totalRow.op.missed_pct)})`}
                      status={missedStatus(totalRow.op.missed_pct)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusVal
                      value={n(totalRow.op.lost)}
                      sub={`(${formatPct(totalRow.op.lost_pct)})`}
                      status={lostStatus(totalRow.op.lost_pct)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusVal
                      value={formatReaction(totalRow.op.avg_reaction_sec)}
                      status={reactionStatus(totalRow.op.avg_reaction_sec)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] tabular-nums text-muted-foreground">
                    {totalRow.conversion === null ? "—" : formatPct(totalRow.conversion)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
