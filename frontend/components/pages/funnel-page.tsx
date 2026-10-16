"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
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
  fetchConversion, fetchAppointmentStats, fetchPaymentStats,
  toDateStr, addDays, fmtRub,
  type ConversionOperator,
} from "@/lib/api";
import { PlanMeter, TargetMeter, usePeriodPlan } from "@/components/plan-meter";
import { cn } from "@/lib/utils";

// ─── Константы

const PERIODS = ["День", "Неделя", "Месяц", "Квартал", "Год"];
const P_MAP: Record<string, PeriodType> = {
  "День": "day", "Неделя": "week", "Месяц": "month",
  "Квартал": "quarter", "Год": "year",
};

// ─── Типы

interface FunnelData {
  // Колл-центр: звонки операторов → записанные ими пациенты → сколько из них пришли
  calls:        number;
  appointments: number;
  callsToAppt:  number;
  ccVisited:    number | null;  // null — сервер ещё старой версии
  ccWaiting:    number;
  ccMissed:     number;         // не пришли или отменили
  ccVisitPct:   number | null;
  // Вся клиника: все записи на приём в периоде, кто бы их ни сделал
  clinicTotal:     number;
  clinicVisits:    number;
  clinicAhead:     number;      // приём ещё впереди или статус не проставлен
  clinicVisitPct:  number | null;
  sources:         { label: string; count: number }[];
  revenue:         number;
  revenuePerVisit: number;
  operators: {
    id:           string;
    name:         string;
    calls:        number;
    appointments: number;
    visits:       number | null;
    conversion:   number;
  }[];
}

