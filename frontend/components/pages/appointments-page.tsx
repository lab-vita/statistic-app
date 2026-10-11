"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchAppointmentStats, fetchAppointmentDaily, fetchAdmins,
  toDateStr, addDays,
  type AppointmentStatsResponse, type AppointmentDailyResponse, type Admin,
} from "@/lib/api";
import { getDefaultPeriod, shiftPeriod, formatPeriodLabel, type Period, type PeriodType } from "@/lib/periods";
import {
  Topbar, PageContent, MetricCard, SectionCard, SrcBar,
  StatusPill, Th, Td, SkeletonCards, Skeleton, Empty, ErrorBanner,
} from "@/components/ui/primitives";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart,
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
  callcenter: { text: "#1d4ed8", bar: "#2563eb" },
  admin:      { text: "#15803d", bar: "#16a34a" },
  other:      { text: "#6d28d9", bar: "#7c3aed" },
  unknown:    { text: "#9ca3af", bar: "#d1d5db" },
};

function fmt(n: number) { return n.toLocaleString("ru-RU"); }
function fmtPct(n: number) { return n.toFixed(1) + "%"; }

export function AppointmentsPage() {
  const [periodLabel, setPeriodLabel] = useState("День");
  const [period,      setPeriod]      = useState<Period>(getDefaultPeriod("day"));
  const [adminId,     setAdminId]     = useState<string | null>(null);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [admins,      setAdmins]      = useState<Admin[]>([]);
  const [stats,       setStats]       = useState<AppointmentStatsResponse | null>(null);
  const [daily,       setDaily]       = useState<AppointmentDailyResponse | null>(null);
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
      const [s, d] = await Promise.all([
        fetchAppointmentStats(dateFrom, dateTo, adminId ?? undefined),
        fetchAppointmentDaily(dateFrom, dateTo, adminId ?? undefined),
      ]);
      setStats(s); setDaily(d);
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
        onFilterClick={() => setMenuOpen(v => !v)}
        periodItems={PERIODS}
        period={periodLabel}
        onPeriod={handlePeriod}
        periodLabel={formatPeriodLabel(period)}
        onPrev={() => setPeriod(p => shiftPeriod(p, -1))}
        onNext={() => setPeriod(p => shiftPeriod(p, 1))}
        nextDisabled={toDateStr(period.dateTo) >= yesterday}
        onRefresh={load}
      />

      {/* Admin filter dropdown */}
      {menuOpen && (
        <div className="absolute top-[100px] left-[216px] z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[190px] max-h-72 overflow-y-auto">
          <button onClick={() => { setAdminId(null); setMenuOpen(false); }}
            className={cn("w-full px-3 py-1.5 text-left text-[12px] hover:bg-accent transition-colors", !adminId && "font-semibold")}>
            Все сотрудники
          </button>
          <div className="h-px bg-border mx-2 my-1" />
          {GROUP_ORDER.map(g => {
            const items = adminsByGroup[g];
            if (!items?.length) return null;
            return (
              <div key={g}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  {GROUP_LABELS[g]}
                </div>
                {items.map(a => (
                  <button key={a.surname} onClick={() => { setAdminId(a.surname); setMenuOpen(false); }}
                    className={cn("w-full px-3 py-1.5 text-left text-[12px] hover:bg-accent transition-colors", adminId === a.surname && "font-semibold")}>
                    {a.surname}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <SkeletonCards cols={4} />
            <SkeletonCards cols={2} count={2} />
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
                    {[{c:"#2563eb",l:"Записей"},{c:"#16a34a",l:"Явки"},{c:"#dc2626",l:"Неявки"},{c:"#7c3aed",l:"Новые",round:true}].map((x,i)=>(
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
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{fontSize:10,fill:ct.axis}} axisLine={false} tickLine={false} interval={daily.days.length>14?2:0} />
                      <YAxis tick={{fontSize:10,fill:ct.axis}} axisLine={false} tickLine={false} />
                      <Tooltip {...ct.tooltip} labelFormatter={(v)=>new Date(v).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})} />
                      <Bar dataKey="total"   name="Записей" fill="#2563eb" radius={[3,3,0,0]} maxBarSize={20} />
                      <Bar dataKey="visits"  name="Явки"    fill="#16a34a" radius={[3,3,0,0]} maxBarSize={20} />
                      <Bar dataKey="noshow"  name="Неявки"  fill="#dc2626" radius={[3,3,0,0]} maxBarSize={20} />
                      <Line dataKey="new_patients" name="Новые" type="monotone" stroke="#7c3aed" strokeWidth={2} dot={false} />
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
                  <table className="w-full border-collapse">
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
                              <Td right color="#16a34a" bold>{a.visits}</Td>
                              <Td right>
                                <StatusPill color={a.visit_pct >= 90 ? "green" : a.visit_pct >= 70 ? "amber" : "red"}>
                                  {fmtPct(a.visit_pct)}
                                </StatusPill>
                              </Td>
                              <Td right>{a.noshow > 0 ? <span className="text-red-600 dark:text-red-400 font-medium">{a.noshow}</span> : <span className="text-muted-foreground/40">0</span>}</Td>
                              <Td right color="#7c3aed">{a.new_patients || "—"}</Td>
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
                        <Td right color="#16a34a" bold>{s.visits}</Td>
                        <Td right><StatusPill color={s.visit_pct >= 90 ? "green" : s.visit_pct >= 70 ? "amber" : "red"}>{fmtPct(s.visit_pct)}</StatusPill></Td>
                        <Td right color="#dc2626" bold>{s.noshow}</Td>
                        <Td right color="#7c3aed">{s.new_patients}</Td>
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
