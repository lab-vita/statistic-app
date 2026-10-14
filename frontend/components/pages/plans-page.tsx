"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchPlanRange, savePlan, createPlan,
  fetchStats, fetchAppointmentStats,
  toDateStr,
  type PlanMonth, type PlanDay,
} from "@/lib/api";
import {
  PageContent, Skeleton, Empty, ErrorBanner,
  TabGroup,
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
  const [plan,    setPlan]    = useState<PlanMonth | null>(null);
  const [actuals, setActuals] = useState<Record<string, Actuals>>({});
  const [edits,   setEdits]   = useState<Record<string, Record<string, string>>>({});
  const [saved,   setSaved]   = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<MetricKey>("incoming");

  const dateFrom = toDateStr(new Date(year, month - 1, 1));
  const dateTo   = toDateStr(new Date(year, month, 0));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [planRes, statsRes, apptRes] = await Promise.all([
        fetchPlanRange(year, month, year, month).catch(() => null),
        fetchStats(dateFrom, dateTo).catch(() => null),
        fetchAppointmentStats(dateFrom, dateTo).catch(() => null),
      ]);
      setPlan(planRes?.plans[0] ?? null);

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
        await createPlan(year, month, days as unknown as PlanDay[]);
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
      await savePlan(year, month, days);
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
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-5">
        <span className="text-[13px] font-bold">Планы</span>
        <div className="flex-1" />
        <div className="flex gap-1">
          {MONTHS.map(m => (
            <button
              key={m.value}
              onClick={() => setMonth(m.value)}
              className={cn(
                "px-2 py-0.5 text-[11px] rounded-md transition-colors",
                month === m.value
                  ? "bg-foreground text-background font-bold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {m.label.slice(0, 3)}
            </button>
          ))}
        </div>
        {!saved && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-2 px-3 py-1 text-[12px] font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Сохранью..." : "Сохранить"}
          </button>
        )}
        <button onClick={load} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors text-sm">↻</button>
      </header>

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
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 w-32">День</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60">План</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60">Факт</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60">Вып</th>
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
