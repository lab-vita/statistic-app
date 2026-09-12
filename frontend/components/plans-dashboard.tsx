"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchPlanMonth, upsertPlans, fillPlans,
  PlanDay, PlanMonthResponse,
} from "@/lib/api";
import {
  PhoneIncoming, PhoneOutgoing, Phone, PhoneMissed,
  CalendarCheck, ChevronLeft, ChevronRight, Zap, Save, X,
} from "lucide-react";

const MONTH_NAMES = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];
const WEEKDAY_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

type EditableMetric = "calls_incoming" | "calls_outgoing" | "appt_count";

// ─── Модалка редактирования ───────────────────────────────────

interface EditModalProps {
  metric:    EditableMetric;
  label:     string;
  accent:    string;
  year:      number;
  month:     number;
  onClose:   () => void;
  onSaved:   () => void;
}

function EditModal({ metric, label, accent, year, month: initMonth, onClose, onSaved }: EditModalProps) {
  const [y, setY] = useState(year);
  const [m, setM] = useState(initMonth);
  const [data, setData]     = useState<PlanMonthResponse | null>(null);
  const [edited, setEdited] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
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
    const items = data.days.map(d => ({
      date: d.date, metric, value: getValue(d),
    }));
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
    setFillVal("");
    setShowFill(false);
    await load();
  }

  function prevMonth() { if (m === 1) { setY(v => v-1); setM(12); } else setM(v => v-1); }
  function nextMonth() { if (m === 12) { setY(v => v+1); setM(1); } else setM(v => v+1); }

  const total = data?.days.reduce((s, d) => s + getValue(d), 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h3 className="text-sm font-semibold">{label}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Навигация */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <button onClick={prevMonth} className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/40 transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-sm font-medium">{MONTH_NAMES[m-1]} {y}</span>
          <button onClick={nextMonth} className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/40 transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Быстрое заполнение */}
        <div className="px-5 py-3 border-b border-border flex-shrink-0">
          {showFill ? (
            <div className="flex items-center gap-2">
              <input
                type="number" value={fillVal} onChange={e => setFillVal(e.target.value)}
                placeholder="Значение на каждый день"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-foreground/40"
                autoFocus
              />
              <button onClick={applyFill} disabled={!fillVal}
                className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-40">
                Применить
              </button>
              <button onClick={() => setShowFill(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowFill(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Zap className="h-3.5 w-3.5" /> Быстрое заполнение всех дней
            </button>
          )}
        </div>

        {/* Таблица дней */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">День</th>
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">ДН</th>
                <th className="px-5 py-2 text-right text-xs font-medium text-muted-foreground">План</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.days.map(day => {
                const isWeekend = day.is_weekend;
                const val = getValue(day);
                return (
                  <tr key={day.date} className={isWeekend ? "bg-muted/20" : "hover:bg-muted/20 transition-colors"}>
                    <td className="px-5 py-1.5">
                      <span className={`text-sm ${isWeekend ? "text-muted-foreground" : "font-medium"}`}>
                        {new Date(day.date).getDate()}
                      </span>
                    </td>
                    <td className="px-5 py-1.5">
                      <span className={`text-xs ${isWeekend ? "text-red-400" : "text-muted-foreground"}`}>
                        {WEEKDAY_SHORT[day.weekday]}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-right">
                      <EditableCell
                        value={val}
                        isWeekend={isWeekend}
                        accent={accent}
                        onChange={v => handleChange(day.date, v)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <td colSpan={2} className="px-5 py-3 font-semibold text-sm">Итого</td>
                <td className={`px-5 py-3 text-right font-mono font-semibold ${accent}`}>{total}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-60">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Редактируемая ячейка
function EditableCell({ value, isWeekend, accent, onChange }: {
  value: number; isWeekend: boolean; accent: string; onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value || ""));
  useEffect(() => { setLocal(String(value || "")); }, [value]);

  return (
    <input
      type="number" value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => onChange(Number(local) || 0)}
      onKeyDown={e => { if (e.key === "Enter") onChange(Number(local) || 0); }}
      className={`w-20 text-right text-sm font-mono rounded-md border border-transparent
        hover:border-border focus:border-foreground/40 focus:bg-background outline-none px-2 py-1
        transition-colors bg-transparent ${isWeekend ? "text-muted-foreground" : accent}`}
      min={0}
    />
  );
}

// Модалка для % пропущенных
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-80 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Порог пропущенных</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Максимально допустимый % пропущенных звонков от входящих
        </p>
        <div className="flex items-center gap-2">
          <input type="number" value={local} onChange={e => setLocal(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
            min={0} max={100} />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-60">
            {saving ? "..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Карточка плана ───────────────────────────────────────────

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
    <div
      onClick={clickable ? onClick : undefined}
      className={`rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 transition-colors
        ${clickable ? "cursor-pointer hover:border-foreground/30 hover:bg-muted/20" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <div className="flex items-center gap-1.5">
          {icon}
          {clickable && <span className="text-[10px] text-muted-foreground">редактировать</span>}
        </div>
      </div>
      <div className={`text-2xl font-semibold tracking-tight font-mono ${accent}`}>{value}</div>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────

export function PlansDashboard() {
  const now = new Date();
  const [year]  = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);

  const [data, setData]         = useState<PlanMonthResponse | null>(null);
  const [missedPct, setMissedPct] = useState(6);
  const [openMetric, setOpenMetric] = useState<EditableMetric | null>(null);
  const [openMissed, setOpenMissed] = useState(false);

  async function load() {
    const res = await fetchPlanMonth(year, month);
    setData(res);
    setMissedPct(res.fixed.calls_missed_pct);
  }

  useEffect(() => { load(); }, [year, month]);

  const totals = data?.totals ?? { calls_incoming: 0, calls_outgoing: 0, appt_count: 0 };
  const totalCalls = totals.calls_incoming + totals.calls_outgoing;

  const MODAL_META: Record<EditableMetric, { label: string; accent: string }> = {
    calls_incoming: { label: "Входящие звонки",   accent: "text-emerald-500" },
    calls_outgoing: { label: "Исходящие звонки",  accent: "text-blue-500"    },
    appt_count:     { label: "Записей в день",     accent: "text-purple-500"  },
  };

  return (
    <div className="space-y-5">
      {/* Модалки */}
      {openMetric && (
        <EditModal
          metric={openMetric}
          label={MODAL_META[openMetric].label}
          accent={MODAL_META[openMetric].accent}
          year={year}
          month={month}
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

      {/* Шапка */}
      <div>
        <h1 className="text-base font-semibold">Плановые показатели</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {MONTH_NAMES[month-1]} {year} · нажмите на карточку чтобы редактировать
        </p>
      </div>

      {/* Карточки — Звонки */}
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Звонки</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <PlanCard
            title="Входящие" icon={<PhoneIncoming className="h-4 w-4 text-emerald-500" />}
            accent="text-emerald-500" value={totals.calls_incoming}
            sub="план на месяц" clickable onClick={() => setOpenMetric("calls_incoming")}
          />
          <PlanCard
            title="Исходящие" icon={<PhoneOutgoing className="h-4 w-4 text-blue-500" />}
            accent="text-blue-500" value={totals.calls_outgoing}
            sub="план на месяц" clickable onClick={() => setOpenMetric("calls_outgoing")}
          />
          <PlanCard
            title="Общий план" icon={<Phone className="h-4 w-4 text-muted-foreground" />}
            accent="text-foreground" value={totalCalls}
            sub="входящие + исходящие"
          />
          <PlanCard
            title="Пропущенные ≤" icon={<PhoneMissed className="h-4 w-4 text-red-500" />}
            accent="text-red-500" value={`${missedPct}%`}
            sub="допустимый порог" clickable onClick={() => setOpenMissed(true)}
          />
        </div>
      </div>

      {/* Карточки — Записи */}
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Записи</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <PlanCard
            title="Записей в день" icon={<CalendarCheck className="h-4 w-4 text-purple-500" />}
            accent="text-purple-500" value={totals.appt_count}
            sub="суммарный план на месяц" clickable onClick={() => setOpenMetric("appt_count")}
          />
        </div>
      </div>
    </div>
  );
}
