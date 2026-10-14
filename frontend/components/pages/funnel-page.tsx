"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus, ArrowRight, Users } from "lucide-react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Topbar, PageContent, Skeleton, Empty, ErrorBanner,
} from "@/components/ui/primitives";
import { useChartTheme } from "@/components/charts/base-chart";
import {
  getDefaultPeriod, shiftPeriod, formatPeriodLabel,
  type Period, type PeriodType,
} from "@/lib/periods";
import {
  fetchStats, fetchConversion, fetchAppointmentStats, fetchPaymentStats,
  fetchDaily, fetchAppointmentDaily,
  toDateStr, addDays, fmtRub,
  type ConversionOperator, type DailyItem, type AppointmentDailyItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Константы

const PERIODS = ["День", "Неделя", "Месяц", "Квартал", "Год"];
const P_MAP: Record<string, PeriodType> = {
  "День": "day", "Неделя": "week", "Месяц": "month",
  "Квартал": "quarter", "Год": "year",
};

// ─── Типы

interface FunnelData {
  calls:           number;
  appointments:    number;
  visits:          number;
  revenue:         number;
  callsToAppt:     number;
  apptToVisit:     number;
  revenuePerVisit: number;
  operators: {
    id:           string;
    name:         string;
    calls:        number;
    appointments: number;
    conversion:   number;
  }[];
}

interface DayPoint {
  date:       string;
  calls:      number;
  appt:       number;
  conversion: number; // %
}

// ─── Вспомогательные компоненты

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

function FunnelCard({ label, value, sub, accentBg, accentText }: {
  label: string; value: string; sub?: string;
  accentBg: string; accentText: string;
}) {
  return (
    <div className={cn("flex-1 min-w-0 rounded-xl border border-border p-5", accentBg)}>
      <p className="text-[12px] font-medium text-muted-foreground mb-2">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums tracking-tight", accentText)}>{value}</p>
      {sub && <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Arrow({ pct, good, bad }: { pct: number; good: number; bad: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-1">
      <ConvPct value={pct} good={good} bad={bad} />
      <ArrowRight className="h-5 w-5 text-muted-foreground/30" />
    </div>
  );
}

// ─── График динамики

function TrendChart({ points }: { points: DayPoint[] }) {
  const ct = useChartTheme();
  if (points.length < 2) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <p className="text-[14px] font-semibold">Динамика воронки по дням</p>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />Звонки
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-violet-500 inline-block rounded" />Записи
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-emerald-500 inline-block" />Конверсия
          </span>
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={points} margin={{ top: 4, right: 40, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: ct.axis }}
              axisLine={false} tickLine={false}
              interval={Math.max(0, Math.floor(points.length / 10) - 1)}
            />
            {/* Левая ось — количество */}
            <YAxis
              yAxisId="cnt"
              tick={{ fontSize: 10, fill: ct.axis }}
              axisLine={false} tickLine={false}
            />
            {/* Правая ось — % конверсии */}
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 10, fill: ct.axis }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip
              {...ct.tooltip}
              formatter={(val, name) =>
                name === "Конверсия"
                  ? [`${typeof val === "number" ? val.toFixed(1) : "0"}%`, name]
                  : [val, name]
              }
            />
            <Bar
              yAxisId="cnt"
              dataKey="calls"
              name="Звонки"
              fill="#328fcd"
              fillOpacity={0.35}
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              yAxisId="cnt"
              dataKey="appt"
              name="Записи"
              fill="#8b5cf6"
              fillOpacity={0.5}
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="conversion"
              name="Конверсия"
              stroke="#1a9e6e"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 4, fill: "#1a9e6e" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="px-5 pb-3 text-[11px] text-muted-foreground/50">
        Синие столбцы — звонки, фиолетовые — записи. Зелёная пунктирная линия — конверсия (%), шкала справа.
      </div>
    </div>
  );
}

// ─── Основная страница

export function FunnelPage() {
  const [periodLabel, setPeriodLabel] = useState("Месяц");
  const [period, setPeriod]           = useState<Period>(getDefaultPeriod("month"));

  const [data,       setData]      = useState<FunnelData | null>(null);
  const [trend,      setTrend]     = useState<DayPoint[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefreshing]= useState(false);
  const [error,      setError]     = useState<string | null>(null);

  const dateFrom  = toDateStr(period.dateFrom);
  const dateTo    = toDateStr(period.dateTo);
  const yesterday = toDateStr(addDays(new Date(), -1));
  const isDay     = period.type === "day";

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const requests: Promise<unknown>[] = [
        fetchStats(dateFrom, dateTo),
        fetchConversion(dateFrom, dateTo),
        fetchAppointmentStats(dateFrom, dateTo),
        fetchPaymentStats(dateFrom, dateTo),
      ];
      if (!isDay) {
        requests.push(fetchDaily(dateFrom, dateTo));
        requests.push(fetchAppointmentDaily(dateFrom, dateTo));
      }

      const results = await Promise.all(requests);
      const [statsRes, convRes, apptRes, payRes] = results as [
        Awaited<ReturnType<typeof fetchStats>>,
        Awaited<ReturnType<typeof fetchConversion>>,
        Awaited<ReturnType<typeof fetchAppointmentStats>>,
        Awaited<ReturnType<typeof fetchPaymentStats>>,
        ...unknown[]
      ];

      // Данные воронки
      const totalCalls = Object.entries(statsRes.operators)
        .filter(([k]) => k !== "total")
        .reduce((sum, [, op]) => sum + (op.incoming ?? 0), 0);

      const appt    = convRes.total.appointments ?? 0;
      const visits  = apptRes.total.visits ?? 0;
      const revenue = payRes.total_paid ?? 0;

      const callsToAppt     = totalCalls > 0 ? (appt / totalCalls) * 100 : 0;
      const apptToVisit     = appt > 0       ? (visits / appt) * 100    : 0;
      const revenuePerVisit = visits > 0     ? revenue / visits          : 0;

      const operators = convRes.operators.map((op: ConversionOperator) => ({
        id:           op.operator_id,
        name:         op.name || op.surname,
        calls:        op.incoming,
        appointments: op.appointments,
        conversion:   op.conversion_pct,
      }));

      setData({ calls: totalCalls, appointments: appt, visits, revenue, callsToAppt, apptToVisit, revenuePerVisit, operators });

      // Динамика по дням
      if (!isDay && results.length >= 6) {
        const callsDaily = (results[4] as Awaited<ReturnType<typeof fetchDaily>>).days;
        const apptDaily  = (results[5] as Awaited<ReturnType<typeof fetchAppointmentDaily>>).days;

        const apptMap: Record<string, AppointmentDailyItem> = {};
        for (const d of apptDaily) apptMap[d.date] = d;

        const points: DayPoint[] = callsDaily.map((d: DailyItem) => {
          const a = apptMap[d.date]?.total ?? 0;
          const conv = d.incoming > 0 ? (a / d.incoming) * 100 : 0;
          const label = new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
          return { date: label, calls: d.incoming, appt: a, conversion: Math.round(conv * 10) / 10 };
        });
        setTrend(points);
      } else {
        setTrend([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки данных");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo, isDay]);

  useEffect(() => { load(); }, [load]);

  function handlePeriod(label: string) {
    const type = P_MAP[label] ?? "month";
    setPeriodLabel(label);
    setPeriod(getDefaultPeriod(type));
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Воронка"
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
            <div className="flex gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="flex-1 h-28" />)}
            </div>
            <Skeleton className="h-56" />
            <Skeleton className="h-40" />
            <Skeleton className="h-48" />
          </>
        ) : !data || data.calls === 0 ? (
          <Empty />
        ) : (
          <>
            {/* Заголовок */}
            <div>
              <h1 className="text-[17px] font-semibold">Воронка продаж</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">Путь клиента: от звонка в колл-центр до оплаты</p>
            </div>

            {/* Главная воронка */}
            <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
              <FunnelCard
                label="Звонков принято"
                value={data.calls.toLocaleString("ru-RU")}
                sub="входящие в колл-центр"
                accentBg="bg-blue-50 dark:bg-blue-950/30"
                accentText="text-blue-700 dark:text-blue-300"
              />
              <Arrow pct={data.callsToAppt} good={30} bad={15} />
              <FunnelCard
                label="Записей создано"
                value={data.appointments.toLocaleString("ru-RU")}
                sub={`${data.callsToAppt.toFixed(1)}% от звонков`}
                accentBg="bg-violet-50 dark:bg-violet-950/30"
                accentText="text-violet-700 dark:text-violet-300"
              />
              <Arrow pct={data.apptToVisit} good={80} bad={60} />
              <FunnelCard
                label="Пришли на приём"
                value={data.visits.toLocaleString("ru-RU")}
                sub={`${data.apptToVisit.toFixed(1)}% явка`}
                accentBg="bg-emerald-50 dark:bg-emerald-950/30"
                accentText="text-emerald-700 dark:text-emerald-300"
              />
              <div className="flex items-center justify-center px-1 shrink-0">
                <ArrowRight className="h-5 w-5 text-muted-foreground/30" />
              </div>
              <FunnelCard
                label="Выручка"
                value={fmtRub(data.revenue)}
                sub={`${fmtRub(data.revenuePerVisit)} на пациента`}
                accentBg="bg-amber-50 dark:bg-amber-950/30"
                accentText="text-amber-700 dark:text-amber-300"
              />
            </div>

            {/* График динамики */}
            {trend.length >= 2 && <TrendChart points={trend} />}

            {/* Подсказка */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Как читать воронку</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                <div className="flex items-start gap-2">
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-medium">Звонки → Записи: хорошо от 30%</p>
                    <p className="text-[12px] text-muted-foreground">Из 100 звонков должны получаться минимум 30 записей</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-medium">Записи → Явка: хорошо от 80%</p>
                    <p className="text-[12px] text-muted-foreground">Из 100 записей должны прийти минимум 80 человек</p>
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
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-5 py-3 text-left font-medium text-muted-foreground">Оператор</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Звонков</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Записей</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Конверсия</th>
                        <th className="px-5 py-3 text-right font-medium text-muted-foreground">Доля</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.operators
                        .sort((a, b) => b.appointments - a.appointments)
                        .map((op, i) => {
                          const share = data.appointments > 0
                            ? (op.appointments / data.appointments) * 100 : 0;
                          return (
                            <tr key={op.id} className={cn(
                              "border-b border-border last:border-0 hover:bg-muted/40 transition-colors",
                              i % 2 !== 0 && "bg-muted/20"
                            )}>
                              <td className="px-5 py-3 font-medium">{op.name}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{op.calls.toLocaleString("ru-RU")}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{op.appointments.toLocaleString("ru-RU")}</td>
                              <td className="px-4 py-3 text-right">
                                <ConvPct value={op.conversion} good={30} bad={15} />
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="tabular-nums text-muted-foreground text-[12px]">{share.toFixed(1)}%</span>
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
      </PageContent>
    </div>
  );
}
