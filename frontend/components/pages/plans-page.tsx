"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchPlanMonth, savePlanItems,
  fetchStats, fetchAppointmentStats,
  toDateStr,
  type PlanMonthResponse, type PlanDay,
} from "@/lib/api";
import {
  PageContent, Skeleton, Empty, ErrorBanner, TabGroup, PageHeader, RefreshButton,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

// Метрики плана
const METRICS = [
  { key: "incoming",    label: "Принятых",  unit: "звонков" },
  { key: "conversion",  label: "Конверсия", unit: "%"        },
  { key: "appointments",label: "Записей",  unit: ""          },
  { key: "visits",      label: "Явок",     unit: ""          },
  { key: "revenue",     label: "Выручка",   unit: "₽"         },
] as const;

type MetricKey = typeof METRICS[number]["key"];

const METRIC_LABELS: Record<MetricKey, string> = {
  incoming: "Принятых", conversion: "Конверсия",
  appointments: "Записей", visits: "Явок", revenue: "Выручка",
};

function fmt(n: number, key: MetricKey) {
  if (key === "revenue") return n.toLocaleString("ru-RU") + " ₽";
  if (key === "conversion") return n.toFixed(1) + "%";
  return n.toLocaleString("ru-RU");
}

function dayLabel(date: string) {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric" });
}

function isWeekend(date: string) {
  const d = new Date(date + "T00:00:00").getDay();
  return d === 0 || d === 6;
}

// Фактические значения из АПИ (partial data из stats)
interface Actuals {
  incoming?:     number;
  appointments?: number;
  visits?:       number;
  revenue?:      number;
  conversion?:   number;
}

const YEAR   = new Date().getFullYear();
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  label: new Date(YEAR, i, 1).toLocaleDateString("ru-RU", { month: "long" }),
  value: i + 1,
}));

