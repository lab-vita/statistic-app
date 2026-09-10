"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchStats, fetchAppointmentStats, fetchDaily, fetchAppointmentDaily,
  toDateStr, addDays, formatDuration,
  Operator, Admin, DeltaDir,
  StatsResponse, AppointmentStatsResponse,
  DailyResponse, AppointmentDailyResponse,
} from "@/lib/api";
import { getDefaultPeriod, PeriodType } from "@/lib/periods";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

// ─── Типы ─────────────────────────────────────────────────────

type Source   = "calls" | "appointments";
type Metric   = "incoming" | "outgoing" | "missed" | "total" | "visits" | "noshow" | "new_patients" | "visit_pct";
type Grouping = "day" | "week" | "month";
type ChartType = "bar" | "line";

interface ReportConfig {
  source:   Source;
  metric:   Metric;
  grouping: Grouping;
  chart:    ChartType;
  dateFrom: string;
  dateTo:   string;
  operatorId:    string | null;
  adminSurname:  string | null;
}

interface Preset {
  id:     string;
  label:  string;
  config: Omit<ReportConfig, "dateFrom" | "dateTo">;
  periodType: PeriodType;
}

// ─── Пресеты ──────────────────────────────────────────────────

const PRESETS: Preset[] = [
  {
    id: "calls_week",
    label: "Звонки за неделю",
    periodType: "week",
    config: { source: "calls", metric: "incoming", grouping: "day", chart: "bar", operatorId: null, adminSurname: null },
  },
  {
    id: "missed_week",
    label: "Пропущенные",
    periodType: "week",
    config: { source: "calls", metric: "missed", grouping: "day", chart: "bar", operatorId: null, adminSurname: null },
  },
  {
    id: "calls_month",
    label: "Звонки за месяц",
    periodType: "month",
    config: { source: "calls", metric: "total", grouping: "day", chart: "line", operatorId: null, adminSurname: null },
  },
  {
    id: "visits_week",
    label: "Явка за неделю",
    periodType: "week",
    config: { source: "appointments", metric: "visits", grouping: "day", chart: "bar", operatorId: null, adminSurname: null },
  },
  {
    id: "new_patients_month",
    label: "Новые пациенты",
    periodType: "month",
    config: { source: "appointments", metric: "new_patients", grouping: "day", chart: "line", operatorId: null, adminSurname: null },
  },
  {
    id: "noshow_month",
    label: "Неявки за месяц",
    periodType: "month",
    config: { source: "appointments", metric: "noshow", grouping: "day", chart: "bar", operatorId: null, adminSurname: null },
  },
  {
    id: "visit_pct_month",
    label: "% явки по месяцам",
    periodType: "month",
    config: { source: "appointments", metric: "visit_pct", grouping: "day", chart: "line", operatorId: null, adminSurname: null },
  },
  {
    id: "monthly_overview",
    label: "Месячный обзор",
    periodType: "month",
    config: { source: "calls", metric: "total", grouping: "day", chart: "bar", operatorId: null, adminSurname: null },
  },
];

// ─── Настройки метрик ──────────────────────────────────────────

const CALL_METRICS: { value: Metric; label: string }[] = [
  { value: "incoming",    label: "Входящие"    },
  { value: "outgoing",    label: "Исходящие"   },
  { value: "missed",      label: "Пропущенные" },
  { value: "total",       label: "Всего звонков" },
];

const APPT_METRICS: { value: Metric; label: string }[] = [
  { value: "visits",      label: "Явки"         },
  { value: "noshow",      label: "Неявки"       },
  { value: "new_patients",label: "Новые пациенты" },
  { value: "visit_pct",   label: "% явки"       },
  { value: "total",       label: "Всего записей" },
];

const METRIC_LABELS: Record<Metric, string> = {
  incoming: "Входящие", outgoing: "Исходящие", missed: "Пропущенные",
  total: "Всего", visits: "Явки", noshow: "Неявки",
  new_patients: "Новые пациенты", visit_pct: "% явки",
};

const METRIC_COLORS: Record<Metric, string> = {
  incoming: "#22c55e", outgoing: "#3b82f6", missed: "#ef4444",
  total: "#6366f1", visits: "#22c55e", noshow: "#ef4444",
  new_patients: "#a855f7", visit_pct: "#0ea5e9",
};

// ─── Хелперы ──────────────────────────────────────────────────

