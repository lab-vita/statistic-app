"use client";

import { useState, useEffect } from "react";
import {
  fetchPaymentStats, fetchPaymentDaily, fetchPaymentByDoctor, fetchSalesStats,
  toDateStr, addDays, fmtRub,
  type PaymentStatsResponse, type PaymentDailyResponse,
  type PaymentDoctorResponse, type SalesStatsResponse,
} from "@/lib/api";
import { PageContent, MetricCard, SectionCard, Delta, Skeleton, Empty, ErrorBanner } from "@/components/ui/primitives";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { cn } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));

export function RevenuePage() {
  const dateFrom = toDateStr(addDays(new Date(), -30));
  const dateTo   = toDateStr(addDays(new Date(), -1));

  const [stats,   setStats]   = useState<PaymentStatsResponse | null>(null);
  const [daily,   setDaily]   = useState<PaymentDailyResponse | null>(null);
  const [doctors, setDoctors] = useState<PaymentDoctorResponse | null>(null);
  const [sales,   setSales]   = useState<SalesStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchPaymentStats(dateFrom, dateTo),
      fetchPaymentDaily(dateFrom, dateTo),
      fetchPaymentByDoctor(dateFrom, dateTo, 10),
      fetchSalesStats(dateFrom, dateTo, 10),
    ]).then(([s, d, doc, sal]) => {
      setStats(s); setDaily(d); setDoctors(doc); setSales(sal);
    }).catch(e => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  const avgCheck = stats && stats.count > 0 ? Math.round(stats.total_paid / stats.count) : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-5">
        <span className="text-[13px] font-bold">Выручка</span>
        <span className="text-[12px] text-muted-foreground/60 hidden sm:inline">
          Последние 30 дней · только обычные платежи (исключены возвраты и страховые)
        </span>
      </header>

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-28" />)}
            </div>
            <Skeleton className="h-48" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Skeleton className="h-64" /><Skeleton className="h-64" />
            </div>
          </>
        ) : !stats ? (
          <Empty />
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                label="Выручка" value={`${fmt(stats.total_paid)} ₽`}
                valueClass="text-emerald-600 dark:text-emerald-400"
                deltaDir={stats.total_paid_delta_dir} deltaPct={stats.total_paid_delta_pct}
              />
              <MetricCard
                label="Платежей" value={fmt(stats.count)}
                deltaDir={stats.count_delta_dir} deltaPct={stats.count_delta_pct}
              />
              <MetricCard
                label="Средний чек" value={`${fmt(avgCheck)} ₽`} sub="за визит"
              />
              {/* Payment breakdown */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-3">
                  Способы оплаты
                </p>
                <div className="space-y-2.5">
                  {[
                    { label: "Наличными", val: stats.by_cash,     color: "#16a34a" },
                    { label: "Картой",    val: stats.by_card,     color: "#2563eb" },
                    { label: "Безнал",    val: stats.by_cashless,  color: "#d97706" },
                  ].filter(x => x.val > 0).map(x => {
                    const pct = stats.total_paid > 0 ? Math.round(x.val / stats.total_paid * 100) : 0;
                    return (
                      <div key={x.label}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] text-muted-foreground/60">{x.label}</span>
                          <span className="text-[11px] font-bold tabular-nums">{pct}%</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: pct+"%", background: x.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Area chart */}
            {daily && daily.days.length > 0 && (
              <SectionCard title="Динамика выручки">
                <RevenueChart data={daily.days} />
              </SectionCard>
            )}

            {/* Doctors + Services */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Doctors */}
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-[13px] font-semibold">Топ врачей по выручке</h3>
                </div>
                {!doctors?.doctors.length ? (
                  <div className="px-4 py-8 text-center text-[12px] text-muted-foreground/50">Нет данных</div>
                ) : (
                  <div className="divide-y divide-border">
                    {doctors.doctors.map((d, i) => (
                      <div key={d.doctor_id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                        <span className="text-[11px] text-muted-foreground/50 w-4 text-right tabular-nums shrink-0">{i+1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">
                            {d.doctor_surname} {d.doctor_name?.[0] ? d.doctor_name[0]+"." : ""}
                          </div>
                          <div className="text-[11px] text-muted-foreground/60">{d.count} платежей</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[13px] font-bold tabular-nums">{fmt(d.total_paid)} ₽</div>
                          <div className="text-[11px] text-muted-foreground/60 tabular-nums">{d.pct}%</div>
                        </div>
                        <div className="w-10 h-1 rounded-full bg-border overflow-hidden shrink-0">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(d.pct*10,100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Services */}
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-[13px] font-semibold">Топ услуг по выручке</h3>
                </div>
                {!sales?.services.length ? (
                  <div className="px-4 py-8 text-center text-[12px] text-muted-foreground/50">Нет данных</div>
                ) : (
                  <div className="divide-y divide-border">
                    {sales.services.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                        <span className="text-[11px] text-muted-foreground/50 w-4 text-right tabular-nums shrink-0">{i+1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate" title={s.service_title}>{s.service_title}</div>
                          <div className="text-[11px] text-muted-foreground/60">{s.amount} шт.</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[13px] font-bold tabular-nums">{fmt(Math.round(s.final_sum))} ₽</div>
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[11px] text-muted-foreground/60 tabular-nums">{s.pct_of_total}%</span>
                            {s.delta_pct != null && s.delta_dir && s.delta_dir !== "flat" && (
                              <span className={cn("text-[10px] font-bold",
                                s.delta_dir === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                              )}>
                                {s.delta_dir === "up" ? "+" : "−"}{s.delta_pct}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </PageContent>
    </div>
  );
}
