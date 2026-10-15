"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchAppointmentStats, fetchAppointmentDaily, fetchAdmins, fetchPlanRange,
  toDateStr, addDays,
  type AppointmentStatsResponse, type AppointmentDailyResponse, type Admin, type PlanRangeResponse,
} from "@/lib/api";
import { getDefaultPeriod, shiftPeriod, formatPeriodLabel, type Period, type PeriodType } from "@/lib/periods";
import {
  Topbar, MenuItem, MenuDivider, MenuLabel, PageContent, MetricCard, SectionCard, SrcBar,
  StatusPill, Th, Td, SkeletonCards, Skeleton, Empty, ErrorBanner, ProgressBar,
} from "@/components/ui/primitives";
import {
  ComposedChart, Bar, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line,
} from "recharts";
import { useChartTheme, fmtDate } from "@/components/charts/base-chart";
import { cn } from "@/lib/utils";

const PERIODS = ["День","Неделя","Месяц","Квартал","Год","Период"];
const P_MAP: Record<string, PeriodType> = {
  "День":"day","Неделя":"week","Месяц":"month","Квартал":"quarter","Год":"year","Период":"custom"
};
const GROUP_ORDER = ["callcenter","admin","other","unknown"] as const;
const GROUP_LABELS: Record<string, string> = {
  callcenter:"Колл-центр", admin:"Администраторы", other:"Прочие", unknown:"Не указан"
};
const GROUP_COLORS: Record<string, { text: string; bar: string }> = {
  callcenter: { text: "#2070a8", bar: "#328fcd" },
  admin:      { text: "#127352", bar: "#1a9e6e" },
  other:      { text: "#7c4ddb", bar: "#8b5cf6" },
  unknown:    { text: "#94b3c9", bar: "#d6e8f5" },
};

function fmt(n: number) { return n.toLocaleString("ru-RU"); }
function fmtPct(n: number) { return n.toFixed(1) + "%"; }

// ─── Блок план / факт

interface PlanFactProps {
  plan: PlanRangeResponse | null;
  daily: AppointmentDailyResponse | null;
}

function PlanFactSection({ plan, daily }: PlanFactProps) {
  const ct = useChartTheme();
  if (!plan || plan.totals.appt_count === 0) return null;

  const planTotal = plan.totals.appt_count;
  const factTotal = daily ? daily.days.reduce((s, d) => s + d.total, 0) : 0;
  const pct = planTotal > 0 ? Math.round(factTotal / planTotal * 100) : 0;
  const color = pct >= 80 ? "text-emerald-600 dark:text-emerald-400"
    : pct >= 50 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  // Данные для графика
  const chartData = daily ? daily.days.map(d => {
    const p = plan.by_day[d.date]?.appt_count ?? 0;
    return {
      date: d.date,
      fact: d.total,
      plan: p,
      below: p > 0 && d.total < p,
    };
  }) : [];

  return (
    <>
      {/* Карточка выполнения плана */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3 mb-3">Выполнение плана</p>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-[30px] font-extrabold tabular-nums">{fmt(factTotal)}</span>
          <span className="text-[14px] text-muted-foreground/60">из {fmt(planTotal)} запланированных</span>
          <span className={cn("ml-auto text-[18px] font-black tabular-nums", color)}>{pct}%</span>
        </div>
        <ProgressBar pct={pct} />
      </div>

      {/* График план/факт по дням */}
      {chartData.length > 1 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <p className="text-[14px] font-semibold">Записи: план / факт по дням</p>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-violet-500/70 inline-block" />Факт
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-b-2 border-dashed border-emerald-500 inline-block" />План
              </span>
            </div>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 10, fill: ct.axis }}
                  axisLine={false} tickLine={false}
                  interval="preserveStartEnd" minTickGap={20}
                />
                <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} />
                <Tooltip
                  {...ct.tooltip}
                  labelFormatter={v => new Date(String(v)).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                />
                <Bar
                  dataKey="fact"
                  name="Факт"
                  fill="#8b5cf6"
                  fillOpacity={0.7}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                />
                <Line
                  dataKey="plan"
                  name="План"
                  type="monotone"
                  stroke="#1a9e6e"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="px-5 pb-3 text-[11px] text-muted-foreground/50">
            Красный фон на верхней полосе таблицы оповещает дни где факт ниже плана.
          </p>
        </div>
      )}
    </>
  );
}

// ─── Основная страница

