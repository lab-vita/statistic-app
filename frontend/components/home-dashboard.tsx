"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Widget, DashboardConfig,
  loadDashboard, saveDashboard,
  computeComposite, formatValue, getMetricFormat,
  SimpleWidgetConfig, CompositeWidgetConfig, DataSource,
  DEFAULT_DASHBOARD,
} from "@/lib/dashboard";
import { WidgetEditor } from "@/components/widget-editor";
import {
  fetchStats, fetchAppointmentStats, fetchPaymentStats,
  fetchHourly, fetchDaily, fetchAppointmentDaily, fetchPaymentDaily,
  toDateStr, addDays,
  StatsResponse, AppointmentStatsResponse, PaymentStatsResponse,
  HourlyResponse, DailyResponse, AppointmentDailyResponse, PaymentDailyResponse,
} from "@/lib/api";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, Settings2, Trash2, GripVertical,
  ChevronLeft, ChevronRight, RotateCcw,
  Phone, Calendar, Banknote, ShoppingBag, Sparkles,
} from "lucide-react";
import { Section } from "@/components/sidebar";

// ─── Цвета и иконки по источникам ────────────────────────────

const SOURCE_STYLE: Record<DataSource, {
  icon:    React.ElementType;
  color:   string;  // text color
  bg:      string;  // icon bg
  accent:  string;  // chart / bar fill
  border:  string;  // card left border
  badge:   string;  // source badge bg
}> = {
  calls: {
    icon:   Phone,
    color:  "text-blue-600 dark:text-blue-400",
    bg:     "bg-blue-500/10",
    accent: "#3b82f6",
    border: "border-l-blue-500",
    badge:  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  appointments: {
    icon:   Calendar,
    color:  "text-violet-600 dark:text-violet-400",
    bg:     "bg-violet-500/10",
    accent: "#8b5cf6",
    border: "border-l-violet-500",
    badge:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  revenue: {
    icon:   Banknote,
    color:  "text-emerald-600 dark:text-emerald-400",
    bg:     "bg-emerald-500/10",
    accent: "#22c55e",
    border: "border-l-emerald-500",
    badge:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  sales: {
    icon:   ShoppingBag,
    color:  "text-amber-600 dark:text-amber-400",
    bg:     "bg-amber-500/10",
    accent: "#f59e0b",
    border: "border-l-amber-500",
    badge:  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

const COMPOSITE_STYLE = {
  icon:   Sparkles,
  color:  "text-rose-600 dark:text-rose-400",
  bg:     "bg-rose-500/10",
  border: "border-l-rose-500",
  badge:  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

// ─── Период ───────────────────────────────────────────────────

type PeriodType = "day" | "week" | "month";

const MONTH_NAMES = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

function getPeriodRange(type: PeriodType, offset: number) {
  const now = new Date();
  if (type === "day") {
    const d = addDays(now, offset);
    return {
      from:  toDateStr(d),
      to:    toDateStr(d),
      label: d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
    };
  }
  if (type === "week") {
    const dow    = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = addDays(now, -dow + offset * 7);
    const sunday = addDays(monday, 6);
    return {
      from:  toDateStr(monday),
      to:    toDateStr(sunday),
      label: `${monday.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} — ${sunday.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}`,
    };
  }
  const d    = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from:  toDateStr(d),
    to:    toDateStr(last),
    label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
  };
}

// ─── DataBag ──────────────────────────────────────────────────

interface DataBag {
  calls:              Record<string, number>;
  appointments:       Record<string, number>;
  revenue:            Record<string, number>;
  sales:              Record<string, number>;
  callsDaily?:        any[];
  appointmentsDaily?: any[];
  revenueDaily?:      any[];
}

function extractBag(
  calls?:   StatsResponse | null,
  appts?:   AppointmentStatsResponse | null,
  revenue?: PaymentStatsResponse | null,
): DataBag {
  const c = calls?.operators["total"];
  return {
    calls: {
      incoming:       c?.incoming       ?? 0,
      outgoing:       c?.outgoing       ?? 0,
      missed:         c?.missed         ?? 0,
      total:          c?.total          ?? 0,
      avg_duration:   c?.avg_duration   ?? 0,
      callback_count: c?.callback_count ?? 0,
      // API отдаёт уже в процентах (0-100), нормализуем в 0-1 для formatValue
      callback_pct:   (c?.callback_pct  ?? 0) / 100,
    },
    appointments: {
      total:        appts?.total.total        ?? 0,
      visits:       appts?.total.visits       ?? 0,
      noshow:       appts?.total.noshow       ?? 0,
      cancels:      appts?.total.cancels      ?? 0,
      new_patients: appts?.total.new_patients ?? 0,
      visit_pct:    (appts?.total.visit_pct   ?? 0) / 100,
      noshow_pct:   (appts?.total.noshow_pct  ?? 0) / 100,
    },
    revenue: {
      total_paid:  revenue?.total_paid  ?? 0,
      count:       revenue?.count       ?? 0,
      by_cash:     revenue?.by_cash     ?? 0,
      by_card:     revenue?.by_card     ?? 0,
      by_cashless: revenue?.by_cashless ?? 0,
    },
    sales: {},
  };
}

// ─── Мини-график ──────────────────────────────────────────────

function MiniChart({ data, metric, chartType, color }: {
  data:      any[];
  metric:    string;
  chartType: "bar" | "line" | "area";
  color:     string;
}) {
  if (!data || data.length === 0) return (
    <div className="h-14 flex items-center justify-center text-[10px] text-muted-foreground/50">нет данных</div>
  );

  const tooltipStyle = {
    fontSize: 10, borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--card)",
  };

  return (
    <ResponsiveContainer width="100%" height={56}>
      {chartType === "bar" ? (
        <BarChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <Bar dataKey={metric} fill={color} opacity={0.85} radius={[2,2,0,0]} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={() => ""} formatter={(v: number) => [v, ""]} />
        </BarChart>
      ) : chartType === "area" ? (
        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={`ag-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={metric} stroke={color} strokeWidth={1.5}
            fill={`url(#ag-${metric})`} dot={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={() => ""} formatter={(v: number) => [v, ""]} />
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <Line type="monotone" dataKey={metric} stroke={color} strokeWidth={2} dot={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={() => ""} formatter={(v: number) => [v, ""]} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

// ─── Карточка виджета ─────────────────────────────────────────

function WidgetCard({
  widget, bag, isEdit, onEdit, onDelete, dragProps,
}: {
  widget:    Widget;
  bag:       DataBag;
  isEdit:    boolean;
  onEdit:    () => void;
  onDelete:  () => void;
  dragProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  // Определяем стиль
  const isComposite = widget.config.kind === "composite";
  const source = isComposite ? null : (widget.config as SimpleWidgetConfig).source;
  const style  = source ? SOURCE_STYLE[source] : COMPOSITE_STYLE;
  const Icon   = style.icon;

  // Значение
  let value: number | null = null;
  let fmt = "number";

  if (!isComposite) {
    const cfg = widget.config as SimpleWidgetConfig;
    value = bag[cfg.source]?.[cfg.metric] ?? null;
    fmt   = getMetricFormat(cfg.source, cfg.metric);
  } else {
    const cfg = widget.config as CompositeWidgetConfig;
    value = computeComposite(cfg.formula, bag);
    fmt   = cfg.formula.format;
  }

  const displayValue = value !== null ? formatValue(value, fmt as any) : "—";

  // Данные для мини-графика
  const chartData = () => {
    if (isComposite) return [];
    const s = (widget.config as SimpleWidgetConfig).source;
    if (s === "calls")        return bag.callsDaily        ?? [];
    if (s === "appointments") return bag.appointmentsDaily ?? [];
    if (s === "revenue")      return bag.revenueDaily      ?? [];
    return [];
  };

  const chartMetric = isComposite ? "" : (widget.config as SimpleWidgetConfig).metric;
  const accentColor = source ? SOURCE_STYLE[source].accent : "#f43f5e";

  const colSpan = widget.size === "large" ? "col-span-3"
    : widget.size === "medium" ? "col-span-2" : "col-span-1";

  // Источник для бейджа
  const sourceLabel = source ? {
    calls: "Звонки", appointments: "Записи", revenue: "Выручка", sales: "Услуги",
  }[source] : "Формула";

  return (
    <div className={`${colSpan} relative group rounded-2xl border border-border border-l-[3px] ${
      style.border
    } bg-card overflow-hidden transition-shadow hover:shadow-md`}>

      {/* Оверлей редактирования */}
      {isEdit && (
        <div className="absolute inset-0 z-20 rounded-2xl bg-background/70 backdrop-blur-[2px]
          flex items-center justify-center gap-2
          opacity-0 group-hover:opacity-100 transition-all duration-150">
          <div {...dragProps}
            className="h-9 w-9 rounded-xl border border-border bg-card shadow-sm
              flex items-center justify-center cursor-grab active:cursor-grabbing
              hover:bg-muted/60 transition-colors"
            title="Перетащить">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <button onClick={onEdit}
            className="h-9 w-9 rounded-xl border border-border bg-card shadow-sm
              flex items-center justify-center hover:bg-muted/60 transition-colors"
            title="Редактировать">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={onDelete}
            className="h-9 w-9 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 shadow-sm
              flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
            title="Удалить">
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </button>
        </div>
      )}

      <div className="p-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
              <Icon className={`h-3.5 w-3.5 ${style.color}`} />
            </div>
            <span className="text-xs font-medium text-muted-foreground truncate">{widget.title}</span>
          </div>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
            isComposite ? COMPOSITE_STYLE.badge : SOURCE_STYLE[source!].badge
          }`}>
            {sourceLabel}
          </span>
        </div>

        {/* Значение */}
        <div className={`text-2xl font-bold tracking-tight ${
          isComposite ? COMPOSITE_STYLE.color
            : SOURCE_STYLE[source!].color
        }`}>
          {displayValue}
        </div>

        {/* Мини-график */}
        {widget.mode === "chart" && !isComposite && (
          <div className="mt-3">
            <MiniChart
              data={chartData()}
              metric={chartMetric}
              chartType={widget.chartType ?? "bar"}
              color={accentColor}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────

interface HomeDashboardProps {
  onNavigate: (s: Section) => void;
}

export function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const [config, setConfig]         = useState<DashboardConfig | null>(null);
  const [editMode, setEditMode]     = useState(false);
  const [editorWidget, setEditorWidget] = useState<Widget | null | "new">(null);

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [offset, setOffset]         = useState(0);
  const { from: dateFrom, to: dateTo, label: dateLabel } = getPeriodRange(periodType, offset);

  const [bag,     setBag]     = useState<DataBag>({ calls: {}, appointments: {}, revenue: {}, sales: {} });
  const [loading, setLoading] = useState(true);

  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => { setConfig(loadDashboard()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      fetchStats(dateFrom, dateTo),
      fetchAppointmentStats(dateFrom, dateTo),
      fetchPaymentStats(dateFrom, dateTo),
      periodType === "day" ? fetchHourly(dateFrom, dateTo, 60) : fetchDaily(dateFrom, dateTo),
      periodType !== "day" ? fetchAppointmentDaily(dateFrom, dateTo) : Promise.resolve(null),
      periodType !== "day" ? fetchPaymentDaily(dateFrom, dateTo)     : Promise.resolve(null),
    ]);

    const c  = results[0].status === "fulfilled" ? results[0].value as StatsResponse : null;
    const a  = results[1].status === "fulfilled" ? results[1].value as AppointmentStatsResponse : null;
    const r  = results[2].status === "fulfilled" ? results[2].value as PaymentStatsResponse : null;
    const cd = results[3].status === "fulfilled" ? results[3].value as HourlyResponse | DailyResponse | null : null;
    const ad = results[4].status === "fulfilled" ? results[4].value as AppointmentDailyResponse | null : null;
    const rd = results[5].status === "fulfilled" ? results[5].value as PaymentDailyResponse | null : null;

    const base = extractBag(c, a, r);
    // Унифицируем: hourly.slots или daily.days
    base.callsDaily        = (cd as any)?.slots ?? (cd as any)?.days ?? [];
    base.appointmentsDaily = ad?.days ?? [];
    base.revenueDaily      = rd?.days ?? [];

    setBag(base);
    setLoading(false);
  }, [dateFrom, dateTo, periodType]);

  useEffect(() => { load(); }, [load]);

  function handlePeriodType(t: PeriodType) { setPeriodType(t); setOffset(0); }

  function saveConfig(next: DashboardConfig) { setConfig(next); saveDashboard(next); }

  function handleSaveWidget(w: Widget) {
    if (!config) return;
    const exists = config.widgets.find(x => x.id === w.id);
    const widgets = exists
      ? config.widgets.map(x => x.id === w.id ? w : x)
      : [...config.widgets, w];
    saveConfig({ ...config, widgets });
    setEditorWidget(null);
  }

  function handleDelete(id: string) {
    if (!config) return;
    saveConfig({ ...config, widgets: config.widgets.filter(w => w.id !== id) });
  }

  function handleReset() { saveConfig(DEFAULT_DASHBOARD); }

  // Drag & drop
  function onDragStart(i: number) { dragIndex.current = i; }
  function onDragEnter(i: number) { setDragOver(i); }
  function onDrop(i: number) {
    if (!config || dragIndex.current === null || dragIndex.current === i) {
      setDragOver(null); return;
    }
    const ws = [...config.widgets];
    const [moved] = ws.splice(dragIndex.current, 1);
    ws.splice(i, 0, moved);
    saveConfig({ ...config, widgets: ws });
    dragIndex.current = null;
    setDragOver(null);
  }
  function onDragEnd() { dragIndex.current = null; setDragOver(null); }

  if (!config) return null;

  return (
    <div className="space-y-5">

      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Сводка</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Период */}
          <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
            {(["day", "week", "month"] as PeriodType[]).map(t => (
              <button key={t} onClick={() => handlePeriodType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  periodType === t
                    ? "bg-background border border-border shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {t === "day" ? "День" : t === "week" ? "Неделя" : "Месяц"}
              </button>
            ))}
          </div>

          {/* Навигация */}
          <div className="flex items-center gap-1">
            <button onClick={() => setOffset(o => o - 1)}
              className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted/40 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}
              className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted/40 disabled:opacity-30 transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Настроить */}
          <button onClick={() => setEditMode(e => !e)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
              editMode
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}>
            <Settings2 className="h-3.5 w-3.5" />
            {editMode ? "Готово" : "Настроить"}
          </button>
        </div>
      </div>

      {/* Панель редактирования */}
      {editMode && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 px-5 py-3">
          <div className="flex-1">
            <p className="text-xs font-medium">Режим редактирования</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Наведите на виджет → появятся кнопки. Перетащите за <GripVertical className="h-3 w-3 inline" /> чтобы изменить порядок.
            </p>
          </div>
          <button onClick={() => setEditorWidget("new")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap">
            <Plus className="h-3.5 w-3.5" /> Добавить виджет
          </button>
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted/40 transition-colors whitespace-nowrap">
            <RotateCcw className="h-3.5 w-3.5" /> Сбросить
          </button>
        </div>
      )}

      {/* Сетка */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`${
              i % 3 === 0 ? "col-span-1" : i % 3 === 1 ? "col-span-1" : "col-span-1"
            } h-28 rounded-2xl border border-border bg-muted/20 animate-pulse`} />
          ))}
        </div>
      ) : config.widgets.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-12 w-12 rounded-2xl bg-muted/40 flex items-center justify-center">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Нет виджетов</p>
            <p className="text-xs text-muted-foreground mt-1">Добавьте показатели которые хотите видеть</p>
          </div>
          <button onClick={() => { setEditMode(true); setEditorWidget("new"); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> Добавить виджет
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {config.widgets.map((widget, i) => (
            <div
              key={widget.id}
              draggable={editMode}
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(i)}
              onDragEnd={onDragEnd}
              className={`transition-all duration-150 ${
                dragOver === i && dragIndex.current !== i
                  ? "scale-95 opacity-50" : ""
              }`}
            >
              <WidgetCard
                widget={widget}
                bag={bag}
                isEdit={editMode}
                onEdit={() => setEditorWidget(widget)}
                onDelete={() => handleDelete(widget.id)}
                dragProps={{
                  draggable: true,
                  onDragStart: (e: React.DragEvent) => { e.stopPropagation(); onDragStart(i); },
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Редактор */}
      {editorWidget && (
        <WidgetEditor
          initial={editorWidget === "new" ? undefined : editorWidget as Widget}
          onSave={handleSaveWidget}
          onClose={() => setEditorWidget(null)}
        />
      )}
    </div>
  );
}
