"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchPaymentByDoctor, fetchSalesStats,
  toDateStr, addDays, fmtRub,
  type PaymentDoctor, type SaleService,
} from "@/lib/api";
import { getDefaultPeriod, shiftPeriod, formatPeriodLabel, type Period, type PeriodType } from "@/lib/periods";
import {
  PageContent, TabGroup, Skeleton, Empty, ErrorBanner, Delta,
  Th, Td,
} from "@/components/ui/primitives";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useChartTheme } from "@/components/charts/base-chart";
import { cn } from "@/lib/utils";

const PERIODS = ["День","Неделя","Месяц","Квартал","Год"];
const P_MAP: Record<string, PeriodType> = {
  "День":"day","Неделя":"week","Месяц":"month","Квартал":"quarter","Год":"year"
};

function fmt(n: number) { return n.toLocaleString("ru-RU"); }
function fmtPct(n: number) { return n.toFixed(1) + "%"; }

const COLORS = ["#16a34a","#2563eb","#d97706","#7c3aed","#dc2626","#0891b2","#65a30d","#9333ea","#ea580c","#0284c7","#4f46e5","#db2777","#059669","#7c3aed","#b45309"];

function DoctorBarChart({ doctors }: { doctors: PaymentDoctor[] }) {
  const ct = useChartTheme();
  const data = [...doctors]
    .sort((a, b) => b.total_paid - a.total_paid)
    .slice(0, 12)
    .map(d => ({
      name: d.doctor_surname || (d.doctor_name ?? "").split(" ")[0],
      value: d.total_paid,
      count: d.count,
    }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 60, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={v => fmtRub(v as number)}
          tick={{ fontSize: 10, fill: ct.axis }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={80}
          tick={{ fontSize: 11, fill: ct.axis }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => [typeof v === "number" ? fmtRub(v) : "—", "Выручка"]}
          {...ct.tooltip}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ServicesTable({ services }: { services: SaleService[] }) {
  const maxSum = Math.max(...services.map(s => s.final_sum));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th>Услуга</Th>
            <Th right>Кол-во</Th>
            <Th right>Сумма</Th>
            <Th right>% от выручки</Th>
            <Th right>Динамика</Th>
          </tr>
        </thead>
        <tbody>
          {services.map((s, i) => (
            <tr key={i} className="hover:bg-muted/40 transition-colors">
              <Td>
                <div>
                  <span className="font-medium text-[13px]">{s.service_title}</span>
                  <div className="mt-1 h-1 w-full max-w-[160px] rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: maxSum > 0 ? `${s.final_sum / maxSum * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              </Td>
              <Td right muted>{fmt(s.amount)} {s.unit}</Td>
              <Td right bold>{fmtRub(s.final_sum)}</Td>
              <Td right>
                <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                  {fmtPct(s.pct_of_total)}
                </span>
              </Td>
              <Td right>
                <Delta dir={s.delta_dir} pct={s.delta_pct} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DoctorsPage() {
  const [periodLabel, setPeriodLabel] = useState("Месяц");
  const [period,      setPeriod]      = useState<Period>(getDefaultPeriod("month"));
  const [doctors,     setDoctors]     = useState<PaymentDoctor[] | null>(null);
  const [sales,       setSales]       = useState<SaleService[] | null>(null);
  const [totalRev,    setTotalRev]    = useState<number>(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const dateFrom  = toDateStr(period.dateFrom);
  const dateTo    = toDateStr(period.dateTo);
  const yesterday = toDateStr(addDays(new Date(), -1));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [doc, srv] = await Promise.all([
        fetchPaymentByDoctor(dateFrom, dateTo, 20),
        fetchSalesStats(dateFrom, dateTo, 20),
      ]);
      setDoctors(doc.doctors);
      setSales(srv.services);
      setTotalRev(srv.total.final_sum);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const totalByDoctors = doctors ? doctors.reduce((s, d) => s + d.total_paid, 0) : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-5">
        <span className="text-[13px] font-bold">Врачи</span>
        <div className="flex-1" />
        <TabGroup
          items={PERIODS}
          active={periodLabel}
          onChange={l => { setPeriodLabel(l); setPeriod(getDefaultPeriod(P_MAP[l] ?? "month")); }}
        />
        <div className="flex items-center gap-0.5">
          <button onClick={() => setPeriod(p => shiftPeriod(p, -1))}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors text-base">‹</button>
          <span className="text-[12px] font-medium min-w-[120px] text-center tabular-nums">{formatPeriodLabel(period)}</span>
          <button onClick={() => setPeriod(p => shiftPeriod(p, 1))}
            disabled={toDateStr(period.dateTo) >= yesterday}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40 text-base">›</button>
        </div>
        <div className="h-4 w-px bg-border" />
        <button onClick={load} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors text-sm">↻</button>
      </header>

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <Skeleton className="h-80" />
            <Skeleton className="h-64" />
          </>
        ) : (!doctors || doctors.length === 0) ? (
          <Empty />
        ) : (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-1">Выручка по врачам</p>
                <p className="text-[28px] font-black leading-none tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtRub(totalByDoctors)}
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">{doctors.length} врачей</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-1">Средний чек</p>
                <p className="text-[28px] font-black leading-none tracking-tight tabular-nums text-foreground">
                  {fmtRub(doctors.reduce((s, d) => s + d.count, 0) > 0
                    ? totalByDoctors / doctors.reduce((s, d) => s + d.count, 0)
                    : 0)}
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  {fmt(doctors.reduce((s, d) => s + d.count, 0))} визитов
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 col-span-2 sm:col-span-1">
                <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-1">Лидер по выручке</p>
                {doctors[0] && (
                  <>
                    <p className="text-[18px] font-black leading-tight tracking-tight text-foreground">
                      {doctors[0].doctor_surname || (doctors[0].doctor_name ?? "").split(" ")[0]}
                    </p>
                    <p className="text-[22px] font-black leading-none tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                      {fmtRub(doctors[0].total_paid)}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      {fmtPct(doctors[0].pct)} от общей · {fmt(doctors[0].count)} визитов
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Bar chart */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-[13px] font-semibold">Рейтинг врачей по выручке</h3>
              </div>
              <div className="p-4">
                <DoctorBarChart doctors={doctors} />
              </div>
            </div>

            {/* Doctors table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-[13px] font-semibold">Детализация по врачам</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>#</Th>
                      <Th>Врач</Th>
                      <Th right>Визитов</Th>
                      <Th right>Выручка</Th>
                      <Th right>Средний чек</Th>
                      <Th right>% от общей</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...doctors].sort((a, b) => b.total_paid - a.total_paid).map((d, i) => (
                      <tr key={d.doctor_id} className="hover:bg-muted/40 transition-colors">
                        <Td muted>{i + 1}</Td>
                        <Td>
                          <span className="font-semibold">{d.doctor_surname}</span>
                          {" "}
                          <span className="text-[11px] text-muted-foreground/50">
                            {(d.doctor_name ?? "").replace(d.doctor_surname ?? "", "").trim()}
                          </span>
                        </Td>
                        <Td right muted>{fmt(d.count)}</Td>
                        <Td right bold>{fmtRub(d.total_paid)}</Td>
                        <Td right muted>{fmtRub(d.count > 0 ? d.total_paid / d.count : 0)}</Td>
                        <Td right>
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${Math.min(d.pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-[12px] font-bold tabular-nums min-w-[36px] text-right">
                              {fmtPct(d.pct)}
                            </span>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top services */}
            {sales && sales.length > 0 && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold">Топ услуг</h3>
                  {totalRev > 0 && (
                    <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                      итого {fmtRub(totalRev)}
                    </span>
                  )}
                </div>
                <ServicesTable services={sales} />
              </div>
            )}
          </>
        )}
      </PageContent>
    </div>
  );
}
