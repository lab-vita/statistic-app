"use client";
import { Users } from "lucide-react";
import type { ConversionResponse, OperatorStats } from "@/lib/api";
import { formatPct, formatReaction } from "@/lib/call-metrics";
import {
  STATUS_DOT, STATUS_LABEL, lostStatus, missedStatus, reactionStatus, type Status,
} from "@/lib/thresholds";

/** Оператор линии профосмотров: пропущенные для него не оценка качества, светофор не показываем. */
const PROFOSMOTR_IDS = new Set(["544"]);

const n = (v: number) => v.toLocaleString("ru-RU");

function Dot({ status }: { status: Status | null }) {
  if (!status) return null;
  return (
    <span
      role="img" aria-label={STATUS_LABEL[status]} title={STATUS_LABEL[status]}
      className={`mr-1.5 inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`}
    />
  );
}

interface Row { id: string; op: OperatorStats; conversion: number | null; plain: boolean; isTotal: boolean }

function Cells({ row }: { row: Row }) {
  const { op, conversion, plain } = row;
  const hasCalls = op.received > 0;
  const st = (s: Status | null) => (plain || !hasCalls ? null : s);
  const muted = plain ? "text-white/50" : "";
  return (
    <>
      <td className="px-2 py-2 text-right tabular-nums">{n(op.incoming)}</td>
      <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${muted}`}>
        <Dot status={st(missedStatus(op.missed_pct))} />{n(op.missed)}
        <span className="ml-1 text-white/50">{formatPct(op.missed_pct)}</span>
      </td>
      <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${muted}`}>
        <Dot status={st(lostStatus(op.lost_pct))} />{n(op.lost)}
        <span className="ml-1 text-white/50">{formatPct(op.lost_pct)}</span>
      </td>
      <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${muted}`}>
        <Dot status={plain ? null : reactionStatus(op.avg_reaction_sec)} />{formatReaction(op.avg_reaction_sec)}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">{conversion === null ? "—" : formatPct(conversion)}</td>
    </>
  );
}

/**
 * «Операторы: качество работы»: что принято, сколько пропущено и потеряно, как быстро перезванивают,
 * сколько звонков заканчивается записью. Цветная точка — оценка по порогам (см. lib/thresholds.ts).
 */
export function CallsOperatorsWidget({ operators, conversion, loading }: {
  operators: Record<string, OperatorStats> | null; conversion: ConversionResponse | null; loading: boolean;
}) {
  if (loading) return <div className="h-full rounded-2xl bg-muted/40 animate-pulse" />;

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

  return (
    <div className="relative h-full rounded-2xl overflow-hidden p-4 flex flex-col gap-3 text-white
      bg-gradient-to-br from-slate-700 to-slate-900">
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />

      <div className="z-10 flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
          <Users className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Операторы: качество работы</div>
          <div className="text-[11px] text-white/55">точка показывает, в норме ли показатель</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="z-10 flex-1 flex items-center justify-center text-xs text-white/60">нет данных</div>
      ) : (
        <div className="z-10 flex-1 min-h-0 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-white/55">
                <th scope="col" className="px-2 py-1 text-left font-normal">Оператор</th>
                <th scope="col" className="px-2 py-1 text-right font-normal">Принято</th>
                <th scope="col" className="px-2 py-1 text-right font-normal">Пропущено</th>
                <th scope="col" className="px-2 py-1 text-right font-normal">Потеряно</th>
                <th scope="col" className="px-2 py-1 text-right font-normal">До перезвона</th>
                <th scope="col" className="px-2 py-1 text-right font-normal">Конверсия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="px-2 py-2 font-medium whitespace-nowrap">
                    {r.op.name}
                    {r.plain && <span className="ml-1.5 text-[10px] font-normal text-white/50">профосмотры</span>}
                  </td>
                  <Cells row={r} />
                </tr>
              ))}
              {totalRow && (
                <tr className="border-t border-white/25 font-semibold">
                  <td className="px-2 py-2">Итого</td>
                  <Cells row={totalRow} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
