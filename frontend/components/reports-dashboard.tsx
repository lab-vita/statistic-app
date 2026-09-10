"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchCallsReport, fetchAppointmentsReport,
  fetchOperators, fetchAdmins,
  toDateStr, addDays, formatDuration,
  Granularity, Operator, Admin,
  CallsReportResponse, AppointmentsReportResponse,
  DeltaDir,
} from "@/lib/api";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { useRef } from "react";

// ─── Пресеты ─────────────────────────────────────────────────

type Source      = "calls" | "appointments";
type ChartMetric = "incoming" | "outgoing" | "missed" | "total" | "visits" | "noshow" | "new_patients" | "visit_pct";

interface Preset {
  id:          string;
  label:       string;
  source:      Source;
  granularity: Granularity;
  daysBack:    number;
  metric:      ChartMetric;
  description: string;
}

const PRESETS: Preset[] = [
  { id: "calls_week",    label: "Звонки за неделю",          source: "calls",        granularity: "day",   daysBack: 7,  metric: "incoming",    description: "Входящие/пропущенные по дням + таблица операторов" },
  { id: "calls_month",   label: "Звонки за месяц",           source: "calls",        granularity: "week",  daysBack: 30, metric: "incoming",    description: "Входящие по неделям + сравнение с прошлым месяцем" },
  { id: "calls_missed",  label: "Пропущенные и перезвоны",   source: "calls",        granularity: "day",   daysBack: 14, metric: "missed",      description: "Динамика пропущенных за 2 недели" },
  { id: "appt_week",     label: "Явка за неделю",            source: "appointments", granularity: "day",   daysBack: 7,  metric: "visits",      description: "Явки/неявки по дням + таблица администраторов" },
  { id: "appt_month",    label: "Записи за месяц",           source: "appointments", granularity: "week",  daysBack: 30, metric: "total",       description: "Записи по неделям с дельтами" },
  { id: "appt_new",      label: "Новые пациенты",            source: "appointments", granularity: "week",  daysBack: 60, metric: "new_patients", description: "Динамика новых пациентов за 2 месяца" },
  { id: "monthly_calls", label: "Месячный обзор (звонки)",   source: "calls",        granularity: "month", daysBack: 90, metric: "total",       description: "Помесячная динамика звонков за квартал" },
  { id: "monthly_appt",  label: "Месячный обзор (записи)",   source: "appointments", granularity: "month", daysBack: 90, metric: "visit_pct",  description: "Помесячная явка за квартал" },
];

const CALL_METRICS: { value: ChartMetric; label: string }[] = [
  { value: "incoming",    label: "Входящие"    },
  { value: "outgoing",    label: "Исходящие"   },
  { value: "missed",      label: "Пропущенные" },
  { value: "total",       label: "Всего"       },
];

const APPT_METRICS: { value: ChartMetric; label: string }[] = [
  { value: "total",        label: "Записей"         },
  { value: "visits",       label: "Явки"            },
  { value: "noshow",       label: "Неявки"          },
  { value: "new_patients", label: "Новые пациенты"  },
  { value: "visit_pct",    label: "% явки"          },
];

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "day",   label: "По дням"    },
  { value: "week",  label: "По неделям" },
  { value: "month", label: "По месяцам" },
];

const COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#eab308", "#ef4444", "#f97316"];
const GROUP_ORDER = ["callcenter", "admin", "other"] as const;
const GROUP_LABELS: Record<string, string> = { callcenter: "Колл-центр", admin: "Администраторы", other: "Прочие" };

// ─── Вспомогательные ─────────────────────────────────────────

