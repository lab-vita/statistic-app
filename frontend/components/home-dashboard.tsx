"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Widget, DashboardConfig,
  loadDashboard, saveDashboard,
  computeComposite, formatValue, getMetricFormat, getMetricLabel,
  SimpleWidgetConfig, CompositeWidgetConfig, DataSource,
  DEFAULT_DASHBOARD,
} from "@/lib/dashboard";
import { WidgetEditor } from "@/components/widget-editor";
import {
  fetchStats, fetchAppointmentStats, fetchPaymentStats,
  fetchHourly, fetchDaily, fetchAppointmentDaily, fetchPaymentDaily,
  toDateStr, addDays, formatDuration,
  StatsResponse, AppointmentStatsResponse, PaymentStatsResponse,
  HourlyResponse, DailyResponse, AppointmentDailyResponse, PaymentDailyResponse,
} from "@/lib/api";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, Settings2, Trash2, GripVertical,
  ChevronLeft, ChevronRight, RotateCcw, TrendingUp, TrendingDown,
} from "lucide-react";
import { Section } from "@/components/sidebar";

// ─── Типы периода ────────────────────────────────────────────

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
    const dow     = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday  = addDays(now, -dow + offset * 7);
    const sunday  = addDays(monday, 6);
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

// ─── DataBag — все числа из API ───────────────────────────────

interface DataBag {
  calls:        Record<string, number>;
  appointments: Record<string, number>;
  revenue:      Record<string, number>;
  sales:        Record<string, number>;
  callsDaily?:      any[];
  appointmentsDaily?: any[];
  revenueDaily?:    any[];
}

