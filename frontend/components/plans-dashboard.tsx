"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchPlanMonth, upsertPlans, fillPlans,
  PlanDay, PlanMonthResponse,
} from "@/lib/api";
import { ChevronLeft, ChevronRight, Save, Zap } from "lucide-react";

const MONTH_NAMES = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

const WEEKDAY_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

type Metric = "calls_incoming" | "calls_outgoing" | "appt_count";

const METRIC_LABELS: Record<Metric, string> = {
  calls_incoming: "Входящие звонки",
  calls_outgoing: "Исходящие звонки",
  appt_count:     "Записей в день",
};

// Быстрое заполнение — модалка
interface FillModalProps {
  onClose: () => void;
  onFill:  (metric: Metric, value: number, skipWeekends: boolean) => void;
}

function FillModal({ onClose, onFill }: FillModalProps) {
  const [metric, setMetric]           = useState<Metric>("calls_incoming");
  const [value, setValue]             = useState("");
  const [skipWeekends, setSkipWeekends] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background border border-border rounded-xl p-6 w-96 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold">Быстрое заполнение месяца</h3>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Метрика</label>
          <select value={metric} onChange={e => setMetric(e.target.value as Metric)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
            {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
              <option key={m} value={m}>{METRIC_LABELS[m]}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Значение на день</label>
          <input type="number" value={value} onChange={e => setValue(e.target.value)}
            placeholder="Например: 200"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40" />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={skipWeekends}
            onChange={e => setSkipWeekends(e.target.checked)}
            className="rounded" />
          Пропускать выходные (ставить 0)
        </label>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            Отмена
          </button>
          <button
            onClick={() => { if (value) { onFill(metric, Number(value), skipWeekends); onClose(); } }}
            disabled={!value}
            className="flex-1 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-40 transition-opacity">
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}

// Ячейка таблицы — редактируемая
interface PlanCellProps {
  value:    number;
  disabled: boolean;
  onChange: (v: number) => void;
}

function PlanCell({ value, disabled, onChange }: PlanCellProps) {
  const [local, setLocal] = useState(String(value === 0 && disabled ? "" : value || ""));

  useEffect(() => {
    setLocal(value === 0 && disabled ? "" : String(value || ""));
  }, [value, disabled]);

  if (disabled) {
    return <td className="px-3 py-2 text-center text-muted-foreground/40 bg-muted/20 text-xs">—</td>;
  }

  return (
    <td className="px-1 py-1">
      <input
        type="number"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => onChange(Number(local) || 0)}
        onKeyDown={e => { if (e.key === "Enter") onChange(Number(local) || 0); }}
        className="w-full text-center text-sm font-mono rounded-md border border-transparent bg-transparent
          hover:border-border focus:border-foreground/40 focus:bg-background outline-none px-1 py-1
          transition-colors"
        min={0}
      />
    </td>
  );
}

export function PlansDashboard() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [data, setData]       = useState<PlanMonthResponse | null>(null);
  const [edited, setEdited]   = useState<Record<string, Record<Metric, number>>>({});
  const [saving, setSaving]   = useState(false);
  const [showFill, setShowFill] = useState(false);
  const [saved, setSaved]     = useState(false);

  const load = useCallback(async () => {
    const res = await fetchPlanMonth(year, month);
    setData(res);
    setEdited({});
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function handleChange(date: string, metric: Metric, value: number) {
    setEdited(prev => ({
      ...prev,
      [date]: { ...(prev[date] ?? {}), [metric]: value } as Record<Metric, number>,
    }));
    setSaved(false);
  }

  function getValue(day: PlanDay, metric: Metric): number {
    return edited[day.date]?.[metric] ?? day[metric];
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    const items = [];
    for (const [date, metrics] of Object.entries(edited)) {
      for (const [metric, value] of Object.entries(metrics)) {
        items.push({ date, metric, value });
      }
    }
    // Также собираем все значения из таблицы (в т.ч. незменённые)
    const allItems = data.days.flatMap(day =>
      (["calls_incoming","calls_outgoing","appt_count"] as Metric[]).map(m => ({
        date:   day.date,
        metric: m,
        value:  getValue(day, m),
      }))
    );
    await upsertPlans(allItems);
    setSaving(false);
    setSaved(true);
    await load();
  }

  async function handleFill(metric: Metric, value: number, skipWeekends: boolean) {
    if (!data) return;
    const dateFrom = `${year}-${String(month).padStart(2,"0")}-01`;
    const lastDay  = new Date(year, month, 0).getDate();
    const dateTo   = `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    await fillPlans(dateFrom, dateTo, metric, value, skipWeekends);
    await load();
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // Итого с учётом правок
  const totals = data ? {
    calls_incoming: data.days.reduce((s, d) => s + getValue(d, "calls_incoming"), 0),
    calls_outgoing: data.days.reduce((s, d) => s + getValue(d, "calls_outgoing"), 0),
    appt_count:     data.days.reduce((s, d) => s + getValue(d, "appt_count"), 0),
  } : null;

  return (
    <div className="space-y-5">
      {showFill && <FillModal onClose={() => setShowFill(false)} onFill={handleFill} />}

      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Плановые показатели</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Фиксированный порог пропущенных: ≤ {data?.fixed.calls_missed_pct ?? 6}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFill(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Zap className="h-3.5 w-3.5" /> Быстрое заполнение
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-60 transition-opacity">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Сохранение..." : saved ? "Сохранено ✓" : "Сохранить"}
          </button>
        </div>
      </div>

      {/* Навигация по месяцу */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth}
          className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted/40 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium min-w-36 text-center">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button onClick={nextMonth}
          className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted/40 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Таблица */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">День</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">ДН</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-emerald-500 uppercase tracking-wider">Вход. звонки</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-blue-500 uppercase tracking-wider">Исход. звонки</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-purple-500 uppercase tracking-wider">Записей</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.days.map(day => {
                const isWeekend = day.is_weekend;
                const date = new Date(day.date);
                const dayNum = date.getDate();
                const weekdayIdx = day.weekday;

                return (
                  <tr key={day.date}
                    className={`transition-colors ${isWeekend ? "bg-muted/20" : "hover:bg-muted/20"}`}>
                    <td className="px-4 py-1.5 font-medium text-sm">
                      <span className={isWeekend ? "text-muted-foreground" : ""}>{dayNum}</span>
                    </td>
                    <td className="px-4 py-1.5 text-xs text-muted-foreground">
                      <span className={isWeekend ? "text-red-400" : ""}>
                        {WEEKDAY_SHORT[weekdayIdx]}
                      </span>
                    </td>
                    <PlanCell
                      value={getValue(day, "calls_incoming")}
                      disabled={isWeekend}
                      onChange={v => handleChange(day.date, "calls_incoming", v)}
                    />
                    <PlanCell
                      value={getValue(day, "calls_outgoing")}
                      disabled={isWeekend}
                      onChange={v => handleChange(day.date, "calls_outgoing", v)}
                    />
                    <PlanCell
                      value={getValue(day, "appt_count")}
                      disabled={isWeekend}
                      onChange={v => handleChange(day.date, "appt_count", v)}
                    />
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td colSpan={2} className="px-4 py-3 font-semibold text-sm">Итого</td>
                  <td className="px-3 py-3 text-center font-mono font-semibold text-emerald-500">{totals.calls_incoming}</td>
                  <td className="px-3 py-3 text-center font-mono font-semibold text-blue-500">{totals.calls_outgoing}</td>
                  <td className="px-3 py-3 text-center font-mono font-semibold text-purple-500">{totals.appt_count}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
