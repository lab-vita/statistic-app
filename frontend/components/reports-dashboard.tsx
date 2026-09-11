"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchStats, fetchDaily, fetchAppointmentStats, fetchAppointmentDaily,
  fetchOperators, fetchAdmins,
  toDateStr, addDays, formatDuration,
  Operator, Admin, DeltaDir,
  StatsResponse, DailyResponse,
  AppointmentStatsResponse, AppointmentDailyResponse,
} from "@/lib/api";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

// ─── Типы ────────────────────────────────────────────────────

type Source    = "calls" | "appointments";
type Breakdown = "day" | "week" | "month";
type ChartType = "bar" | "line";

type CallMetric = "incoming" | "outgoing" | "missed" | "total";
type ApptMetric = "total" | "visits" | "noshow" | "new_patients";

interface ReportConfig {
  source:    Source;
  dateFrom:  string;
  dateTo:    string;
  breakdown: Breakdown;
  chartType: ChartType;
  // Звонки
  callMetrics:  CallMetric[];
  operatorId:   string | null;
  // Записи
  apptMetrics:  ApptMetric[];
  adminSurname: string | null;
}

interface Preset {
  id:     string;
  label:  string;
  config: Partial<ReportConfig>;
}

// ─── Пресеты ─────────────────────────────────────────────────

const PRESETS: Preset[] = [
  {
    id: "calls_week",
    label: "Звонки за неделю",
    config: {
      source: "calls", breakdown: "day", chartType: "bar",
      callMetrics: ["incoming", "missed"],
      dateFrom: toDateStr(addDays(new Date(), -7)),
      dateTo:   toDateStr(addDays(new Date(), -1)),
    },
  },
  {
    id: "calls_month",
    label: "Операторы за месяц",
    config: {
      source: "calls", breakdown: "day", chartType: "line",
      callMetrics: ["incoming"],
      dateFrom: toDateStr(addDays(new Date(), -30)),
      dateTo:   toDateStr(addDays(new Date(), -1)),
    },
  },
  {
    id: "calls_missed",
    label: "Пропущенные и перезвоны",
    config: {
      source: "calls", breakdown: "day", chartType: "bar",
      callMetrics: ["missed"],
      dateFrom: toDateStr(addDays(new Date(), -14)),
      dateTo:   toDateStr(addDays(new Date(), -1)),
    },
  },
  {
    id: "appt_week",
    label: "Явка за неделю",
    config: {
      source: "appointments", breakdown: "day", chartType: "bar",
      apptMetrics: ["total", "visits", "noshow"],
      dateFrom: toDateStr(addDays(new Date(), -7)),
      dateTo:   toDateStr(addDays(new Date(), -1)),
    },
  },
  {
    id: "appt_month",
    label: "Записи за месяц",
    config: {
      source: "appointments", breakdown: "day", chartType: "line",
      apptMetrics: ["total", "visits"],
      dateFrom: toDateStr(addDays(new Date(), -30)),
      dateTo:   toDateStr(addDays(new Date(), -1)),
    },
  },
  {
    id: "appt_new",
    label: "Новые пациенты",
    config: {
      source: "appointments", breakdown: "day", chartType: "bar",
      apptMetrics: ["new_patients", "total"],
      dateFrom: toDateStr(addDays(new Date(), -30)),
      dateTo:   toDateStr(addDays(new Date(), -1)),
    },
  },
  {
    id: "summary_month",
    label: "Месячный обзор",
    config: {
      source: "calls", breakdown: "day", chartType: "bar",
      callMetrics: ["incoming", "missed"],
      dateFrom: toDateStr(addDays(new Date(), -30)),
      dateTo:   toDateStr(addDays(new Date(), -1)),
    },
  },
  {
    id: "summary_quarter",
    label: "Квартальный обзор",
    config: {
      source: "calls", breakdown: "week", chartType: "line",
      callMetrics: ["incoming", "outgoing", "missed"],
      dateFrom: toDateStr(addDays(new Date(), -90)),
      dateTo:   toDateStr(addDays(new Date(), -1)),
    },
  },
];

