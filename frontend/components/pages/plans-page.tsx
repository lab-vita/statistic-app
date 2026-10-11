"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPlanMonth, savePlanItems, fetchStats, fetchAppointmentStats, toDateStr, type PlanMonthResponse } from "@/lib/api";
import { PageContent, ProgressBar, Skeleton, ErrorBanner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

function fmt(n: number) { return Math.round(n).toLocaleString("ru-RU"); }
function fmtPct(n: number) { return Math.round(n) + "%"; }

const WEEKDAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

export function PlansPage() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [plan,  setPlan]  = useState<PlanMonthResponse | null>(null);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Фактические данные за текущий месяц
  const [factIncoming, setFactIncoming] = useState(0);
  const [factOutgoing, setFactOutgoing] = useState(0);
  const [factAppts,    setFactAppts]    = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchPlanMonth(year, month)
      .then(p => { setPlan(p); setEdits({}); })
      .catch(e => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false));

    // Загружаем факт за весь месяц
    const dateFrom = `${year}-${String(month).padStart(2,"0")}-01`;
    const lastDay  = new Date(year, month, 0).getDate();
    const dateTo   = `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    Promise.all([
      fetchStats(dateFrom, dateTo).catch(() => null),
      fetchAppointmentStats(dateFrom, dateTo).catch(() => null),
    ]).then(([s, a]) => {
      setFactIncoming(s?.operators["total"]?.incoming ?? 0);
      setFactOutgoing(s?.operators["total"]?.outgoing ?? 0);
      setFactAppts(a?.total?.total ?? 0);
    });
  }, [year, month]);

  const monthName = new Date(year, month-1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  function getVal(date: string, metric: string): number {
    if (edits[date]?.[metric] !== undefined) return Number(edits[date][metric]) || 0;
    const day = plan?.days.find(d => d.date === date);
    return day ? (day as any)[metric] ?? 0 : 0;
  }

  function setVal(date: string, metric: string, val: string) {
    setEdits(prev => ({ ...prev, [date]: { ...prev[date], [metric]: val } }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const items: { date: string; metric: string; value: number }[] = [];
    for (const [date, metrics] of Object.entries(edits)) {
      for (const [metric, val] of Object.entries(metrics)) {
        items.push({ date, metric, value: Number(val) || 0 });
      }
    }
    try {
      await savePlanItems(items);
      setSaved(true);
      setEdits({});
      const p = await fetchPlanMonth(year, month);
      setPlan(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally { setSaving(false); }
  }

  const hasEdits = Object.keys(edits).length > 0;
  const planTotals = plan?.totals ?? { calls_incoming: 0, calls_outgoing: 0, appt_count: 0 };

  const METRICS = [
    { key: "calls_incoming", label: "Входящие звонки",  fact: factIncoming, plan: planTotals.calls_incoming },
    { key: "calls_outgoing", label: "Исходящие звонки", fact: factOutgoing, plan: planTotals.calls_outgoing },
    { key: "appt_count",     label: "Записей",           fact: factAppts,    plan: planTotals.appt_count    },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-5">
        <span className="text-[13px] font-bold">Плановые показатели</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); }}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors text-base">‹</button>
          <span className="text-[12px] font-semibold min-w-[140px] text-center capitalize">{monthName}</span>
          <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); }}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors text-base">›</button>
        </div>
      </header>

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <div className="grid grid-cols-3 gap-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-28"/>)}</div>
            <Skeleton className="h-96" />
          </>
        ) : (
          <>
            {/* Progress cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {METRICS.map(m => {
                const pct = m.plan > 0 ? Math.round(m.fact / m.plan * 100) : 0;
                const color = pct >= 80 ? "text-emerald-600 dark:text-emerald-400"
                  : pct >= 50 ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400";
                return (
                  <div key={m.key} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-3">{m.label}</p>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[26px] font-black tabular-nums tracking-tight">{fmt(m.fact)}</span>
                      <span className="text-[13px] text-muted-foreground/60">из {fmt(m.plan)}</span>
                    </div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[11px] text-muted-foreground/60">план на месяц</span>
                      <span className={cn("text-[11px] font-black tabular-nums", color)}>{fmtPct(pct)}</span>
                    </div>
                    <ProgressBar pct={pct} />
                  </div>
                );
              })}
            </div>

            {/* Edit table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-[13px] font-semibold">Редактирование плана — {monthName}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground/50">Нажмите на число чтобы изменить</span>
                  {hasEdits && (
                    <button onClick={handleSave} disabled={saving}
                      className="px-3 py-1.5 rounded-md bg-foreground text-background text-[12px] font-semibold disabled:opacity-60 transition-opacity">
                      {saving ? "Сохранение…" : "Сохранить"}
                    </button>
                  )}
                  {saved && !hasEdits && (
                    <span className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium">✓ Сохранено</span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 border-b border-border">Дата</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 border-b border-border">День</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 border-b border-border">Вход. звонки</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 border-b border-border">Исх. звонки</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 border-b border-border">Записей</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan?.days.map(d => {
                      const dayOfWeek = WEEKDAYS[d.weekday];
                      return (
                        <tr key={d.date} className={cn(d.is_weekend ? "bg-muted/20" : "hover:bg-muted/20", "transition-colors")}>
                          <td className="px-4 py-2 text-[12px] border-b border-border tabular-nums">
                            {new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                          </td>
                          <td className={cn("px-4 py-2 text-[12px] border-b border-border", d.is_weekend ? "text-red-500" : "text-muted-foreground/60")}>
                            {dayOfWeek}
                          </td>
                          {(["calls_incoming","calls_outgoing","appt_count"] as const).map(metric => (
                            <td key={metric} className="px-3 py-1.5 text-right border-b border-border">
                              <input
                                type="number"
                                min={0}
                                value={edits[d.date]?.[metric] ?? (d as any)[metric]}
                                onChange={e => setVal(d.date, metric, e.target.value)}
                                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-right text-[12px] tabular-nums outline-none focus:border-foreground/40 transition-colors"
                                style={{ MozAppearance: "textfield" } as any}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t border-border">
                      <td colSpan={2} className="px-4 py-2.5 text-[12px] font-bold">Итого за месяц</td>
                      {(["calls_incoming","calls_outgoing","appt_count"] as const).map(metric => (
                        <td key={metric} className="px-4 py-2.5 text-right text-[13px] font-black tabular-nums">
                          {fmt(plan?.days.reduce((s, d) => s + (getVal(d.date, metric)), 0) ?? 0)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Fixed threshold */}
            <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-2">
                  Порог пропущенных звонков
                </p>
                <p className="text-[24px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ≤ {plan?.fixed.calls_missed_pct ?? 6}%
                </p>
              </div>
              <div className="h-10 w-px bg-border" />
              <p className="text-[12px] text-muted-foreground/60 leading-relaxed max-w-[400px]">
                Фиксированный бизнес-показатель. Если доля пропущенных превышает этот порог —
                карточка подсвечивается красным и план считается не выполненным.
              </p>
            </div>
          </>
        )}
      </PageContent>
    </div>
  );
}