interface DayPoint {
  date:       string;
  calls:      number;
  appt:       number;
  conversion: number | null; // %, null — в день не было звонков
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

function FunnelBlock({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">{note}</p>
      </div>
      {/* узко — шаги друг под другом, стрелки вниз; шире 44rem — в ряд */}
      <div className="@container">
        <div className="flex flex-col items-stretch gap-1.5 @[44rem]:flex-row @[44rem]:gap-2">{children}</div>
      </div>
    </section>
  );
}

function FunnelCard({ label, value, sub, accentBg, accentText, children }: {
  label: string; value: string; sub?: string;
  accentBg: string; accentText: string; children?: ReactNode;
}) {
  return (
    <div className={cn("flex-1 min-w-0 rounded-xl border border-border p-4 @[44rem]:p-5", accentBg)}>
      <p className="text-[12px] font-medium text-muted-foreground mb-2">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums tracking-tight", accentText)}>{value}</p>
      {sub && <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>}
      {children}
    </div>
  );
}

function Arrow({ pct, good, bad }: { pct: number | null; good: number; bad: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 px-1 @[44rem]:flex-col @[44rem]:gap-1">
      <ArrowRight className="order-first h-4 w-4 rotate-90 text-muted-foreground/40 @[44rem]:order-last @[44rem]:h-5 @[44rem]:w-5 @[44rem]:rotate-0 @[44rem]:text-muted-foreground/30" />
      {pct === null
        ? <span className="text-[12px] font-semibold text-muted-foreground">—</span>
        : <ConvPct value={pct} good={good} bad={bad} />}
    </div>
  );
}

/** Пороги стрелки: если в «Планах» задана цель — по ней (как оценка плана: 100% / 90%). */
function thresholds(target: number | undefined, good: number, bad: number) {
  return target ? { good: target, bad: target * 0.9 } : { good, bad };
}

// ─── График динамики

function TrendChart({ points }: { points: DayPoint[] }) {
  const ct = useChartTheme();
  if (points.length < 2) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-[14px] font-semibold">Динамика воронки по дням</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground/60">
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
              interval="preserveStartEnd"
              minTickGap={24}
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
                  ? [typeof val === "number" ? `${val.toFixed(1)}%` : "—", name]
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
  const planInfo  = usePeriodPlan(period);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [convRes, apptRes, payRes] = await Promise.all([
        fetchConversion(dateFrom, dateTo),
        fetchAppointmentStats(dateFrom, dateTo),
        fetchPaymentStats(dateFrom, dateTo),
      ]);

      // Колл-центр — на одной базе с разделом «Звонки»: записи по дню создания,
      // пациент считается один раз; «пришли» — из этих же пациентов.
      const cc = convRes.total;
      const ccVisited = cc.visited ?? null;
      const ccMissed  = (cc.noshow ?? 0) + (cc.cancelled ?? 0);

      // Вся клиника — все записи на приём в периоде, включая сделанные
      // администраторами и другими сотрудниками.
      const t = apptRes.total;
      const clinicResolved = t.visits + t.noshow + t.cancels;
      const revenue = payRes.total_paid ?? 0;
      const sources = Object.values(apptRes.by_group ?? {})
        .filter(g => g.count > 0)
        .sort((a, b) => b.count - a.count)
        .map(g => ({ label: g.label, count: g.count }));

      const operators = convRes.operators.map((op: ConversionOperator) => ({
        id:           op.operator_id,
        name:         op.name || op.surname,
        calls:        op.incoming,
        appointments: op.appointments,
        visits:       op.visits ?? null,
        conversion:   op.conversion_pct,
      }));

      setData({
        calls:        cc.incoming ?? 0,
        appointments: cc.appointments ?? 0,
        callsToAppt:  cc.conversion_pct ?? 0,
        ccVisited,
        ccWaiting:    cc.waiting ?? 0,
        ccMissed,
        ccVisitPct:   ccVisited === null ? null : (cc.visit_pct ?? null),
        clinicTotal:     t.total,
        clinicVisits:    t.visits,
        clinicAhead:     Math.max(0, t.total - clinicResolved),
        clinicVisitPct:  clinicResolved > 0 ? (t.visits / clinicResolved) * 100 : null,
        sources,
        revenue,
        revenuePerVisit: t.visits > 0 ? revenue / t.visits : 0,
        operators,
      });

      // Динамика по дням
      if (!isDay && convRes.days?.length) {
        const points: DayPoint[] = convRes.days.map(d => ({
          date:       new Date(`${d.date}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
          calls:      d.incoming,
          appt:       d.appointments,
          // без звонков конверсии нет: линия прерывается, а не падает в 0
          conversion: d.incoming > 0 ? d.conversion_pct : null,
        }));
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
        ) : !data || (data.calls === 0 && data.clinicTotal === 0) ? (
          <Empty />
        ) : (
          <>
            {/* Заголовок */}
            <div>
              <h1 className="text-[17px] font-semibold">Воронка продаж</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">Путь клиента от звонка до приёма и оплаты</p>
            </div>

            {/* Колл-центр */}
            <FunnelBlock
              title="Колл-центр"
              note="Пациенты, которых записали операторы: записи по дню создания, пациент считается один раз"
            >
              <FunnelCard
                label="Звонков принято"
                value={data.calls.toLocaleString("ru-RU")}
                sub="входящие операторам"
                accentBg="bg-blue-50 dark:bg-blue-950/30"
                accentText="text-blue-700 dark:text-blue-300"
              >
                <PlanMeter info={planInfo} metric="calls_incoming" fact={data.calls} />
              </FunnelCard>
              <Arrow pct={data.callsToAppt} {...thresholds(planInfo?.targets.conversion_pct, 30, 15)} />
              <FunnelCard
                label="Записались"
                value={data.appointments.toLocaleString("ru-RU")}
                sub={`пациентов, ${data.callsToAppt.toFixed(1)}% от звонков`}
                accentBg="bg-violet-50 dark:bg-violet-950/30"
                accentText="text-violet-700 dark:text-violet-300"
              >
                <TargetMeter info={planInfo} metric="conversion_pct" value={data.callsToAppt} label="Цель конверсии" />
              </FunnelCard>
              <Arrow pct={data.ccVisitPct} {...thresholds(planInfo?.targets.visit_pct, 80, 60)} />
              <FunnelCard
                label="Пришли на приём"
                value={data.ccVisited === null ? "—" : data.ccVisited.toLocaleString("ru-RU")}
                sub={data.ccVisited === null
                  ? "нужно обновить сервер"
                  : `не пришли ${data.ccMissed} · ещё ждут ${data.ccWaiting}`}
                accentBg="bg-emerald-50 dark:bg-emerald-950/30"
                accentText="text-emerald-700 dark:text-emerald-300"
              />
            </FunnelBlock>

            {/* Вся клиника */}
            <FunnelBlock
              title="Вся клиника"
              note="Все записи на приём в этом периоде, кто бы их ни сделал: колл-центр, администраторы и другие сотрудники"
            >
              <FunnelCard
                label="Записей на приём"
                value={data.clinicTotal.toLocaleString("ru-RU")}
                sub={data.sources.map(g => `${g.label.toLowerCase()} ${g.count.toLocaleString("ru-RU")}`).join(" · ")}
                accentBg="bg-violet-50 dark:bg-violet-950/30"
                accentText="text-violet-700 dark:text-violet-300"
              >
                <PlanMeter info={planInfo} metric="appt_count" fact={data.clinicTotal} />
              </FunnelCard>
              <Arrow pct={data.clinicVisitPct} {...thresholds(planInfo?.targets.visit_pct, 80, 60)} />
              <FunnelCard
                label="Пришли на приём"
                value={data.clinicVisits.toLocaleString("ru-RU")}
                sub={`приём впереди или не отмечен: ${data.clinicAhead.toLocaleString("ru-RU")}`}
                accentBg="bg-emerald-50 dark:bg-emerald-950/30"
                accentText="text-emerald-700 dark:text-emerald-300"
              >
                <TargetMeter info={planInfo} metric="visit_pct" value={data.clinicVisitPct} label="Цель явок" />
              </FunnelCard>
              <div className="flex items-center justify-center px-1 shrink-0">
                <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground/40 @[44rem]:h-5 @[44rem]:w-5 @[44rem]:rotate-0 @[44rem]:text-muted-foreground/30" />
              </div>
              <FunnelCard
                label="Выручка"
                value={fmtRub(data.revenue)}
                sub={`${fmtRub(data.revenuePerVisit)} на визит`}
                accentBg="bg-amber-50 dark:bg-amber-950/30"
                accentText="text-amber-700 dark:text-amber-300"
              >
                <PlanMeter info={planInfo} metric="revenue" fact={data.revenue} unit="rub" />
              </FunnelCard>
            </FunnelBlock>

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
                    <p className="text-[12px] text-muted-foreground">Из 100 пациентов, чей приём уже прошёл, должны прийти минимум 80. Те, кто ещё ждёт приёма, не учитываются</p>
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
                  <table className="w-full text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-5 py-3 text-left font-medium text-muted-foreground">Оператор</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Звонков</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Записей</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Пришли</th>
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
                              <td className="px-4 py-3 text-right tabular-nums">{op.visits === null ? "—" : op.visits.toLocaleString("ru-RU")}</td>
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