function groupByWeek(days: { date: string; [k: string]: any }[]) {
  const weeks: Record<string, any> = {};
  for (const d of days) {
    const dt = new Date(d.date);
    const monday = new Date(dt);
    monday.setDate(dt.getDate() - dt.getDay() + 1);
    const key = toDateStr(monday);
    if (!weeks[key]) {
      weeks[key] = { date: key, incoming: 0, outgoing: 0, missed: 0, total: 0,
                     visits: 0, noshow: 0, new_patients: 0, visit_pct: 0, _count: 0 };
    }
    for (const k of ["incoming","outgoing","missed","total","visits","noshow","new_patients"]) {
      if (d[k] !== undefined) weeks[key][k] += d[k];
    }
    weeks[key]._count++;
  }
  // visit_pct считаем как visits/total
  return Object.values(weeks).map((w: any) => ({
    ...w,
    visit_pct: w.total > 0 ? Math.round(w.visits / w.total * 100) : 0,
  }));
}

function groupByMonth(days: { date: string; [k: string]: any }[]) {
  const months: Record<string, any> = {};
  for (const d of days) {
    const key = d.date.slice(0, 7); // "2026-08"
    if (!months[key]) {
      months[key] = { date: key, incoming: 0, outgoing: 0, missed: 0, total: 0,
                      visits: 0, noshow: 0, new_patients: 0, visit_pct: 0, _count: 0 };
    }
    for (const k of ["incoming","outgoing","missed","total","visits","noshow","new_patients"]) {
      if (d[k] !== undefined) months[key][k] += d[k];
    }
    months[key]._count++;
  }
  return Object.values(months).map((m: any) => ({
    ...m,
    visit_pct: m.total > 0 ? Math.round(m.visits / m.total * 100) : 0,
  }));
}

function applyGrouping(days: any[], grouping: Grouping) {
  if (grouping === "week")  return groupByWeek(days);
  if (grouping === "month") return groupByMonth(days);
  return days;
}