function extractBag(
  calls?:   StatsResponse | null,
  appts?:   AppointmentStatsResponse | null,
  revenue?: PaymentStatsResponse | null,
): DataBag {
  const c = calls?.operators["total"];
  return {
    calls: {
      incoming:       c?.incoming        ?? 0,
      outgoing:       c?.outgoing        ?? 0,
      missed:         c?.missed          ?? 0,
      total:          c?.total           ?? 0,
      avg_duration:   c?.avg_duration    ?? 0,
      callback_count: c?.callback_count  ?? 0,
      callback_pct:   (c?.callback_pct ?? 0) / 100,
    },
    appointments: {
      total:        appts?.total.total        ?? 0,
      visits:       appts?.total.visits       ?? 0,
      noshow:       appts?.total.noshow       ?? 0,
      cancels:      appts?.total.cancels      ?? 0,
      new_patients: appts?.total.new_patients ?? 0,
      visit_pct:    (appts?.total.visit_pct  ?? 0) / 100,
      noshow_pct:   (appts?.total.noshow_pct ?? 0) / 100,
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

// ─── Мини-график ─────────────────────────────────────────────

function MiniChart({ data, metric, chartType }: {
  data: any[]; metric: string; chartType: "bar" | "line" | "area";
}) {
  if (!data || data.length === 0) return null;
  const color = "#6366f1";

  return (
    <ResponsiveContainer width="100%" height={52}>
      {chartType === "bar" ? (
        <BarChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <Bar dataKey={metric} fill={color} opacity={0.8} radius={[2,2,0,0]} />
          <Tooltip
            contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)" }}
            labelFormatter={() => ""}
            formatter={(v: number) => [v]}
          />
        </BarChart>
      ) : chartType === "area" ? (
        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={metric} stroke={color} strokeWidth={1.5} fill="url(#mg)" dot={false} />
          <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)" }} labelFormatter={() => ""} formatter={(v: number) => [v]} />
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <Line type="monotone" dataKey={metric} stroke={color} strokeWidth={1.5} dot={false} />
          <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)" }} labelFormatter={() => ""} formatter={(v: number) => [v]} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

// ─── Один виджет ─────────────────────────────────────────────

function WidgetCard({
  widget, bag, isEdit,
  onEdit, onDelete,
  dragHandleProps,
}: {
  widget:          Widget;
  bag:             DataBag;
  isEdit:          boolean;
  onEdit:          () => void;
  onDelete:        () => void;
  dragHandleProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  // Получаем значение
  let value: number | null = null;
  let format = "number";
  let deltaDir: "up" | "down" | null = null;
  let deltaPct: number | null = null;

  if (widget.config.kind === "simple") {
    const cfg = widget.config as SimpleWidgetConfig;
    value  = bag[cfg.source as DataSource]?.[cfg.metric] ?? null;
    format = getMetricFormat(cfg.source, cfg.metric);

    // Дельта из API (если есть)
    // calls
    // appointments
  } else {
    const cfg = widget.config as CompositeWidgetConfig;
    value  = computeComposite(cfg.formula, bag);
    format = cfg.formula.format;
  }

  const displayValue = value !== null ? formatValue(value, format as any) : "—";

  // Данные для мини-графика
  const chartData = (): any[] => {
    if (widget.config.kind !== "simple") return [];
    const cfg = widget.config as SimpleWidgetConfig;
    if (cfg.source === "calls") return bag.callsDaily ?? [];
    if (cfg.source === "appointments") return bag.appointmentsDaily ?? [];
    if (cfg.source === "revenue") return bag.revenueDaily ?? [];
    return [];
  };

  const colSpan = widget.size === "large" ? "col-span-3" : widget.size === "medium" ? "col-span-2" : "col-span-1";

  return (
    <div className={`${colSpan} group relative rounded-xl border border-border bg-card overflow-hidden`}>
      {/* Drag handle + edit controls */}
      {isEdit && (
        <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
          <div {...dragHandleProps} className="h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-muted/50">
            <GripVertical className="h-4 w-4" />
          </div>
          <button onClick={onEdit} className="h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted/50 transition-colors">
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="h-8 w-8 rounded-lg border border-red-500/30 bg-red-500/5 flex items-center justify-center hover:bg-red-500/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </button>
        </div>
      )}

      <div className="p-4">
        <div className="text-[11px] text-muted-foreground mb-2 truncate">{widget.title}</div>

        {widget.mode === "number" && (
          <div className="text-2xl font-semibold">{displayValue}</div>
        )}

        {widget.mode === "card" && (
          <div>
            <div className="text-2xl font-semibold">{displayValue}</div>
            {deltaPct !== null && deltaDir && (
              <div className={`flex items-center gap-0.5 mt-1 text-xs ${
                deltaDir === "up" ? "text-emerald-500" : "text-red-500"
              }`}>
                {deltaDir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {deltaDir === "up" ? "+" : "−"}{deltaPct}%
              </div>
            )}
          </div>
        )}

        {widget.mode === "chart" && (
          <div>
            <div className="text-2xl font-semibold mb-2">{displayValue}</div>
            {widget.config.kind === "simple" && (
              <MiniChart
                data={chartData()}
                metric={(widget.config as SimpleWidgetConfig).metric}
                chartType={widget.chartType ?? "bar"}
              />
            )}
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
  const [config, setConfig]       = useState<DashboardConfig | null>(null);
  const [editMode, setEditMode]   = useState(false);
  const [editorWidget, setEditorWidget] = useState<Widget | null | "new">(null);

  // Период
  const [periodType, setPeriodType] = useState<PeriodType>("day");
  const [offset, setOffset]         = useState(0);
  const { from: dateFrom, to: dateTo, label: dateLabel } = getPeriodRange(periodType, offset);

  // Данные
  const [bag, setBag] = useState<DataBag>({
    calls: {}, appointments: {}, revenue: {}, sales: {},
  });
  const [loading, setLoading] = useState(true);

  // Drag & drop
  const dragIndex  = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Загружаем конфиг из localStorage
  useEffect(() => {
    setConfig(loadDashboard());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [calls, appts, rev, hourly, daily, apptDaily, revDaily] = await Promise.allSettled([
      fetchStats(dateFrom, dateTo),
      fetchAppointmentStats(dateFrom, dateTo),
      fetchPaymentStats(dateFrom, dateTo),
      periodType === "day" ? fetchHourly(dateFrom, dateTo, 60) : Promise.resolve(null),
      periodType !== "day" ? fetchDaily(dateFrom, dateTo)      : Promise.resolve(null),
      periodType !== "day" ? fetchAppointmentDaily(dateFrom, dateTo) : Promise.resolve(null),
      periodType !== "day" ? fetchPaymentDaily(dateFrom, dateTo)     : Promise.resolve(null),
    ]);

    const c  = calls.status  === "fulfilled" ? calls.value  as StatsResponse            : null;
    const a  = appts.status  === "fulfilled" ? appts.value  as AppointmentStatsResponse  : null;
    const r  = rev.status    === "fulfilled" ? rev.value    as PaymentStatsResponse      : null;
    const h  = hourly.status === "fulfilled" ? hourly.value as HourlyResponse | null     : null;
    const d  = daily.status  === "fulfilled" ? daily.value  as DailyResponse | null      : null;
    const ad = apptDaily.status === "fulfilled" ? apptDaily.value as AppointmentDailyResponse | null : null;
    const rd = revDaily.status  === "fulfilled" ? revDaily.value  as PaymentDailyResponse | null     : null;

    const base = extractBag(c, a, r);
    base.callsDaily        = h?.slots  ?? d?.days  ?? [];
    base.appointmentsDaily = ad?.days ?? [];
    base.revenueDaily      = rd?.days ?? [];

    setBag(base);
    setLoading(false);
  }, [dateFrom, dateTo, periodType]);

  useEffect(() => { load(); }, [load]);

  function handlePeriodType(t: PeriodType) {
    setPeriodType(t);
    setOffset(0);
  }

  // ─── Сохранение конфига ────────────────────────────────────

  function saveConfig(next: DashboardConfig) {
    setConfig(next);
    saveDashboard(next);
  }

  function handleSaveWidget(w: Widget) {
    if (!config) return;
    const exists = config.widgets.find(x => x.id === w.id);
    const widgets = exists
      ? config.widgets.map(x => x.id === w.id ? w : x)
      : [...config.widgets, w];
    saveConfig({ ...config, widgets });
    setEditorWidget(null);
  }

  function handleDeleteWidget(id: string) {
    if (!config) return;
    saveConfig({ ...config, widgets: config.widgets.filter(w => w.id !== id) });
  }

  function handleReset() {
    saveConfig(DEFAULT_DASHBOARD);
  }

  // ─── Drag & drop ───────────────────────────────────────────

  function handleDragStart(i: number) {
    dragIndex.current = i;
  }

  function handleDragEnter(i: number) {
    setDragOver(i);
  }

  function handleDrop(i: number) {
    if (!config || dragIndex.current === null || dragIndex.current === i) {
      setDragOver(null);
      return;
    }
    const widgets = [...config.widgets];
    const [moved] = widgets.splice(dragIndex.current, 1);
    widgets.splice(i, 0, moved);
    saveConfig({ ...config, widgets });
    dragIndex.current = null;
    setDragOver(null);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOver(null);
  }

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
          <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {(["day", "week", "month"] as PeriodType[]).map(t => (
              <button key={t} onClick={() => handlePeriodType(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  periodType === t
                    ? "bg-background border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {t === "day" ? "День" : t === "week" ? "Неделя" : "Месяц"}
              </button>
            ))}
          </div>

          {/* Навигация */}
          <div className="flex items-center gap-1">
            <button onClick={() => setOffset(o => o - 1)}
              className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}
              className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/40 disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Режим редактирования */}
          <button
            onClick={() => setEditMode(e => !e)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              editMode
                ? "border-foreground/40 bg-muted/60 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}>
            <Settings2 className="h-3.5 w-3.5" />
            {editMode ? "Готово" : "Настроить"}
          </button>
        </div>
      </div>

      {/* Панель редактирования */}
      {editMode && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3">
          <span className="text-xs text-muted-foreground flex-1">
            Перетащите виджеты чтобы изменить порядок. Наведите на виджет для управления.
          </span>
          <button onClick={() => setEditorWidget("new")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity">
            <Plus className="h-3.5 w-3.5" />Добавить виджет
          </button>
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/30 transition-colors">
            <RotateCcw className="h-3.5 w-3.5" />Сбросить
          </button>
        </div>
      )}

      {/* Сетка виджетов */}
      <div className="grid grid-cols-3 gap-3">
        {loading
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="col-span-1 h-24 rounded-xl border border-border bg-card animate-pulse" />
            ))
          : config.widgets.map((widget, i) => (
              <div
                key={widget.id}
                draggable={editMode}
                onDragStart={() => handleDragStart(i)}
                onDragEnter={() => handleDragEnter(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                className={`transition-all duration-150 ${
                  dragOver === i && dragIndex.current !== i ? "scale-[0.97] opacity-60" : ""
                }`}
              >
                <WidgetCard
                  widget={widget}
                  bag={bag}
                  isEdit={editMode}
                  onEdit={() => setEditorWidget(widget)}
                  onDelete={() => handleDeleteWidget(widget.id)}
                  dragHandleProps={{
                    draggable: true,
                    onDragStart: (e: React.DragEvent) => {
                      e.stopPropagation();
                      handleDragStart(i);
                    },
                  }}
                />
              </div>
            ))
        }

        {/* Кнопка добавить (если не в режиме редактирования) */}
        {!editMode && config.widgets.length === 0 && (
          <div className="col-span-3 rounded-xl border border-dashed border-border flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-muted-foreground">Нет виджетов</p>
            <button onClick={() => { setEditMode(true); setEditorWidget("new"); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90">
              <Plus className="h-4 w-4" />Добавить виджет
            </button>
          </div>
        )}
      </div>

      {/* Редактор виджета */}
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