// ─── Вспомогательные константы ───────────────────────────────

const CALL_METRIC_LABELS: Record<CallMetric, string> = {
  incoming: "Входящие",
  outgoing: "Исходящие",
  missed:   "Пропущенные",
  total:    "Всего",
};

const APPT_METRIC_LABELS: Record<ApptMetric, string> = {
  total:        "Всего записей",
  visits:       "Явки",
  noshow:       "Неявки",
  new_patients: "Новые пациенты",
};

const METRIC_COLORS: Record<string, string> = {
  incoming:     "#22c55e",
  outgoing:     "#3b82f6",
  missed:       "#ef4444",
  total:        "#6366f1",
  visits:       "#22c55e",
  noshow:       "#ef4444",
  new_patients: "#a855f7",
};

const BREAKDOWN_LABELS: Record<Breakdown, string> = {
  day:   "По дням",
  week:  "По неделям",
  month: "По месяцам",
};

// ─── Компонент дельты ────────────────────────────────────────

function DeltaBadge({ pct, dir, invert }: { pct?: number | null; dir?: DeltaDir; invert?: boolean }) {
  if (!dir || dir === "flat" || pct == null) return null;
  const isGood = invert ? dir === "down" : dir === "up";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isGood ? "text-emerald-500" : "text-red-500"}`}>
      {dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

// ─── Агрегация данных по неделям/месяцам ─────────────────────

function aggregateDays(days: any[], breakdown: Breakdown): any[] {
  if (breakdown === "day") return days;

  const groups: Record<string, any> = {};
  for (const d of days) {
    const dt = new Date(d.date);
    let key: string;
    if (breakdown === "week") {
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - dt.getDay() + 1);
      key = toDateStr(monday);
    } else {
      key = d.date.slice(0, 7);
    }
    if (!groups[key]) {
      groups[key] = { date: key, incoming: 0, outgoing: 0, missed: 0, total: 0,
                      visits: 0, noshow: 0, new_patients: 0 };
    }
    for (const k of ["incoming","outgoing","missed","total","visits","noshow","new_patients"]) {
      groups[key][k] = (groups[key][k] || 0) + (d[k] || 0);
    }
  }
  return Object.values(groups);
}

function formatDateTick(d: string, breakdown: Breakdown): string {
  const dt = new Date(d);
  if (breakdown === "month") return dt.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
  if (breakdown === "week")  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ─── Основной компонент ──────────────────────────────────────

const DEFAULT_CONFIG: ReportConfig = {
  source:       "calls",
  dateFrom:     toDateStr(addDays(new Date(), -30)),
  dateTo:       toDateStr(addDays(new Date(), -1)),
  breakdown:    "day",
  chartType:    "bar",
  callMetrics:  ["incoming", "missed"],
  operatorId:   null,
  apptMetrics:  ["total", "visits"],
  adminSurname: null,
};

export function ReportsDashboard() {
  const [config, setConfig]         = useState<ReportConfig>(DEFAULT_CONFIG);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const [operators, setOperators]   = useState<Operator[]>([]);
  const [admins, setAdmins]         = useState<Admin[]>([]);

  const [callsData, setCallsData]         = useState<StatsResponse | null>(null);
  const [callsDaily, setCallsDaily]       = useState<DailyResponse | null>(null);
  const [apptData, setApptData]           = useState<AppointmentStatsResponse | null>(null);
  const [apptDaily, setApptDaily]         = useState<AppointmentDailyResponse | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOperators().then(r => setOperators(r.operators)).catch(() => {});
    fetchAdmins().then(r => setAdmins(r.admins)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (config.source === "calls") {
        const [s, d] = await Promise.all([
          fetchStats(config.dateFrom, config.dateTo, config.operatorId ?? undefined),
          fetchDaily(config.dateFrom, config.dateTo, config.operatorId ?? undefined),
        ]);
        setCallsData(s); setCallsDaily(d);
        setApptData(null); setApptDaily(null);
      } else {
        const [s, d] = await Promise.all([
          fetchAppointmentStats(config.dateFrom, config.dateTo, config.adminSurname ?? undefined),
          fetchAppointmentDaily(config.dateFrom, config.dateTo, config.adminSurname ?? undefined),
        ]);
        setApptData(s); setApptDaily(d);
        setCallsData(null); setCallsDaily(null);
      }
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(preset: Preset) {
    setConfig(prev => ({ ...DEFAULT_CONFIG, ...prev, ...preset.config }));
    setActivePreset(preset.id);
  }

  function updateConfig(patch: Partial<ReportConfig>) {
    setConfig(prev => ({ ...prev, ...patch }));
    setActivePreset(null);
  }

  function toggleCallMetric(m: CallMetric) {
    setConfig(prev => ({
      ...prev,
      callMetrics: prev.callMetrics.includes(m)
        ? prev.callMetrics.filter(x => x !== m)
        : [...prev.callMetrics, m],
    }));
    setActivePreset(null);
  }

  function toggleApptMetric(m: ApptMetric) {
    setConfig(prev => ({
      ...prev,
      apptMetrics: prev.apptMetrics.includes(m)
        ? prev.apptMetrics.filter(x => x !== m)
        : [...prev.apptMetrics, m],
    }));
    setActivePreset(null);
  }

  // Данные для графика
  const rawDays = config.source === "calls"
    ? (callsDaily?.days ?? [])
    : (apptDaily?.days ?? []);
  const chartData = aggregateDays(rawDays, config.breakdown);
  const metrics   = config.source === "calls" ? config.callMetrics : config.apptMetrics;

  // Сводные метрики (для таблицы)
  const summaryStats = config.source === "calls"
    ? callsData?.operators[config.operatorId ?? "total"]
    : apptData?.total;

  const prevLabel = (() => {
    const span = Math.round((new Date(config.dateTo).getTime() - new Date(config.dateFrom).getTime()) / 86400000) + 1;
    return `пред. ${span} дн.`;
  })();

  const ChartComponent = config.chartType === "line" ? LineChart : BarChart;

  const tickInterval = chartData.length > 60 ? 6 : chartData.length > 30 ? 2 : 0;

  return (
    <div className="space-y-5">

      {/* Пресеты */}
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Быстрые отчёты</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activePreset === p.id
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Настройки */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-4 items-end">

        {/* Источник */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Источник</div>
          <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {(["calls","appointments"] as Source[]).map(s => (
              <button key={s} onClick={() => updateConfig({ source: s })}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  config.source === s
                    ? "bg-background border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {s === "calls" ? "Звонки" : "Записи"}
              </button>
            ))}
          </div>
        </div>

        {/* Период */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Период</div>
          <div className="flex items-center gap-1.5">
            <input type="date" value={config.dateFrom}
              onChange={e => updateConfig({ dateFrom: e.target.value })}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-foreground/40" />
            <span className="text-muted-foreground text-xs">—</span>
            <input type="date" value={config.dateTo}
              onChange={e => updateConfig({ dateTo: e.target.value })}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-foreground/40" />
          </div>
        </div>

        {/* Разбивка */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Разбивка</div>
          <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {(["day","week","month"] as Breakdown[]).map(b => (
              <button key={b} onClick={() => updateConfig({ breakdown: b })}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  config.breakdown === b
                    ? "bg-background border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {BREAKDOWN_LABELS[b]}
              </button>
            ))}
          </div>
        </div>

        {/* Тип графика */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">График</div>
          <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {(["bar","line"] as ChartType[]).map(t => (
              <button key={t} onClick={() => updateConfig({ chartType: t })}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  config.chartType === t
                    ? "bg-background border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {t === "bar" ? "Столбцы" : "Линии"}
              </button>
            ))}
          </div>
        </div>

        {/* Метрики — Звонки */}
        {config.source === "calls" && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Метрики</div>
            <div className="flex gap-1 flex-wrap">
              {(Object.keys(CALL_METRIC_LABELS) as CallMetric[]).map(m => (
                <button key={m} onClick={() => toggleCallMetric(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    config.callMetrics.includes(m)
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  style={config.callMetrics.includes(m) ? { background: METRIC_COLORS[m] } : {}}>
                  {CALL_METRIC_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Метрики — Записи */}
        {config.source === "appointments" && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Метрики</div>
            <div className="flex gap-1 flex-wrap">
              {(Object.keys(APPT_METRIC_LABELS) as ApptMetric[]).map(m => (
                <button key={m} onClick={() => toggleApptMetric(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    config.apptMetrics.includes(m)
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  style={config.apptMetrics.includes(m) ? { background: METRIC_COLORS[m] } : {}}>
                  {APPT_METRIC_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Фильтр по оператору */}
        {config.source === "calls" && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Оператор</div>
            <select value={config.operatorId ?? ""}
              onChange={e => updateConfig({ operatorId: e.target.value || null })}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-foreground/40 min-w-32">
              <option value="">Все</option>
              {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
          </div>
        )}

        {/* Фильтр по администратору */}
        {config.source === "appointments" && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Сотрудник</div>
            <select value={config.adminSurname ?? ""}
              onChange={e => updateConfig({ adminSurname: e.target.value || null })}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-foreground/40 min-w-32">
              <option value="">Все</option>
              {admins.map(a => <option key={a.surname} value={a.surname}>{a.surname} — {a.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* График */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium">
              {config.source === "calls" ? "Звонки" : "Записи"} · {BREAKDOWN_LABELS[config.breakdown].toLowerCase()}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(config.dateFrom).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} —{" "}
              {new Date(config.dateTo).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap justify-end">
            {metrics.map(m => (
              <span key={m} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: METRIC_COLORS[m] }} />
                {config.source === "calls" ? CALL_METRIC_LABELS[m as CallMetric] : APPT_METRIC_LABELS[m as ApptMetric]}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-64 rounded-lg bg-muted/40 animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            Нет данных за выбранный период
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            {config.chartType === "bar" ? (
              <BarChart data={chartData} barCategoryGap="30%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={d => formatDateTick(d, config.breakdown)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false} tickLine={false} interval={tickInterval} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                  labelFormatter={d => formatDateTick(d, config.breakdown)} />
                {metrics.map(m => (
                  <Bar key={m} dataKey={m} fill={METRIC_COLORS[m]} opacity={0.85}
                    radius={[2,2,0,0]}
                    name={config.source === "calls" ? CALL_METRIC_LABELS[m as CallMetric] : APPT_METRIC_LABELS[m as ApptMetric]} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={d => formatDateTick(d, config.breakdown)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false} tickLine={false} interval={tickInterval} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                  labelFormatter={d => formatDateTick(d, config.breakdown)} />
                <Legend formatter={v =>
                  <span style={{ fontSize: 11 }}>
                    {config.source === "calls" ? CALL_METRIC_LABELS[v as CallMetric] : APPT_METRIC_LABELS[v as ApptMetric]}
                  </span>} />
                {metrics.map(m => (
                  <Line key={m} type="monotone" dataKey={m} stroke={METRIC_COLORS[m]}
                    strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
                    name={m} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Сводная таблица с дельтами */}
      {summaryStats && !loading && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-medium">Сводка · сравнение с {prevLabel}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left">Метрика</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Значение</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Динамика</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {config.source === "calls" && (() => {
                  const s = summaryStats as any;
                  return [
                    { label: "Входящие",       val: s.incoming,      pct: s.incoming_delta_pct,     dir: s.incoming_delta_dir },
                    { label: "Исходящие",       val: s.outgoing,      pct: s.outgoing_delta_pct,     dir: s.outgoing_delta_dir },
                    { label: "Пропущенные",     val: s.missed,        pct: s.missed_delta_pct,       dir: s.missed_delta_dir,       inv: true },
                    { label: "Всего",           val: s.total,         pct: s.total_delta_pct,        dir: s.total_delta_dir },
                    { label: "Ср. разговор",    val: formatDuration(s.avg_duration), pct: s.avg_duration_delta_pct, dir: s.avg_duration_delta_dir },
                    { label: "% перезвонов",    val: `${s.callback_pct}%`, pct: s.callback_pct_delta_pct, dir: s.callback_pct_delta_dir },
                  ].map(row => (
                    <tr key={row.label} className="hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-3 font-medium">{row.label}</td>
                      <td className="px-5 py-3 text-right font-mono">{row.val}</td>
                      <td className="px-5 py-3 text-right">
                        <DeltaBadge pct={row.pct} dir={row.dir as DeltaDir} invert={row.inv} />
                      </td>
                    </tr>
                  ));
                })()}
                {config.source === "appointments" && (() => {
                  const s = summaryStats as any;
                  return [
                    { label: "Всего записей",   val: s.total,         pct: s.total_delta_pct,        dir: s.total_delta_dir },
                    { label: "Явки",            val: s.visits,        pct: s.visits_delta_pct,       dir: s.visits_delta_dir },
                    { label: "% явки",          val: `${s.visit_pct}%`, pct: s.visit_pct_delta_pct,  dir: s.visit_pct_delta_dir },
                    { label: "Неявки",          val: s.noshow,        pct: s.noshow_delta_pct,       dir: s.noshow_delta_dir, inv: true },
                    { label: "Отмены",          val: s.cancels,       pct: s.cancel_pct_delta_pct,   dir: s.cancel_pct_delta_dir, inv: true },
                    { label: "Новые пациенты",  val: s.new_patients,  pct: s.new_patients_delta_pct, dir: s.new_patients_delta_dir },
                  ].map(row => (
                    <tr key={row.label} className="hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-3 font-medium">{row.label}</td>
                      <td className="px-5 py-3 text-right font-mono">{row.val}</td>
                      <td className="px-5 py-3 text-right">
                        <DeltaBadge pct={row.pct} dir={row.dir as DeltaDir} invert={row.inv} />
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Детализация по администраторам (только записи, без фильтра) */}
      {config.source === "appointments" && !config.adminSurname && apptData && !loading && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-medium">По сотрудникам · сравнение с {prevLabel}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Сотрудник","Записей","Δ","Явки","% явки","Δ","Неявки","Δ","Новые","Δ"].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.values(apptData.by_admin).sort((a: any, b: any) => b.total - a.total).map((a: any) => (
                  <tr key={a.name} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {a.name}
                      {a.group_label && a.group !== "callcenter" && a.group !== "admin" && (
                        <span className="text-[10px] text-muted-foreground ml-1.5">{a.group_label}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{a.total}</td>
                    <td className="px-4 py-3 text-right"><DeltaBadge pct={a.total_delta_pct} dir={a.total_delta_dir} /></td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-500">{a.visits}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${
                        a.visit_pct >= 90 ? "bg-emerald-500/10 text-emerald-500"
                        : a.visit_pct >= 75 ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-red-500/10 text-red-500"
                      }`}>{a.visit_pct}%</span>
                    </td>
                    <td className="px-4 py-3 text-right"><DeltaBadge pct={a.visit_pct_delta_pct} dir={a.visit_pct_delta_dir} /></td>
                    <td className="px-4 py-3 text-right font-mono text-red-500">{a.noshow}</td>
                    <td className="px-4 py-3 text-right"><DeltaBadge pct={a.noshow_delta_pct} dir={a.noshow_delta_dir} invert /></td>
                    <td className="px-4 py-3 text-right font-mono text-purple-500">{a.new_patients}</td>
                    <td className="px-4 py-3 text-right"><DeltaBadge pct={a.new_patients_delta_pct} dir={a.new_patients_delta_dir} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