function formatPeriod(p: string, granularity: Granularity): string {
  if (granularity === "month") {
    const [y, m] = p.split("-");
    return new Date(+y, +m - 1).toLocaleDateString("ru-RU", { month: "short", year: "numeric" });
  }
  if (granularity === "week") {
    return "нед. " + new Date(p).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }
  return new Date(p).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function DeltaBadge({ pct, dir, invert }: { pct: number | null; dir: DeltaDir; invert?: boolean }) {
  if (pct == null || dir == null || dir === "flat") return <span className="text-[10px] text-muted-foreground">—</span>;
  const isGood = invert ? dir === "down" : dir === "up";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isGood ? "text-emerald-500" : "text-red-500"}`}>
      {dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

function SummaryCard({ label, value, deltaPct, deltaDir, invert }: {
  label: string; value: string | number;
  deltaPct?: number | null; deltaDir?: DeltaDir; invert?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-semibold font-mono">{value}</div>
      {deltaDir !== undefined && (
        <div className="mt-1">
          <DeltaBadge pct={deltaPct ?? null} dir={deltaDir ?? null} invert={invert} />
        </div>
      )}
    </div>
  );
}

// ─── Выпадашка ───────────────────────────────────────────────

function Dropdown({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-xs hover:bg-muted/40 transition-colors">
        {label} <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border bg-background shadow-md py-1 max-h-64 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
      {label}
    </button>
  );
}

// ─── Главный компонент ────────────────────────────────────────

export function ReportsDashboard() {
  const [source, setSource]           = useState<Source>("calls");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [metric, setMetric]           = useState<ChartMetric>("incoming");
  const [daysBack, setDaysBack]       = useState(7);
  const [operatorId, setOperatorId]   = useState<string | null>(null);
  const [adminSurname, setAdminSurname] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>("calls_week");

  const [operators, setOperators] = useState<Operator[]>([]);
  const [admins, setAdmins]       = useState<Admin[]>([]);

  const [callsData, setCallsData]   = useState<CallsReportResponse | null>(null);
  const [apptData, setApptData]     = useState<AppointmentsReportResponse | null>(null);
  const [loading, setLoading]       = useState(false);

  const dateTo   = toDateStr(addDays(new Date(), -1));
  const dateFrom = toDateStr(addDays(new Date(), -daysBack));

  useEffect(() => {
    fetchOperators().then(r => setOperators(r.operators)).catch(() => {});
    fetchAdmins().then(r => setAdmins(r.admins)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (source === "calls") {
        const d = await fetchCallsReport(dateFrom, dateTo, granularity, operatorId ?? undefined);
        setCallsData(d);
      } else {
        const d = await fetchAppointmentsReport(dateFrom, dateTo, granularity, adminSurname ?? undefined);
        setApptData(d);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, source, granularity, operatorId, adminSurname]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(p: Preset) {
    setActivePreset(p.id);
    setSource(p.source);
    setGranularity(p.granularity);
    setDaysBack(p.daysBack);
    setMetric(p.metric);
    setOperatorId(null);
    setAdminSurname(null);
  }

  const currentMetrics = source === "calls" ? CALL_METRICS : APPT_METRICS;
  const data = source === "calls" ? callsData : apptData;

  const chartData = data?.rows.map(r => ({
    ...r,
    period: formatPeriod(r.period, granularity),
  })) ?? [];

  const summary = data?.summary;
  const adminsByGroup = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = admins.filter(a => a.group === g);
    return acc;
  }, {} as Record<string, Admin[]>);

  return (
    <div className="space-y-5">

      {/* Пресеты */}
      <div>
        <h1 className="text-base font-semibold mb-3">Отчёты</h1>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activePreset === p.id
                  ? "bg-foreground text-background border-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Панель настроек */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        {/* Источник */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
          {(["calls", "appointments"] as Source[]).map(s => (
            <button key={s} onClick={() => { setSource(s); setActivePreset(null); setMetric(s === "calls" ? "incoming" : "total"); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                source === s ? "bg-background text-foreground border border-border shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              {s === "calls" ? "Звонки" : "Записи"}
            </button>
          ))}
        </div>

        {/* Метрика */}
        <Dropdown label={currentMetrics.find(m => m.value === metric)?.label ?? "Метрика"}>
          {currentMetrics.map(m => (
            <DropdownItem key={m.value} label={m.label} active={metric === m.value}
              onClick={() => { setMetric(m.value); setActivePreset(null); }} />
          ))}
        </Dropdown>

        {/* Гранулярность */}
        <Dropdown label={GRANULARITIES.find(g => g.value === granularity)?.label ?? "Период"}>
          {GRANULARITIES.map(g => (
            <DropdownItem key={g.value} label={g.label} active={granularity === g.value}
              onClick={() => { setGranularity(g.value); setActivePreset(null); }} />
          ))}
        </Dropdown>

        {/* Глубина */}
        <Dropdown label={`${daysBack} дней`}>
          {[7, 14, 30, 60, 90, 180, 365].map(d => (
            <DropdownItem key={d} label={`${d} дней`} active={daysBack === d}
              onClick={() => { setDaysBack(d); setActivePreset(null); }} />
          ))}
        </Dropdown>

        {/* Фильтр по человеку */}
        {source === "calls" && (
          <Dropdown label={operatorId ? operators.find(o => o.id === operatorId)?.name.split(" ")[0] ?? "Все" : "Все операторы"}>
            <DropdownItem label="Все операторы" active={!operatorId} onClick={() => setOperatorId(null)} />
            {operators.map(op => (
              <DropdownItem key={op.id} label={op.name} active={operatorId === op.id}
                onClick={() => setOperatorId(op.id)} />
            ))}
          </Dropdown>
        )}
        {source === "appointments" && (
          <Dropdown label={adminSurname ?? "Все"}>
            <DropdownItem label="Все" active={!adminSurname} onClick={() => setAdminSurname(null)} />
            {GROUP_ORDER.map(group => {
              const items = adminsByGroup[group];
              if (!items?.length) return null;
              return (
                <div key={group}>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {GROUP_LABELS[group]}
                  </div>
                  {items.map(a => (
                    <DropdownItem key={a.surname} label={a.surname} active={adminSurname === a.surname}
                      onClick={() => setAdminSurname(a.surname)} />
                  ))}
                </div>
              );
            })}
          </Dropdown>
        )}

        {loading && <span className="text-xs text-muted-foreground ml-auto">Загрузка...</span>}
      </div>

      {/* Сводные карточки */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {source === "calls" ? (
            <>
              <SummaryCard label="Входящие"    value={summary.incoming} deltaPct={summary.incoming_delta_pct} deltaDir={summary.incoming_delta_dir} />
              <SummaryCard label="Исходящие"   value={summary.outgoing} deltaPct={summary.outgoing_delta_pct} deltaDir={summary.outgoing_delta_dir} />
              <SummaryCard label="Пропущенные" value={summary.missed}   deltaPct={summary.missed_delta_pct}   deltaDir={summary.missed_delta_dir} invert />
              <SummaryCard label="Всего"       value={summary.total}    deltaPct={summary.total_delta_pct}    deltaDir={summary.total_delta_dir} />
            </>
          ) : (
            <>
              <SummaryCard label="Записей"          value={summary.total}        deltaPct={summary.total_delta_pct}        deltaDir={summary.total_delta_dir} />
              <SummaryCard label="Явки"             value={summary.visits}       deltaPct={summary.visits_delta_pct}       deltaDir={summary.visits_delta_dir} />
              <SummaryCard label="% явки"           value={`${summary.visit_pct}%`} deltaPct={summary.visit_pct_delta_pct} deltaDir={summary.visit_pct_delta_dir} />
              <SummaryCard label="Новые пациенты"   value={summary.new_patients} deltaPct={summary.new_patients_delta_pct} deltaDir={summary.new_patients_delta_dir} />
            </>
          )}
        </div>
      )}

      {/* График */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">
              {currentMetrics.find(m => m.value === metric)?.label} · {GRANULARITIES.find(g => g.value === granularity)?.label}
            </h3>
            <span className="text-xs text-muted-foreground">
              {data?.date_from} — {data?.date_to}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            {metric === "visit_pct" ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Line type="monotone" dataKey={metric} stroke="#22c55e" strokeWidth={2} dot={false} name="% явки" />
              </LineChart>
            ) : (
              <BarChart data={chartData} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey={metric} fill={COLORS[0]} radius={[3,3,0,0]}
                  name={currentMetrics.find(m => m.value === metric)?.label} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Таблица — операторы */}
      {source === "calls" && callsData && !operatorId && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-medium">По операторам · сравнение с предыдущим периодом</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Пред. период: {callsData.prev_from} — {callsData.prev_to}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Оператор", "Входящие", "Δ", "Исходящие", "Δ", "Пропущенные", "Δ", "Всего", "Δ"].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {callsData.by_operator.map(op => (
                  <tr key={op.operator_id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-medium">{op.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-500">{op.incoming}</td>
                    <td className="px-4 py-3 text-right"><DeltaBadge pct={op.incoming_delta_pct} dir={op.incoming_delta_dir} /></td>
                    <td className="px-4 py-3 text-right font-mono text-blue-500">{op.outgoing}</td>
                    <td className="px-4 py-3 text-right"><DeltaBadge pct={op.outgoing_delta_pct} dir={op.outgoing_delta_dir} /></td>
                    <td className="px-4 py-3 text-right font-mono text-red-500">{op.missed}</td>
                    <td className="px-4 py-3 text-right"><DeltaBadge pct={op.missed_delta_pct} dir={op.missed_delta_dir} invert /></td>
                    <td className="px-4 py-3 text-right font-mono">{op.total}</td>
                    <td className="px-4 py-3 text-right"><DeltaBadge pct={op.total_delta_pct} dir={op.total_delta_dir} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Таблица — администраторы */}
      {source === "appointments" && apptData && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-medium">По сотрудникам · сравнение с предыдущим периодом</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Пред. период: {apptData.prev_from} — {apptData.prev_to}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Сотрудник", "Записей", "Δ", "Явки", "Δ", "% явки", "Δ", "Новые", "Δ", "Неявки", "Δ"].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {GROUP_ORDER.map(group => {
                  const items = apptData.by_admin.filter(a => a.group === group);
                  if (!items.length) return null;
                  return (
                    <>
                      <tr key={`g-${group}`} className="bg-muted/20">
                        <td colSpan={11} className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {GROUP_LABELS[group]}
                        </td>
                      </tr>
                      {items.map(a => (
                        <tr key={a.name} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-medium">{a.name}</td>
                          <td className="px-4 py-3 text-right font-mono">{a.total}</td>
                          <td className="px-4 py-3 text-right"><DeltaBadge pct={a.total_delta_pct} dir={a.total_delta_dir} /></td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-500">{a.visits}</td>
                          <td className="px-4 py-3 text-right"><DeltaBadge pct={a.visits_delta_pct} dir={a.visits_delta_dir} /></td>
                          <td className="px-4 py-3 text-right font-mono">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                              a.visit_pct >= 90 ? "bg-emerald-500/10 text-emerald-500"
                              : a.visit_pct >= 75 ? "bg-yellow-500/10 text-yellow-500"
                              : "bg-red-500/10 text-red-500"}`}>
                              {a.visit_pct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right"><DeltaBadge pct={a.visit_pct_delta_pct} dir={a.visit_pct_delta_dir} /></td>
                          <td className="px-4 py-3 text-right font-mono text-purple-500">{a.new_patients}</td>
                          <td className="px-4 py-3 text-right"><DeltaBadge pct={a.new_patients_delta_pct} dir={a.new_patients_delta_dir} /></td>
                          <td className="px-4 py-3 text-right font-mono text-red-500">{a.noshow}</td>
                          <td className="px-4 py-3 text-right"><DeltaBadge pct={a.noshow_delta_pct} dir={a.noshow_delta_dir} invert /></td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
