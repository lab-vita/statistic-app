"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  fetchPlanMonth, savePlanItems, fillPlan, fetchStats, fetchAppointmentStats, fetchDaily, fetchAppointmentDaily,
  toDateStr, type PlanMonthResponse, type DailyItem, type AppointmentDailyItem,
} from "@/lib/api";
import { useChartTheme } from "@/components/charts/base-chart";
import { PageContent, ProgressBar, Skeleton, ErrorBanner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

function fmt(n: number) { return Math.round(n).toLocaleString("ru-RU"); }
function fmtPct(n: number) { return Math.round(n) + "%"; }

const WEEKDAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

const METRICS_DEF = [
  { key: "calls_incoming" as const, label: "Вход. звонки",  color: "#2563eb" },
  { key: "calls_outgoing" as const, label: "Исх. звонки", color: "#7c3aed" },
  { key: "appt_count"     as const, label: "Записи",          color: "#16a34a" },
];

type MetricKey = "calls_incoming" | "calls_outgoing" | "appt_count";

// ─── Диалог «Заполнить»

function FillDialog({
  onClose, onSave,
}: { onClose: () => void; onSave: (metric: MetricKey, value: number, skipWeekends: boolean) => Promise<void> }) {
  const [metric, setMetric] = useState<MetricKey>("calls_incoming");
  const [value,  setValue]  = useState("");
  const [skip,   setSkip]   = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const v = Number(value);
    if (!v || v < 0) return;
    setSaving(true);
    try { await onSave(metric, v, skip); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-5">
        <h3 className="text-[14px] font-semibold mb-4">Заполнить весь месяц</h3>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-[12px] text-muted-foreground/70 block mb-1">Метрика</label>
            <select
              value={metric}
              onChange={e => setMetric(e.target.value as MetricKey)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            >
              {METRICS_DEF.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground/70 block mb-1">Значение на день</label>
            <input
              type="number" min={0} value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="напр. 15"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none">
            <input type="checkbox" checked={skip} onChange={e => setSkip(e.target.checked)} className="rounded" />
            Пропускать выходные
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-3 py-2 rounded-md border border-border text-[13px] hover:bg-muted/40 transition-colors">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || !value}
            className="flex-1 px-3 py-2 rounded-md bg-foreground text-background text-[13px] font-semibold disabled:opacity-50 transition-opacity">
            {saving ? "Сохранение…" : "Заполнить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── График план/факт

interface DayPoint {
  label:          string;
  plan_incoming:  number;
  fact_incoming:  number;
  plan_outgoing:  number;
  fact_outgoing:  number;
  plan_appt:      number;
  fact_appt:      number;
}

function PlanFactChart({ points, activeMetric }: { points: DayPoint[]; activeMetric: MetricKey }) {
  const ct = useChartTheme();
  if (points.length < 2) return null;

  const m = METRICS_DEF.find(x => x.key === activeMetric)!;
  const planKey = `plan_${activeMetric.replace("calls_", "").replace("appt_count", "appt")}`;
  const factKey = `fact_${activeMetric.replace("calls_", "").replace("appt_count", "appt")}`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <p className="text-[14px] font-semibold">План / Факт — {m.label}</p>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b-2 border-dashed inline-block" style={{ borderColor: m.color }} />План
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 inline-block rounded-sm" style={{ background: m.color, opacity: 0.7 }} />Факт
          </span>
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: ct.axis }}
              axisLine={false} tickLine={false}
              interval={Math.max(0, Math.floor(points.length / 10) - 1)}
            />
            <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} />
            <Tooltip {...ct.tooltip} />
            <Bar dataKey={factKey} name="Факт" fill={m.color} fillOpacity={0.7} radius={[3, 3, 0, 0]} maxBarSize={20} />
            <Line dataKey={planKey} name="План" type="monotone" stroke={m.color} strokeWidth={2} strokeDasharray="4 2" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Основная страница

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
  const [fillOpen, setFillOpen] = useState(false);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("calls_incoming");

  // Фактические данные по дням
  const [factByDate, setFactByDate] = useState<Record<string, { incoming: number; outgoing: number; appt: number }>>({});

  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay  = new Date(year, month, 0).getDate();
  const dateTo   = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, callsDaily, apptDaily] = await Promise.all([
        fetchPlanMonth(year, month),
        fetchDaily(dateFrom, dateTo).catch(() => ({ days: [] as DailyItem[] })),
        fetchAppointmentDaily(dateFrom, dateTo).catch(() => ({ days: [] as AppointmentDailyItem[] })),
      ]);
      setPlan(p);
      setEdits({});

      // Строим мапу факта по дням
      const apptMap: Record<string, number> = {};
      for (const d of apptDaily.days) apptMap[d.date] = d.total;
      const map: Record<string, { incoming: number; outgoing: number; appt: number }> = {};
      for (const d of callsDaily.days) {
        map[d.date] = { incoming: d.incoming, outgoing: d.outgoing, appt: apptMap[d.date] ?? 0 };
      }
      setFactByDate(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [year, month, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  function getVal(date: string, metric: string): number {
    if (edits[date]?.[metric] !== undefined) return Number(edits[date][metric]) || 0;
    const day = plan?.days.find(d => d.date === date);
    return day ? (day as Record<string, number>)[metric] ?? 0 : 0;
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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally { setSaving(false); }
  }

  async function handleFill(metric: MetricKey, value: number, skipWeekends: boolean) {
    await fillPlan({ date_from: dateFrom, date_to: dateTo, metric, value, skip_weekends: skipWeekends });
    await load();
  }

  const hasEdits = Object.keys(edits).length > 0;
  const planTotals = plan?.totals ?? { calls_incoming: 0, calls_outgoing: 0, appt_count: 0 };

  // Итоги факта
  const factTotals = Object.values(factByDate).reduce(
    (acc, d) => ({ incoming: acc.incoming + d.incoming, outgoing: acc.outgoing + d.outgoing, appt: acc.appt + d.appt }),
    { incoming: 0, outgoing: 0, appt: 0 }
  );

  const METRICS = [
    { key: "calls_incoming" as const, label: "Входящие звонки",  fact: factTotals.incoming, plan: planTotals.calls_incoming, color: "#2563eb" },
    { key: "calls_outgoing" as const, label: "Исходящие звонки", fact: factTotals.outgoing, plan: planTotals.calls_outgoing, color: "#7c3aed" },
    { key: "appt_count"     as const, label: "Записи",           fact: factTotals.appt,     plan: planTotals.appt_count,     color: "#16a34a" },
  ];

  // Данные для графика
  const chartPoints: DayPoint[] = (plan?.days ?? []).map(d => {
    const f = factByDate[d.date];
    const dayLabel = new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    return {
      label:         dayLabel,
      plan_incoming: d.calls_incoming,
      fact_incoming: f?.incoming ?? 0,
      plan_outgoing: d.calls_outgoing,
      fact_outgoing: f?.outgoing ?? 0,
      plan_appt:     d.appt_count,
      fact_appt:     f?.appt ?? 0,
    };
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {fillOpen && (
        <FillDialog onClose={() => setFillOpen(false)} onSave={handleFill} />
      )}

      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-5">
        <span className="text-[13px] font-bold">Плановые показатели</span>
        <div className="flex-1" />
        <button
          onClick={() => setFillOpen(true)}
          className="px-3 py-1.5 rounded-md border border-border text-[12px] font-medium hover:bg-accent transition-colors"
        >
          Заполнить…
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors text-base">‹</button>
          <span className="text-[12px] font-semibold min-w-[140px] text-center capitalize">{monthName}</span>
          <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors text-base">›</button>
        </div>
      </header>

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <div className="grid grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
            <Skeleton className="h-56" />
            <Skeleton className="h-96" />
          </>
        ) : (
          <>
            {/* Progress cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {METRICS.map(m => {
                const pct = m.plan > 0 ? Math.round(m.fact / m.plan * 100) : 0;
                const colorText = pct >= 80 ? "text-emerald-600 dark:text-emerald-400"
                  : pct >= 50 ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400";
                const isActive = activeMetric === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setActiveMetric(m.key)}
                    className={cn(
                      "rounded-lg border bg-card p-4 text-left transition-all",
                      isActive ? "border-foreground/30 ring-1 ring-foreground/20" : "border-border hover:border-foreground/20"
                    )}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-3">{m.label}</p>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[26px] font-black tabular-nums tracking-tight">{fmt(m.fact)}</span>
                      <span className="text-[13px] text-muted-foreground/60">из {fmt(m.plan)}</span>
                    </div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[11px] text-muted-foreground/60">план на месяц</span>
                      <span className={cn("text-[11px] font-black tabular-nums", colorText)}>{fmtPct(pct)}</span>
                    </div>
                    <ProgressBar pct={pct} />
                  </button>
                );
              })}
            </div>

            {/* Chart plan vs fact */}
            {chartPoints.length > 1 && (
              <PlanFactChart points={chartPoints} activeMetric={activeMetric} />
            )}

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
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 border-b border-border">Вх. зв. (план)</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/50 border-b border-border">факт</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 border-b border-border">Исх. зв. (план)</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/50 border-b border-border">факт</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 border-b border-border">Записей (план)</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/50 border-b border-border">факт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan?.days.map(d => {
                      const dayOfWeek = WEEKDAYS[d.weekday];
                      const f = factByDate[d.date];
                      const today = new Date().toISOString().slice(0, 10);
                      const isPast = d.date < today;

                      // Подсветка если прошлый день и план не выполнен
                      const planIn  = getVal(d.date, "calls_incoming");
                      const planOut = getVal(d.date, "calls_outgoing");
                      const planAp  = getVal(d.date, "appt_count");
                      const factIn  = f?.incoming ?? 0;
                      const factOut = f?.outgoing ?? 0;
                      const factAp  = f?.appt ?? 0;
                      const missed  = isPast && !d.is_weekend && (
                        (planIn > 0 && factIn < planIn) ||
                        (planOut > 0 && factOut < planOut) ||
                        (planAp > 0 && factAp < planAp)
                      );

                      return (
                        <tr key={d.date} className={cn(
                          "border-b border-border transition-colors",
                          missed ? "bg-red-50/60 dark:bg-red-950/20" : d.is_weekend ? "bg-muted/20" : "hover:bg-muted/20"
                        )}>
                          <td className="px-4 py-2 text-[12px] border-b border-border tabular-nums">
                            {new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                          </td>
                          <td className={cn("px-4 py-2 text-[12px] border-b border-border", d.is_weekend ? "text-red-500" : "text-muted-foreground/60")}>
                            {dayOfWeek}
                          </td>

                          {/* Входящие звонки */}
                          <td className="px-3 py-1.5 text-right border-b border-border">
                            <input
                              type="number" min={0}
                              value={edits[d.date]?.["calls_incoming"] ?? d.calls_incoming}
                              onChange={e => setVal(d.date, "calls_incoming", e.target.value)}
                              className="w-14 rounded-md border border-border bg-background px-2 py-1 text-right text-[12px] tabular-nums outline-none focus:border-foreground/40 transition-colors"
                            />
                          </td>
                          <td className={cn("px-4 py-2 text-right text-[12px] tabular-nums border-b border-border",
                            isPast && planIn > 0 ? factIn >= planIn ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-500 font-semibold" : "text-muted-foreground/50"
                          )}>
                            {f ? factIn : "—"}
                          </td>

                          {/* Исходящие звонки */}
                          <td className="px-3 py-1.5 text-right border-b border-border">
                            <input
                              type="number" min={0}
                              value={edits[d.date]?.["calls_outgoing"] ?? d.calls_outgoing}
                              onChange={e => setVal(d.date, "calls_outgoing", e.target.value)}
                              className="w-14 rounded-md border border-border bg-background px-2 py-1 text-right text-[12px] tabular-nums outline-none focus:border-foreground/40 transition-colors"
                            />
                          </td>
                          <td className={cn("px-4 py-2 text-right text-[12px] tabular-nums border-b border-border",
                            isPast && planOut > 0 ? factOut >= planOut ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-500 font-semibold" : "text-muted-foreground/50"
                          )}>
                            {f ? factOut : "—"}
                          </td>

                          {/* Записи */}
                          <td className="px-3 py-1.5 text-right border-b border-border">
                            <input
                              type="number" min={0}
                              value={edits[d.date]?.["appt_count"] ?? d.appt_count}
                              onChange={e => setVal(d.date, "appt_count", e.target.value)}
                              className="w-14 rounded-md border border-border bg-background px-2 py-1 text-right text-[12px] tabular-nums outline-none focus:border-foreground/40 transition-colors"
                            />
                          </td>
                          <td className={cn("px-4 py-2 text-right text-[12px] tabular-nums border-b border-border",
                            isPast && planAp > 0 ? factAp >= planAp ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-500 font-semibold" : "text-muted-foreground/50"
                          )}>
                            {f ? factAp : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t border-border">
                      <td colSpan={2} className="px-4 py-2.5 text-[12px] font-bold">Итого за месяц</td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-black tabular-nums">
                        {fmt(plan?.days.reduce((s, d) => s + getVal(d.date, "calls_incoming"), 0) ?? 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[12px] font-semibold tabular-nums text-muted-foreground">
                        {fmt(factTotals.incoming)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-black tabular-nums">
                        {fmt(plan?.days.reduce((s, d) => s + getVal(d.date, "calls_outgoing"), 0) ?? 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[12px] font-semibold tabular-nums text-muted-foreground">
                        {fmt(factTotals.outgoing)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-black tabular-nums">
                        {fmt(plan?.days.reduce((s, d) => s + getVal(d.date, "appt_count"), 0) ?? 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[12px] font-semibold tabular-nums text-muted-foreground">
                        {fmt(factTotals.appt)}
                      </td>
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