function formatDateLabel(d: string, grouping: Grouping) {
  if (grouping === "month") {
    const [y, m] = d.split("-");
    const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
    return `${months[parseInt(m)-1]} ${y}`;
  }
  const dt = new Date(d);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function DeltaBadge({ pct, dir, invert }: { pct?: number | null; dir?: DeltaDir; invert?: boolean }) {
  if (!pct || !dir || dir === "flat") return <span className="text-muted-foreground text-xs">—</span>;
  const isGood = invert ? dir === "down" : dir === "up";
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? "text-emerald-500" : "text-red-500"}`}>
      {dir === "up" ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

// ─── Пропсы ───────────────────────────────────────────────────

interface ReportsSectionProps {
  operators: Operator[];
  admins:    Admin[];
}

// ─── Основной компонент ───────────────────────────────────────

export function ReportsSection({ operators, admins }: ReportsSectionProps) {
  const [config, setConfig] = useState<ReportConfig>({
    source:       "calls",
    metric:       "incoming",
    grouping:     "day",
    chart:        "bar",
    dateFrom:     toDateStr(addDays(new Date(), -30)),
    dateTo:       toDateStr(addDays(new Date(), -1)),
    operatorId:   null,
    adminSurname: null,
  });

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [chartData, setChartData]       = useState<any[]>([]);
  const [summary, setSummary]           = useState<any | null>(null);
  const [tableRows, setTableRows]       = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (config.source === "calls") {
        const [statsRes, dailyRes]: [StatsResponse, DailyResponse] = await Promise.all([
          fetchStats(config.dateFrom, config.dateTo, config.operatorId ?? undefined),
          fetchDaily(config.dateFrom, config.dateTo, config.operatorId ?? undefined),
        ]);
        const grouped = applyGrouping(dailyRes.days, config.grouping);
        setChartData(grouped);
        setSummary(statsRes.operators["total"]);

        // Таблица: операторы с дельтами
        const rows = Object.entries(statsRes.operators)
          .filter(([k]) => k !== "total")
          .map(([, v]) => v);
        setTableRows(rows);

      } else {
        const [statsRes, dailyRes]: [AppointmentStatsResponse, AppointmentDailyResponse] = await Promise.all([
          fetchAppointmentStats(config.dateFrom, config.dateTo, config.adminSurname ?? undefined),
          fetchAppointmentDaily(config.dateFrom, config.dateTo, config.adminSurname ?? undefined),
        ]);
        const grouped = applyGrouping(dailyRes.days, config.grouping);
        setChartData(grouped);
        setSummary(statsRes.total);

        const rows = Object.values(statsRes.by_admin).sort((a: any, b: any) => b.total - a.total);
        setTableRows(rows);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(preset: Preset) {
    const period = getDefaultPeriod(preset.periodType);
    setActivePreset(preset.id);
    setConfig(prev => ({
      ...prev,
      ...preset.config,
      dateFrom: toDateStr(period.dateFrom),
      dateTo:   toDateStr(period.dateTo),
    }));
  }

  function update(patch: Partial<ReportConfig>) {
    setActivePreset(null);
    setConfig(prev => ({ ...prev, ...patch }));
  }

  const metrics = config.source === "calls" ? CALL_METRICS : APPT_METRICS;
  const color   = METRIC_COLORS[config.metric] ?? "#6366f1";
  const label   = METRIC_LABELS[config.metric];
  const invertDelta = config.metric === "missed" || config.metric === "noshow";

  const CustomTooltip = ({ active, payload, label: lbl }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md">
        <p className="font-medium mb-1">{formatDateLabel(lbl, config.grouping)}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span>{p.name}</span>
            <span className="font-mono font-medium">{p.value}{config.metric === "visit_pct" ? "%" : ""}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">

      {/* Пресеты */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              activePreset === p.id
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Панель настроек */}
      <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">

        {/* Источник */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Источник</label>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["calls","appointments"] as Source[]).map(s => (
              <button key={s} onClick={() => update({ source: s, metric: s === "calls" ? "incoming" : "visits" })}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                  config.source === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}>
                {s === "calls" ? "Звонки" : "Записи"}
              </button>
            ))}
          </div>
        </div>

        {/* Метрика */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Метрика</label>
          <select
            value={config.metric}
            onChange={e => update({ metric: e.target.value as Metric })}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-foreground/40"
          >
            {metrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {/* Разбивка */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Разбивка</label>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["day","week","month"] as Grouping[]).map(g => (
              <button key={g} onClick={() => update({ grouping: g })}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                  config.grouping === g ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}>
                {g === "day" ? "День" : g === "week" ? "Нед." : "Мес."}
              </button>
            ))}
          </div>
        </div>

        {/* Тип графика */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">График</label>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["bar","line"] as ChartType[]).map(c => (
              <button key={c} onClick={() => update({ chart: c })}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                  config.chart === c ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}>
                {c === "bar" ? "Бар" : "Линия"}
              </button>
            ))}
          </div>
        </div>

        {/* Период от */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">С</label>
          <input type="date" value={config.dateFrom}
            onChange={e => update({ dateFrom: e.target.value })}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-foreground/40"
          />
        </div>

        {/* Период до */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">По</label>
          <input type="date" value={config.dateTo}
            onChange={e => update({ dateTo: e.target.value })}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-foreground/40"
          />
        </div>

        {/* Фильтр по человеку */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {config.source === "calls" ? "Оператор" : "Сотрудник"}
          </label>
          {config.source === "calls" ? (
            <select value={config.operatorId ?? ""}
              onChange={e => update({ operatorId: e.target.value || null })}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-foreground/40"
            >
              <option value="">Все</option>
              {operators.map(o => <option key={o.id} value={o.id}>{o.name.split(" ")[0]}</option>)}
            </select>
          ) : (
            <select value={config.adminSurname ?? ""}
              onChange={e => update({ adminSurname: e.target.value || null })}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-foreground/40"
            >
              <option value="">Все</option>
              {admins.map(a => <option key={a.surname} value={a.surname}>{a.surname}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Сводка с дельтами */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {config.source === "calls" ? (
            <>
              <SummaryCard label="Входящие"    value={summary.incoming} deltaPct={summary.incoming_delta_pct} deltaDir={summary.incoming_delta_dir} />
              <SummaryCard label="Исходящие"   value={summary.outgoing} deltaPct={summary.outgoing_delta_pct} deltaDir={summary.outgoing_delta_dir} />
              <SummaryCard label="Пропущенные" value={summary.missed}   deltaPct={summary.missed_delta_pct}   deltaDir={summary.missed_delta_dir} invert />
              <SummaryCard label="Перезвонили" value={`${summary.callback_pct}%`} deltaPct={summary.callback_pct_delta_pct} deltaDir={summary.callback_pct_delta_dir} />
            </>
          ) : (
            <>
              <SummaryCard label="Всего записей"   value={summary.total}        deltaPct={summary.total_delta_pct}        deltaDir={summary.total_delta_dir} />
              <SummaryCard label="Явки"            value={summary.visits}       deltaPct={summary.visits_delta_pct}       deltaDir={summary.visits_delta_dir} />
              <SummaryCard label="Неявки"          value={summary.noshow}       deltaPct={summary.noshow_delta_pct}       deltaDir={summary.noshow_delta_dir} invert />
              <SummaryCard label="Новые пациенты"  value={summary.new_patients} deltaPct={summary.new_patients_delta_pct} deltaDir={summary.new_patients_delta_dir} />
            </>
          )}
        </div>
      )}

      {/* График */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">{label} — динамика</h3>
          <span className="text-xs text-muted-foreground">
            {config.dateFrom} — {config.dateTo}
          </span>
        </div>

        {loading ? (
          <div className="h-56 rounded-lg bg-muted/30 animate-pulse" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            {config.chart === "bar" ? (
              <BarChart data={chartData} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={d => formatDateLabel(d, config.grouping)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}
                  interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey={config.metric} fill={color} opacity={0.85} radius={[3,3,0,0]} name={label} />
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={d => formatDateLabel(d, config.grouping)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}
                  interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey={config.metric} stroke={color} strokeWidth={2}
                  dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name={label} />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-16">Нет данных за выбранный период</p>
        )}
      </div>

      {/* Таблица */}
      {!loading && tableRows.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-medium">
              {config.source === "calls" ? "По операторам" : "По сотрудникам"}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Сотрудник</th>
                  {config.source === "calls" ? (
                    <>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Входящие</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">↕</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Пропущенные</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">↕</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Ср. разговор</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Перезвонили</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">↕</th>
                    </>
                  ) : (
                    <>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Записей</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">↕</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Явки</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">% явки</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">↕</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Неявки</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Новые</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tableRows.map((row: any, i) => (
                  <tr key={i} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3 font-medium">
                      {row.name}
                      {row.group_label && row.group_label !== "Прочие" && (
                        <span className="ml-2 text-[10px] text-muted-foreground font-normal">{row.group_label}</span>
                      )}
                    </td>
                    {config.source === "calls" ? (
                      <>
                        <td className="px-5 py-3 text-right font-mono text-emerald-500 font-medium">{row.incoming}</td>
                        <td className="px-5 py-3 text-right"><DeltaBadge pct={row.incoming_delta_pct} dir={row.incoming_delta_dir} /></td>
                        <td className="px-5 py-3 text-right font-mono text-red-500">{row.missed}</td>
                        <td className="px-5 py-3 text-right"><DeltaBadge pct={row.missed_delta_pct} dir={row.missed_delta_dir} invert /></td>
                        <td className="px-5 py-3 text-right font-mono text-muted-foreground">{formatDuration(row.avg_duration)}</td>
                        <td className="px-5 py-3 text-right font-mono">{row.callback_pct}%</td>
                        <td className="px-5 py-3 text-right"><DeltaBadge pct={row.callback_pct_delta_pct} dir={row.callback_pct_delta_dir} /></td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 text-right font-mono font-medium">{row.total}</td>
                        <td className="px-5 py-3 text-right"><DeltaBadge pct={row.total_delta_pct} dir={row.total_delta_dir} /></td>
                        <td className="px-5 py-3 text-right font-mono text-emerald-500">{row.visits}</td>
                        <td className="px-5 py-3 text-right font-mono">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                            row.visit_pct >= 90 ? "bg-emerald-500/10 text-emerald-500"
                            : row.visit_pct >= 75 ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-red-500/10 text-red-500"
                          }`}>{row.visit_pct}%</span>
                        </td>
                        <td className="px-5 py-3 text-right"><DeltaBadge pct={row.visit_pct_delta_pct} dir={row.visit_pct_delta_dir} /></td>
                        <td className="px-5 py-3 text-right font-mono text-red-500">{row.noshow}</td>
                        <td className="px-5 py-3 text-right font-mono text-purple-500">{row.new_patients}</td>
                      </>
                    )}
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

// ─── Карточка сводки ──────────────────────────────────────────

function SummaryCard({ label, value, deltaPct, deltaDir, invert }: {
  label: string; value: string | number;
  deltaPct?: number | null; deltaDir?: DeltaDir; invert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-1">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-xl font-semibold font-mono">{value}</span>
      <DeltaBadge pct={deltaPct} dir={deltaDir} invert={invert} />
    </div>
  );
}
