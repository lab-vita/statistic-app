"use client";

import { useAuth } from "@/components/auth-gate";
import { useState, useEffect, useCallback } from "react";
import {
  fetchPlanMonth, upsertPlans, fillPlans,
  PlanDay, PlanMonthResponse,
} from "@/lib/api";
import {
  PhoneIncoming, PhoneOutgoing, Phone, PhoneMissed,
  CalendarCheck, ChevronLeft, ChevronRight, Zap, Save, X, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const MONTH_NAMES = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];
const WEEKDAY_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

type EditableMetric = "calls_incoming" | "calls_outgoing" | "appt_count";

// ─── Модалка редактирования ───────────────────────────────────

interface EditModalProps {
  metric:  EditableMetric;
  label:   string;
  accent:  string;
  year:    number;
  month:   number;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ metric, label, accent, year, month: initMonth, onClose, onSaved }: EditModalProps) {
  const [y, setY] = useState(year);
  const [m, setM] = useState(initMonth);
  const [data, setData]       = useState<PlanMonthResponse | null>(null);
  const [edited, setEdited]   = useState<Record<string, number>>({});
  const [saving, setSaving]   = useState(false);
  const [fillVal, setFillVal] = useState("");
  const [showFill, setShowFill] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchPlanMonth(y, m);
    setData(res);
    setEdited({});
  }, [y, m]);

  useEffect(() => { load(); }, [load]);

  function getValue(day: PlanDay): number {
    return edited[day.date] ?? day[metric];
  }

  function handleChange(date: string, val: number) {
    setEdited(prev => ({ ...prev, [date]: val }));
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    const items = data.days.map(d => ({ date: d.date, metric, value: getValue(d) }));
    await upsertPlans(items);
    setSaving(false);
    onSaved();
    onClose();
  }

  async function applyFill() {
    if (!data || !fillVal) return;
    const dateFrom = `${y}-${String(m).padStart(2,"0")}-01`;
    const lastDay  = new Date(y, m, 0).getDate();
    const dateTo   = `${y}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    await fillPlans(dateFrom, dateTo, metric, Number(fillVal), false);
    setFillVal(""); setShowFill(false);
    await load();
  }

  function prevMonth() { if (m === 1) { setY(v => v-1); setM(12); } else setM(v => v-1); }
  function nextMonth() { if (m === 12) { setY(v => v+1); setM(1); } else setM(v => v+1); }

  const total = data?.days.reduce((s, d) => s + getValue(d), 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl border border-border bg-card shadow-xl">

        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">{label}</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onClose} aria-label="Закрыть">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={prevMonth}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm font-medium">{MONTH_NAMES[m-1]} {y}</span>
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={nextMonth}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="shrink-0 border-b border-border px-5 py-3">
          {showFill ? (
            <div className="flex items-center gap-2">
              <input type="number" value={fillVal} onChange={e => setFillVal(e.target.value)}
                placeholder="Значение на каждый день"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                autoFocus />
              <Button size="sm" onClick={applyFill} disabled={!fillVal}
                className="h-7 rounded-lg text-xs">
                Применить
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowFill(false)} aria-label="Отмена">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button onClick={() => setShowFill(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <Zap className="h-3.5 w-3.5" /> Быстрое заполнение всех дней
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border bg-card">
              <tr>
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">День</th>
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">ДН</th>
                <th className="px-5 py-2 text-right text-xs font-medium text-muted-foreground">План</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.days.map(day => {
                const isWeekend = day.is_weekend;
                return (
                  <tr key={day.date} className={isWeekend ? "bg-muted/20" : "transition-colors hover:bg-muted/20"}>
                    <td className="px-5 py-1.5">
                      <span className={`text-sm ${isWeekend ? "text-muted-foreground" : "font-medium"}`}>
                        {new Date(day.date).getDate()}
                      </span>
                    </td>
                    <td className="px-5 py-1.5">
                      <span className={`text-xs ${isWeekend ? "text-red-400 dark:text-red-500" : "text-muted-foreground"}`}>
                        {WEEKDAY_SHORT[day.weekday]}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-right">
                      <EditableCell
                        value={getValue(day)} isWeekend={isWeekend} accent={accent}
                        onChange={v => handleChange(day.date, v)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <td colSpan={2} className="px-5 py-3 text-sm font-semibold">Итого</td>
                <td className={`px-5 py-3 text-right font-mono font-semibold tabular-nums ${accent}`}>{total}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditableCell({ value, isWeekend, accent, onChange }: {
  value: number; isWeekend: boolean; accent: string; onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value || ""));
  useEffect(() => { setLocal(String(value || "")); }, [value]);
  return (
    <input type="number" value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => onChange(Number(local) || 0)}
      onKeyDown={e => { if (e.key === "Enter") onChange(Number(local) || 0); }}
      className={`w-20 rounded-md border border-transparent bg-transparent px-2 py-1 text-right text-sm font-mono tabular-nums outline-none transition-colors placeholder:text-muted-foreground hover:border-border focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/20 ${isWeekend ? "text-muted-foreground" : accent}`}
      min={0}
    />
  );
}

function MissedPctModal({ value, onClose, onSaved }: {
  value: number; onClose: () => void; onSaved: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    await upsertPlans([{ date: today, metric: "calls_missed_pct", value: Number(local) }]);
    setSaving(false);
    onSaved(Number(local));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-80 space-y-4 rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Порог пропущенных</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onClose} aria-label="Закрыть">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Максимально допустимый % пропущенных звонков от входящих
        </p>
        <div className="flex items-center gap-2">
          <input type="number" value={local} onChange={e => setLocal(e.target.value)}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            min={0} max={100} />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? "..." : "Сохранить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PlanCardProps {
  title:      string;
  icon:       React.ReactNode;
  accent:     string;
  value:      string | number;
  sub:        string;
  clickable?: boolean;
  onClick?:   () => void;
}

function PlanCard({ title, icon, accent, value, sub, clickable, onClick }: PlanCardProps) {
  return (
    <div onClick={clickable ? onClick : undefined}
      className={`flex flex-col gap-1.5 rounded-xl border border-border bg-card p-5 transition-all ${
        clickable ? "cursor-pointer hover:border-foreground/15 hover:shadow-sm" : ""
      }`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
        <div className="flex items-center gap-1.5">
          {icon}
          {clickable && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground"><Pencil className="h-3 w-3" /> изменить</span>}
        </div>
      </div>
      <div className={`text-2xl font-semibold tracking-tight tabular-nums ${accent}`}>{value}</div>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────

export function PlansDashboard() {
  const { can } = useAuth();
  const canEdit = can("plans:edit");
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [data, setData]             = useState<PlanMonthResponse | null>(null);
  const [missedPct, setMissedPct]   = useState(6);
  const [openMetric, setOpenMetric] = useState<EditableMetric | null>(null);
  const [openMissed, setOpenMissed] = useState(false);

  async function load() {
    const res = await fetchPlanMonth(year, month);
    setData(res);
    setMissedPct(res.fixed.calls_missed_pct);
  }

  useEffect(() => { load(); }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const totals     = data?.totals ?? { calls_incoming: 0, calls_outgoing: 0, appt_count: 0 };
  const totalCalls = totals.calls_incoming + totals.calls_outgoing;

  const MODAL_META: Record<EditableMetric, { label: string; accent: string }> = {
    calls_incoming: { label: "Входящие звонки",  accent: "text-emerald-500" },
    calls_outgoing: { label: "Исходящие звонки", accent: "text-blue-500"    },
    appt_count:     { label: "Записей в день",   accent: "text-purple-500"  },
  };

  return (
    <div className="space-y-6">
      {openMetric && (
        <EditModal
          metric={openMetric}
          label={MODAL_META[openMetric].label}
          accent={MODAL_META[openMetric].accent}
          year={year} month={month}
          onClose={() => setOpenMetric(null)}
          onSaved={load}
        />
      )}
      {openMissed && (
        <MissedPctModal
          value={missedPct}
          onClose={() => setOpenMissed(false)}
          onSaved={v => setMissedPct(v)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Плановые показатели</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canEdit ? "Нажмите на карточку чтобы редактировать" : "Просмотр плановых показателей"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={prevMonth} aria-label="Предыдущий месяц">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {MONTH_NAMES[month-1]} {year}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={nextMonth} aria-label="Следующий месяц">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Звонки */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Звонки</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PlanCard
            title="Входящие" icon={<PhoneIncoming className="h-4 w-4 text-emerald-500" />}
            accent="text-emerald-600 dark:text-emerald-400" value={totals.calls_incoming}
            sub="план на месяц" clickable={canEdit} onClick={() => canEdit && setOpenMetric("calls_incoming")}
          />
          <PlanCard
            title="Исходящие" icon={<PhoneOutgoing className="h-4 w-4 text-blue-500" />}
            accent="text-blue-600 dark:text-blue-400" value={totals.calls_outgoing}
            sub="план на месяц" clickable={canEdit} onClick={() => canEdit && setOpenMetric("calls_outgoing")}
          />
          <PlanCard
            title="Общий план" icon={<Phone className="h-4 w-4 text-muted-foreground" />}
            accent="text-foreground" value={totalCalls}
            sub="входящие + исходящие"
          />
          <PlanCard
            title="Пропущенные ≤" icon={<PhoneMissed className="h-4 w-4 text-red-500" />}
            accent="text-red-500 dark:text-red-400" value={`${missedPct}%`}
            sub="допустимый порог" clickable={canEdit} onClick={() => canEdit && setOpenMissed(true)}
          />
        </div>
      </div>

      {/* Записи */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Записи</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PlanCard
            title="Записей в день" icon={<CalendarCheck className="h-4 w-4 text-violet-500" />}
            accent="text-violet-600 dark:text-violet-400" value={totals.appt_count}
            sub="суммарный план на месяц" clickable={canEdit} onClick={() => canEdit && setOpenMetric("appt_count")}
          />
        </div>
      </div>
    </div>
  );
}