export function PlansPage() {
  const [month,   setMonth]   = useState(new Date().getMonth() + 1);
  const [year]                = useState(YEAR);
  const [plan,    setPlan]    = useState<PlanMonthResponse | null>(null);
  const [actuals, setActuals] = useState<Record<string, Actuals>>({});
  const [edits,   setEdits]   = useState<Record<string, Record<string, string>>>({});
  const [saved,   setSaved]   = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<MetricKey>("incoming");

  // Ряд месяцев на узком экране прокручивается: держим выбранный месяц на виду.
  // Двигаем только сам ряд — scrollIntoView внутри Битрикс24 сдвинул бы и страницу портала.
  const monthsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = monthsRef.current;
    const el = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (row && el) row.scrollLeft = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
  }, [month]);

  const dateFrom = toDateStr(new Date(year, month - 1, 1));
  const dateTo   = toDateStr(new Date(year, month, 0));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [planRes, statsRes, apptRes] = await Promise.all([
        fetchPlanMonth(year, month).catch(() => null),
        fetchStats(dateFrom, dateTo).catch(() => null),
        fetchAppointmentStats(dateFrom, dateTo).catch(() => null),
      ]);
      setPlan(planRes ?? null);

      // Строим actuals по дням (пока API даёт агрегаты, не по дням)
      const act: Record<string, Actuals> = {};
      if (statsRes) {
        const total = statsRes.operators["total"];
        if (total) {
          const today = toDateStr(new Date());
          act[today] = {
            incoming: total.incoming,
          };
        }
      }
      if (apptRes?.total) {
        const today = toDateStr(new Date());
        act[today] = {
          ...(act[today] ?? {}),
          appointments: apptRes.total.total,
          visits: apptRes.total.visits,
        };
      }
      setActuals(act);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setLoading(false); }
  }, [year, month, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  function getVal(date: string, metric: string): number {
    if (edits[date]?.[metric] !== undefined) return Number(edits[date][metric]) || 0;
    const day = plan?.days.find(d => d.date === date);
    return day ? (day as unknown as Record<string, number>)[metric] ?? 0 : 0;
  }

  function setVal(date: string, metric: string, val: string) {
    setEdits(prev => ({ ...prev, [date]: { ...prev[date], [metric]: val } }));
    setSaved(false);
  }

  async function handleSave() {
    if (!plan) {
      // Создаём новый план
      setSaving(true);
      try {
        const days = getDays().map(date => {
          const d: Record<string, number> = {};
          for (const m of METRICS) d[m.key] = getVal(date, m.key);
          return { date, ...d };
        });
        const items = days.flatMap(d =>
          Object.entries(d).filter(([k]) => k !== "date").map(([metric, value]) => ({ date: d.date, metric, value: Number(value) }))
        );
        await savePlanItems(items);
        await load();
        setSaved(true);
        setEdits({});
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка сохранения");
      } finally { setSaving(false); }
      return;
    }

    setSaving(true);
    try {
      const days = plan.days.map(d => {
        const overrides = edits[d.date] ?? {};
        return {
          ...d,
          ...Object.fromEntries(
            Object.entries(overrides).map(([k, v]) => [k, Number(v) || 0])
          ),
        };
      });
      const items = days.flatMap(d =>
        METRICS.map(m => ({ date: d.date, metric: m.key, value: (d as unknown as Record<string, number>)[m.key] ?? 0 }))
      );
      await savePlanItems(items);
      await load();
      setSaved(true);
      setEdits({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally { setSaving(false); }
  }

  function getDays(): string[] {
    if (plan?.days.length) return plan.days.map(d => d.date);
    const days: string[] = [];
    const d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
      days.push(toDateStr(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }

  const days = getDays();
  const metricInfo = METRICS.find(m => m.key === tab)!;

  // Суммы по табу (план vs факт)
  const planTotal   = days.reduce((s, d) => s + getVal(d, tab), 0);
  const actualTotal = days.reduce((s, d) => s + ((actuals[d] as Record<string, number>)?.[tab] ?? 0), 0);
  const progress    = planTotal > 0 ? Math.round(actualTotal / planTotal * 100) : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <PageHeader title="Планы">
        <div ref={monthsRef} className="no-scrollbar relative flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto max-sm:order-last max-sm:-mx-3 max-sm:basis-full max-sm:px-3" role="tablist" aria-label="Месяц плана">
          {MONTHS.map(m => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={month === m.value}
              onClick={() => setMonth(m.value)}
              className={cn(
                "shrink-0 rounded-[5px] px-2 py-[3px] text-[11px] font-semibold transition-colors max-sm:px-2.5 max-sm:py-1.5",
                month === m.value
                  ? "bg-brand text-brand-foreground"
                  : "text-text-3 hover:bg-accent hover:text-foreground"
              )}
            >
              {m.label.slice(0, 3).toLowerCase()}
            </button>
          ))}
        </div>
        {!saved && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="ml-auto h-7 rounded-[7px] bg-brand px-4 text-[12px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-50"
          >
            {saving ? "Сохраняю…" : "Сохранить"}
          </button>
        )}
        <div className={saved ? "ml-auto" : undefined}>
          <RefreshButton onClick={load} />
        </div>
      </PageHeader>

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-[500px]" />
          </>
        ) : (
          <>
            {/* Заголовок месяца */}
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold capitalize">{monthName}</h2>
              {plan ? (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">План загружен</span>
              ) : (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">План не задан</span>
              )}
            </div>

            {/* Summary strip */}
            {planTotal > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[.07em]">
                    {METRIC_LABELS[tab]} — выполнение
                  </p>
                  <span className="text-[12px] font-bold tabular-nums">
                    {fmt(actualTotal, tab)} / {fmt(planTotal, tab)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-border overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      progress >= 100 ? "bg-emerald-500" :
                      progress >= 70  ? "bg-amber-500"   : "bg-red-500"
                    )}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground/60 text-right">{progress}%</p>
              </div>
            )}

            {/* Таб-переключатель метрик */}
            <TabGroup
              items={METRICS.map(m => m.label)}
              active={metricInfo.label}
              onChange={l => setTab(METRICS.find(m => m.label === l)!.key)}
            />

            {/* Таблица по дням */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-[13px] font-semibold">План по дням</h3>
                <span className="text-[11px] text-muted-foreground/60">{metricInfo.label}, {metricInfo.unit}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3 w-32">День</th>
                      <th className="px-4 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3">План</th>
                      <th className="px-4 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3">Факт</th>
                      <th className="px-4 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3">Вып</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(date => {
                      const planVal   = getVal(date, tab);
                      const actualVal = (actuals[date] as Record<string, number>)?.[tab];
                      const pct       = planVal > 0 && actualVal != null
                        ? Math.round(actualVal / planVal * 100) : null;
                      const weekend   = isWeekend(date);

                      return (
                        <tr key={date} className={cn(
                          "border-b border-border last:border-0 hover:bg-muted/30 transition-colors",
                          weekend && "bg-muted/20"
                        )}>
                          <td className="px-4 py-2.5">
                            <span className={cn("text-[12px]", weekend && "text-muted-foreground/50")}>
                              {dayLabel(date)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {/* Редактируемое поле */}
                            <div className="flex justify-end">
                              <input
                                type="number"
                                value={edits[date]?.[tab] ?? planVal}
                                onChange={e => setVal(date, tab, e.target.value)}
                                className="w-24 text-right text-[12px] bg-transparent border-b border-transparent hover:border-border focus:border-foreground/30 outline-none tabular-nums transition-colors"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-[12px] tabular-nums text-muted-foreground/70">
                            {actualVal != null ? fmt(actualVal, tab) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {pct != null && (
                              <span className={cn(
                                "text-[12px] font-bold tabular-nums",
                                pct >= 100 ? "text-emerald-600 dark:text-emerald-400" :
                                pct >= 70  ? "text-amber-600 dark:text-amber-400" :
                                             "text-red-600 dark:text-red-400"
                              )}>
                                {pct}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/20">
                      <td className="px-4 py-2.5 text-[12px] font-bold text-muted-foreground">Итого</td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-bold tabular-nums">{fmt(planTotal, tab)}</td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {actualTotal > 0 ? fmt(actualTotal, tab) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {actualTotal > 0 && planTotal > 0 && (
                          <span className={cn(
                            "text-[13px] font-bold tabular-nums",
                            progress >= 100 ? "text-emerald-600 dark:text-emerald-400" :
                            progress >= 70  ? "text-amber-600 dark:text-amber-400" :
                                             "text-red-600 dark:text-red-400"
                          )}>
                            {progress}%
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {!plan && (
              <div className="text-center py-6">
                <p className="text-[13px] text-muted-foreground/70">Задайте значения плана в таблице выше и нажмите «Сохранить»</p>
              </div>
            )}
          </>
        )}
      </PageContent>
    </div>
  );
}
