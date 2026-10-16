"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchPaymentStats, fetchPaymentDaily, fetchPaymentByDoctor, fetchSalesByCategory,
  fetchPaymentByType,
  toDateStr, addDays, fmtRub,
  type PaymentStatsResponse, type PaymentDailyResponse,
  type PaymentDoctorResponse, type SalesByCategoryResponse,
  type PaymentByTypeResponse,
} from "@/lib/api";
import {
  getDefaultPeriod, shiftPeriod, formatPeriodLabel,
  type Period, type PeriodType,
} from "@/lib/periods";
import {
  Topbar, PageContent, MetricCard, SectionCard,
  Skeleton, Empty, ErrorBanner,
} from "@/components/ui/primitives";
import { PlanMeter, usePeriodPlan } from "@/components/plan-meter";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { RevenuePeriodChart } from "@/components/charts/revenue-period-chart";
import { CategoryTrendCard, ServicesTrendCard } from "@/components/revenue-categories";

// ─── Константы

const PERIODS = ["День", "Неделя", "Месяц", "Квартал", "Год"];
const P_MAP: Record<string, PeriodType> = {
  "День": "day", "Неделя": "week", "Месяц": "month",
  "Квартал": "quarter", "Год": "year",
};

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));

// ─── Компонент: строка врача

function DoctorRow({
  rank, surname, name, count, total, pct, maxPct,
}: {
  rank:   number;
  surname: string;
  name:   string;
  count:  number;
  total:  number;
  pct:    number;
  maxPct: number;
}) {
  const avgCheck = count > 0 ? Math.round(total / count) : 0;
  const barWidth = maxPct > 0 ? Math.round((pct / maxPct) * 100) : 0;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
      <td className="px-4 py-3 text-[11px] text-muted-foreground/50 tabular-nums w-8 text-right">{rank}</td>
      <td className="px-4 py-3">
        <span className="text-[13px] font-medium">
          {surname}{name?.[0] ? ` ${name[0]}.` : ""}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-[13px]">{fmt(count)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden hidden sm:block">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="text-right">
            <div className="text-[13px] font-bold tabular-nums">{fmtRub(total)}</div>
            <div className="text-[11px] text-muted-foreground/60 tabular-nums">{pct}%</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-[12px] text-muted-foreground hidden md:table-cell">
        {fmtRub(avgCheck)}
      </td>
    </tr>
  );
}

// ─── Основная страница

