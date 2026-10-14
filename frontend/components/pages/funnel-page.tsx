"use client";

import { useState, useEffect, useCallback } from "react";
import { Phone, Calendar, UserCheck, Banknote, TrendingUp, TrendingDown, Minus, ArrowRight, Users } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { usePeriod } from "@/lib/periods";
import {
  fetchStats,
  fetchConversion,
  fetchAppointmentStats,
  fetchPaymentStats,
  fmtRub,
  type ConversionOperator,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Типы ────────────────────────────────────────────────────────────

interface FunnelData {
  calls:        number;
  appointments: number;
  visits:       number;
  revenue:      number;
  callsToAppt:  number;   // % конверсии звонки → записи
  apptToVisit:  number;   // % конверсии записи → явка
  revenuePerVisit: number; // выручка / явившихся
  operators: {
    id:           string;
    name:         string;
    calls:        number;
    appointments: number;
    conversion:   number;
  }[];
}

// ─── Вспомогательные компоненты ──────────────────────────────────────

function ConvPct({ value, good, bad }: { value: number; good: number; bad: number }) {
  const color =
    value >= good ? "text-emerald-600 dark:text-emerald-400" :
    value >= bad  ? "text-amber-600 dark:text-amber-400" :
                    "text-red-600 dark:text-red-400";
  const Icon = value >= good ? TrendingUp : value >= bad ? Minus : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", color)}>
      <Icon className="h-3.5 w-3.5" />
      {value.toFixed(1)}%
    </span>
  );
}

function FunnelCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", accent ?? "bg-muted")}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Arrow({ pct, good, bad }: { pct: number; good: number; bad: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-1">
      <ConvPct value={pct} good={good} bad={bad} />
      <ArrowRight className="h-5 w-5 text-muted-foreground/40" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <TrendingUp className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="text-[14px] font-medium text-muted-foreground">Нет данных за выбранный период</p>
      <p className="text-[12px] text-muted-foreground/60">Попробуйте выбрать другой диапазон дат</p>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

// ─── Основная страница ───────────────────────────────────────────────

export function FunnelPage() {
  const { period, setPeriod, periodType, setPeriodType, dateFrom, dateTo } = usePeriod();
  const [data, setData]       = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, convRes, apptRes, payRes] = await Promise.all([
        fetchStats(dateFrom, dateTo),
        fetchConversion(dateFrom, dateTo),
        fetchAppointmentStats(dateFrom, dateTo),
        fetchPaymentStats(dateFrom, dateTo),
      ]);

      // Суммируем звонки по всем операторам
      const totalCalls = Object.values(statsRes.operators).reduce(
        (sum, op) => sum + (op.incoming ?? 0), 0
      );

      const appt    = convRes.total.appointments ?? 0;
      const visits  = apptRes.total.visits ?? 0;
      const revenue = payRes.total_paid ?? 0;

      const callsToAppt  = totalCalls > 0 ? (appt / totalCalls) * 100 : 0;
      const apptToVisit  = appt > 0       ? (visits / appt) * 100    : 0;
      const revenuePerVisit = visits > 0  ? revenue / visits          : 0;

      const operators = convRes.operators.map((op: ConversionOperator) => ({
        id:           op.operator_id,
        name:         op.name || op.surname,
        calls:        op.incoming,
        appointments: op.appointments,
        conversion:   op.conversion_pct,
      }));

      setData({ calls: totalCalls, appointments: appt, visits, revenue, callsToAppt, apptToVisit, revenuePerVisit, operators });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        section="funnel"
        period={period}
        onChange={setPeriod}
        onTypeChange={setPeriodType}
        onRefresh={load}
        refreshing={loading}
      />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">

        {/* Заголовок */}
        <div>
          <h1 className="text-[17px] font-semibold">Воронка продаж</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Путь клиента: от звонка в колл-центр до оплаты
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4 text-[13px] text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Карточки воронки */}
        {loading ? (
          <div className="flex gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="flex-1 h-28" />)}
          </div>
        ) : !data || data.calls === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Главная воронка */}
            <div className="flex items-center gap-2">
              <FunnelCard
                icon={Phone}
                label="Звонков принято"
                value={data.calls.toLocaleString("ru-RU")}
                sub="входящие в колл-центр"
                accent="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
              />

              <Arrow pct={data.callsToAppt} good={30} bad={15} />

              <FunnelCard
                icon={Calendar}
                label="Записей создано"
                value={data.appointments.toLocaleString("ru-RU")}
                sub={`конверсия ${data.callsToAppt.toFixed(1)}% от звонков`}
                accent="bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400"
              />

              <Arrow pct={data.apptToVisit} good={80} bad={60} />

              <FunnelCard
                icon={UserCheck}
                label="Пришли на приём"
                value={data.visits.toLocaleString("ru-RU")}
                sub={`явка ${data.apptToVisit.toFixed(1)}% от записей`}
                accent="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
              />

              <Arrow pct={100} good={100} bad={100} />

              <FunnelCard
                icon={Banknote}
                label="Выручка"
                value={fmtRub(data.revenue)}
                sub={`${fmtRub(data.revenuePerVisit)} на пациента`}
                accent="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
              />
            </div>

            {/* Ориентиры конверсии */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Как читать воронку</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <TrendingUp className="h-2.5 w-2.5 text-emerald-600" />
                  </span>
                  <div>
                    <p className="font-medium">Звонки → Записи: хорошо от 30%</p>
                    <p className="text-muted-foreground text-[12px]">Из 100 звонков должны получаться минимум 30 записей</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <TrendingUp className="h-2.5 w-2.5 text-emerald-600" />
                  </span>
                  <div>
                    <p className="font-medium">Записи → Явка: хорошо от 80%</p>
                    <p className="text-muted-foreground text-[12px]">Из 100 записей должны прийти минимум 80 человек</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Таблица по операторам */}
            {data.operators.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
                  <Users className="h-4 w-4 text-muted-foreground/60" />
                  <p className="text-[14px] font-semibold">Разбивка по операторам</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-5 py-3 text-left font-medium text-muted-foreground">Оператор</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Звонков</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Записей</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Конверсия</th>
                        <th className="px-5 py-3 text-right font-medium text-muted-foreground">Доля записей</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.operators
                        .sort((a, b) => b.appointments - a.appointments)
                        .map((op, i) => {
                          const share = data.appointments > 0
                            ? (op.appointments / data.appointments) * 100
                            : 0;
                          return (
                            <tr key={op.id} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "" : "bg-muted/30")}>
                              <td className="px-5 py-3 font-medium">{op.name}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{op.calls.toLocaleString("ru-RU")}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{op.appointments.toLocaleString("ru-RU")}</td>
                              <td className="px-4 py-3 text-right">
                                <ConvPct value={op.conversion} good={30} bad={15} />
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
                                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-violet-500"
                                      style={{ width: `${Math.min(share, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