export function AppointmentsPage() {
  const [periodLabel, setPeriodLabel] = useState("День");
  const [period,      setPeriod]      = useState<Period>(getDefaultPeriod("day"));
  const [adminId,     setAdminId]     = useState<string | null>(null);
  const [admins,      setAdmins]      = useState<Admin[]>([]);
  const [stats,       setStats]       = useState<AppointmentStatsResponse | null>(null);
  const [daily,       setDaily]       = useState<AppointmentDailyResponse | null>(null);
  const [planRange,   setPlanRange]   = useState<PlanRangeResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const ct = useChartTheme();
  const dateFrom = toDateStr(period.dateFrom);
  const dateTo   = toDateStr(period.dateTo);
  const yesterday = toDateStr(addDays(new Date(), -1));

  useEffect(() => {
    fetchAdmins().then(r => setAdmins(r.admins)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, d, p] = await Promise.all([
        fetchAppointmentStats(dateFrom, dateTo, adminId ?? undefined),
        fetchAppointmentDaily(dateFrom, dateTo, adminId ?? undefined),
        fetchPlanRange(dateFrom, dateTo).catch(() => null),
      ]);
      setStats(s); setDaily(d); setPlanRange(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally { setLoading(false); }
  }, [dateFrom, dateTo, adminId]);

  useEffect(() => { load(); }, [load]);

  function handlePeriod(label: string) {
    setPeriodLabel(label);
    setPeriod(getDefaultPeriod(P_MAP[label] ?? "day"));
  }

  const s   = stats?.total;
  const adminsByGroup = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = admins.filter(a => a.group === g);
    return acc;
  }, {} as Record<string, Admin[]>);

  const adminName = adminId ?? "Все сотрудники";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Записи"
        filterLabel={adminName}
        filterMenu={close => (
          <>
            <MenuItem active={!adminId} onClick={() => { setAdminId(null); close(); }}>Все сотрудники</MenuItem>
            <MenuDivider />
            {GROUP_ORDER.map(g => {
              const items = adminsByGroup[g];
              if (!items?.length) return null;
              return (
                <div key={g}>
                  <MenuLabel>{GROUP_LABELS[g]}</MenuLabel>
                  {items.map(a => (
                    <MenuItem key={a.surname} active={adminId === a.surname} onClick={() => { setAdminId(a.surname); close(); }}>
                      {a.surname}
                    </MenuItem>
                  ))}
                </div>
              );
            })}
          </>
        )}
        periodItems={PERIODS}
        period={periodLabel}
        onPeriod={handlePeriod}
        periodLabel={formatPeriodLabel(period)}
        onPrev={() => setPeriod(p => shiftPeriod(p, -1))}
        onNext={() => setPeriod(p => shiftPeriod(p, 1))}
        nextDisabled={toDateStr(period.dateTo) >= yesterday}
        onRefresh={load}
      />

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <SkeletonCards cols={4} />
            <SkeletonCards cols={2} count={2} />
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </>
        ) : !s ? (
          <Empty />
        ) : (
          <>
            {/* Cards row 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="Всего записей"   value={fmt(s.total)}        sub="за период" />
              <MetricCard label="Явки"             value={fmt(s.visits)}       valueClass="text-emerald-600 dark:text-emerald-400" sub={`${fmtPct(s.visit_pct)} от записей`} />
              <MetricCard label="Неявки"           value={fmt(s.noshow)}       valueClass={s.noshow_pct > 10 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"} sub={`${fmtPct(s.noshow_pct)} от записей`} />
              <MetricCard label="Новые пациенты"   value={fmt(s.new_patients)} valueClass="text-violet-600 dark:text-violet-400" sub={`${fmtPct(s.new_pct)} от записей`} />
            </div>

            {/* Cards row 2 */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Ожидают"  value={fmt(s.pending)}  sub="не подтверждены / одобрены" />
              <MetricCard label="Отмены"   value={fmt(s.cancels)}  sub="отменено пациентами" />
            </div>

            {/* Блок план / факт */}
            {!adminId && <PlanFactSection plan={planRange} daily={daily} />}

            {/* Новые vs повторные пациенты */}
            {!adminId && s.total > 0 && s.new_patients > 0 && (
              <div className="rounded-lg border border-border bg-card p-5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3 mb-4">Новые vs повторные пациенты</p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground/60 mb-1">Новые</p>
                    <p className="text-[28px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-violet-600 dark:text-violet-400">{fmt(s.new_patients)}</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-1">{fmtPct(s.new_pct)} от записей</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground/60 mb-1">Повторные</p>
                    <p className="text-[28px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-foreground">{fmt(s.total - s.new_patients)}</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-1">{fmtPct(100 - s.new_pct)} от записей</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[11px] text-muted-foreground/60">Новые</span>
                      <span className="text-[11px] font-bold tabular-nums">{fmtPct(s.new_pct)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500 bg-violet-500" style={{ width: Math.min(s.new_pct, 100) + "%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[11px] text-muted-foreground/60">Повторные</span>
                      <span className="text-[11px] font-bold tabular-nums">{fmtPct(100 - s.new_pct)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500 bg-emerald-500" style={{ width: Math.min(100 - s.new_pct, 100) + "%" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Конверсия по администраторам (запись → явка) */}
            {!adminId && stats && Object.keys(stats.by_admin).length > 1 && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-[13px] font-semibold">Конверсия запись → явка по администраторам</h3>
                </div>
                <div className="p-4 space-y-3">
                  {Object.values(stats.by_admin)
                    .filter(a => a.total >= 3)
                    .sort((a, b) => b.visit_pct - a.visit_pct)
                    .map((a, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium">{a.name}</span>
                            <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                              {fmt(a.visits)} из {fmt(a.total)}
                            </span>
                          </div>
                          <span className={cn(
                            "text-[13px] font-bold tabular-nums",
                            a.visit_pct >= 90 ? "text-emerald-600 dark:text-emerald-400"
                            : a.visit_pct >= 70 ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                          )}>
                            {fmtPct(a.visit_pct)}
                          </span>
                        </div>
                        <ProgressBar pct={Math.min(a.visit_pct, 100)} />
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Sources */}
            {stats?.by_group && Object.keys(stats.by_group).length > 0 && !adminId && (
              <SectionCard title="Источники записей" right={`всего ${fmt(s.total)}`}>
                {GROUP_ORDER.map(g => {
                  const item = stats.by_group[g];
                  if (!item) return null;
                  const c = GROUP_COLORS[g];
                  return (
                    <SrcBar key={g}
                      name={GROUP_LABELS[g]} nameColor={c.text}
                      count={item.count} pct={item.pct} barColor={c.bar}
                    />
                  );
                })}
              </SectionCard>
            )}

            {/* Daily chart */}
            {daily && daily.days.length > 1 && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h3 className="text-[13px] font-semibold">Динамика записей по дням</h3>
                  <div className="flex items-center gap-3">
                    {[{c:"#328fcd",l:"Записей"},{c:"#1a9e6e",l:"Явки"},{c:"#e03a5a",l:"Неявки"},{c:"#8b5cf6",l:"Новые",round:true}].map((x,i)=>(
                      <span key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                        <span className={cn("h-2 w-2 inline-block", x.round?"rounded-full":"rounded-sm")} style={{background:x.c}}/>
                        {x.l}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={daily.days} margin={{top:0,right:4,left:-20,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{fontSize:10,fill:ct.axis}} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
                      <YAxis tick={{fontSize:10,fill:ct.axis}} axisLine={false} tickLine={false} />
                      <Tooltip {...ct.tooltip} labelFormatter={(v)=>new Date(String(v)).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})} />
                      <Bar dataKey="total"   name="Записей" fill="#328fcd" radius={[3,3,0,0]} maxBarSize={20} />
                      <Bar dataKey="visits"  name="Явки"    fill="#1a9e6e" radius={[3,3,0,0]} maxBarSize={20} />
                      <Bar dataKey="noshow"  name="Неявки"  fill="#e03a5a" radius={[3,3,0,0]} maxBarSize={20} />
                      <Line dataKey="new_patients" name="Новые" type="monotone" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Admins table */}
            {!adminId && stats && Object.keys(stats.by_admin).length > 0 && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-[13px] font-semibold">По сотрудникам</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                    <thead>
                      <tr>
                        <Th>Сотрудник</Th>
                        <Th right>Записей</Th>
                        <Th right>Явки</Th>
                        <Th right>% явки</Th>
                        <Th right>Неявки</Th>
                        <Th right>Новые</Th>
                        <Th right>Отмены</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {GROUP_ORDER.map(g => {
                        const rows = Object.values(stats.by_admin)
                          .filter(a => a.group === g)
                          .sort((a,b) => b.total - a.total);
                        if (!rows.length) return null;
                        return [
                          <tr key={`g-${g}`} className="bg-muted/20">
                            <td colSpan={7} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 border-b border-border">
                              {GROUP_LABELS[g]}
                            </td>
                          </tr>,
                          ...rows.map((a, i) => (
                            <tr key={i} className="hover:bg-muted/40 transition-colors">
                              <Td><span className="font-semibold">{a.name}</span></Td>
                              <Td right bold>{a.total}</Td>
                              <Td right color="#1a9e6e" bold>{a.visits}</Td>
                              <Td right>
                                <StatusPill color={a.visit_pct >= 90 ? "green" : a.visit_pct >= 70 ? "amber" : "red"}>
                                  {fmtPct(a.visit_pct)}
                                </StatusPill>
                              </Td>
                              <Td right>{a.noshow > 0 ? <span className="text-red-600 dark:text-red-400 font-medium">{a.noshow}</span> : <span className="text-muted-foreground/40">0</span>}</Td>
                              <Td right color="#8b5cf6">{a.new_patients || "—"}</Td>
                              <Td right muted>{a.cancels || "—"}</Td>
                            </tr>
                          ))
                        ];
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 border-t border-border">
                        <Td bold>Итого</Td>
                        <Td right bold>{s.total}</Td>
                        <Td right color="#1a9e6e" bold>{s.visits}</Td>
                        <Td right><StatusPill color={s.visit_pct >= 90 ? "green" : s.visit_pct >= 70 ? "amber" : "red"}>{fmtPct(s.visit_pct)}</StatusPill></Td>
                        <Td right color="#e03a5a" bold>{s.noshow}</Td>
                        <Td right color="#8b5cf6">{s.new_patients}</Td>
                        <Td right muted>{s.cancels}</Td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </PageContent>
    </div>
  );
}