export function RevenuePage() {
  const [periodLabel, setPeriodLabel] = useState("Месяц");
  const [period, setPeriod]           = useState<Period>(getDefaultPeriod("month"));

  const [stats,      setStats]      = useState<PaymentStatsResponse | null>(null);
  const [daily,      setDaily]      = useState<PaymentDailyResponse | null>(null);
  const [byType,     setByType]     = useState<PaymentByTypeResponse | null>(null);
  const [prevDaily,  setPrevDaily]  = useState<PaymentDailyResponse | null>(null);
  const [doctors,    setDoctors]    = useState<PaymentDoctorResponse | null>(null);
  const [sales,      setSales]      = useState<SalesByCategoryResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const dateFrom  = toDateStr(period.dateFrom);
  const dateTo    = toDateStr(period.dateTo);
  const yesterday = toDateStr(addDays(new Date(), -1));

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      // Вычисляем предыдущий период той же длины
      const from = new Date(dateFrom);
      const to   = new Date(dateTo);
      const days  = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      const prevTo   = toDateStr(addDays(from, -1));
      const prevFrom = toDateStr(addDays(from, -days));

      const [s, d, bt, pd, doc, sal] = await Promise.all([
        fetchPaymentStats(dateFrom, dateTo),
        fetchPaymentDaily(dateFrom, dateTo),
        fetchPaymentByType(dateFrom, dateTo).catch(() => null),
        fetchPaymentDaily(prevFrom, prevTo).catch(() => null),
        fetchPaymentByDoctor(dateFrom, dateTo, 20),
        fetchSalesByCategory(dateFrom, dateTo, 15).catch(() => null),
      ]);
      setStats(s); setDaily(d); setByType(bt); setPrevDaily(pd);
      setDoctors(doc); setSales(sal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  function handlePeriod(label: string) {
    const type = P_MAP[label] ?? "month";
    setPeriodLabel(label);
    setPeriod(getDefaultPeriod(type));
  }

  const planInfo  = usePeriodPlan(period);
  const avgCheck  = stats && stats.count > 0 ? Math.round(stats.total_paid / stats.count) : 0;
  const maxDoctorPct = doctors?.doctors.reduce((m, d) => Math.max(m, d.pct), 0) ?? 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Выручка"
        periodItems={PERIODS}
        period={periodLabel}
        onPeriod={handlePeriod}
        periodLabel={formatPeriodLabel(period)}
        onPrev={() => setPeriod(p => shiftPeriod(p, -1))}
        onNext={() => setPeriod(p => shiftPeriod(p, 1))}
        nextDisabled={toDateStr(period.dateTo) >= yesterday}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </>
        ) : !stats ? (
          <Empty />
        ) : (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-tour="revenue-kpi">
              <MetricCard
                label="Выручка"
                value={`${fmt(stats.total_paid)} ₽`}
                valueClass="text-emerald-600 dark:text-emerald-400"
                deltaDir={stats.total_paid_delta_dir}
                deltaPct={stats.total_paid_delta_pct}
              >
                <PlanMeter info={planInfo} metric="revenue" fact={stats.total_paid} unit="rub" />
              </MetricCard>
              <MetricCard
                label="Платежей"
                value={fmt(stats.count)}
                deltaDir={stats.count_delta_dir}
                deltaPct={stats.count_delta_pct}
              />
              <MetricCard
                label="Средний чек"
                value={`${fmt(avgCheck)} ₽`}
                sub="за визит"
              />
              {/* Способы оплаты */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3 mb-3">
                  Способы оплаты
                </p>
                <div className="space-y-2.5">
                  {[
                    { label: "Наличными",   val: stats.by_cash,    color: "#1a9e6e" },
                    { label: "Картой",     val: stats.by_card,    color: "#328fcd" },
                    { label: "Безнал",      val: stats.by_cashless, color: "#e09020" },
                    { label: "Кредит",     val: stats.by_credit,  color: "#8b5cf6" },
                  ].filter(x => x.val > 0).map(x => {
                    const pct = stats.total_paid > 0
                      ? Math.round(x.val / stats.total_paid * 100) : 0;
                    return (
                      <div key={x.label}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] text-muted-foreground/60">{x.label}</span>
                          <span className="text-[11px] font-bold tabular-nums">{pct}%</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                               style={{ width: pct + "%", background: x.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Динамика текущий vs предыдущий период */}
            {daily && daily.days.length > 0 && (
              <div data-tour="revenue-chart">
                <SectionCard title="Динамика выручки">
                  <RevenuePeriodChart current={daily.days} prev={prevDaily?.days ?? null} />
                </SectionCard>
              </div>
            )}

            {/* Рейтинг врачей */}
            {doctors && doctors.doctors.length > 0 && (
              <div className="rounded-lg border border-border bg-card overflow-hidden" data-tour="revenue-doctors">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h3 className="text-[13px] font-semibold">Рейтинг врачей по выручке</h3>
                  <span className="text-[11px] text-muted-foreground/60">
                    {doctors.doctors.length} врачей
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-2.5 text-left w-8"></th>
                        <th className="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3">Врач</th>
                        <th className="px-4 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3">Платежей</th>
                        <th className="px-4 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3">Выручка</th>
                        <th className="px-4 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3 hidden md:table-cell">Ср. чек</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctors.doctors.map((d, i) => (
                        <DoctorRow
                          key={d.doctor_id}
                          rank={i + 1}
                          surname={d.doctor_surname}
                          name={d.doctor_name}
                          count={d.count}
                          total={d.total_paid}
                          pct={d.pct}
                          maxPct={maxDoctorPct}
                        />
                      ))}
                    </tbody>
                    {doctors.doctors.length > 1 && (
                      <tfoot>
                        <tr className="border-t border-border bg-muted/20">
                          <td colSpan={2} className="px-4 py-2.5 text-[12px] font-bold text-muted-foreground">Итого</td>
                          <td className="px-4 py-2.5 text-right text-[12px] font-bold tabular-nums">
                            {fmt(doctors.doctors.reduce((s, d) => s + d.count, 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {fmtRub(doctors.doctors.reduce((s, d) => s + d.total_paid, 0))}
                            </span>
                          </td>
                          <td className="hidden md:table-cell" />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* Направления и услуги в динамике */}
            {sales && sales.categories.length > 0 && <div data-tour="revenue-categories"><CategoryTrendCard data={sales} /></div>}
            {sales && sales.services.length > 0 && <ServicesTrendCard data={sales} />}
          </>
        )}
      </PageContent>
    </div>
  );
}
