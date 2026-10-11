"use client";

import { useState, useEffect, useCallback } from "react";

import { PageContent, MetricCard, SectionCard, StatusPill, Th, Td, TabGroup, Skeleton, Empty, ErrorBanner } from "@/components/ui/primitives";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "@/components/charts/base-chart";
import { fetchOperators, fetchAdmins, type Operator, type Admin } from "@/lib/api";
import { cn } from "@/lib/utils";

// Internal fetch helper that proxies to the API directly
async function fetchReport(path: string, params: Record<string, string>) {
  const url = new URL((process.env.NEXT_PUBLIC_API_URL ?? "") + path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const GRAN_ITEMS = ["День","Неделя","Месяц"];
const GRAN_MAP: Record<string, string> = { "День":"day","Неделя":"week","Месяц":"month" };
const TAB_ITEMS = ["Звонки","Записи"];

function fmtPeriod(s: string, gran: string): string {
  if (gran === "Месяц") {
    const [y, m] = s.split("-");
    return new Date(Number(y), Number(m)-1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }
  return s;
}
function fmtPct(n: number) { return n.toFixed(1) + "%"; }
const fmt = (n: number) => n.toLocaleString("ru-RU");

// Default dates: last 90 days
function defaultDates() {
  const to = new Date(); to.setDate(to.getDate()-1);
  const from = new Date(to); from.setDate(from.getDate()-89);
  return {
    from: from.toISOString().slice(0,10),
    to:   to.toISOString().slice(0,10),
  };
}

export function ReportsPage() {
  const [tab,    setTab]    = useState("Звонки");
  const [gran,   setGran]   = useState("Месяц");
  const [opId,   setOpId]   = useState("");
  const [admin,  setAdmin]  = useState("");
  const [dates,  setDates]  = useState(defaultDates());
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [admins,    setAdmins]    = useState<Admin[]>([]);
  const ct = useChartTheme();

  useEffect(() => {
    fetchOperators().then(r => setOperators(r.operators)).catch(() => {});
    fetchAdmins().then(r => setAdmins(r.admins)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string,string> = {
        date_from: dates.from, date_to: dates.to,
        granularity: GRAN_MAP[gran] ?? "month",
      };
      if (tab === "Звонки" && opId)    params.operator_id    = opId;
      if (tab === "Записи" && admin)   params.admin_surname  = admin;

      const path = tab === "Звонки" ? "/api/reports/calls" : "/api/reports/appointments";
      const r = await fetchReport(path, params);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally { setLoading(false); }
  }, [tab, gran, opId, admin, dates]);

  useEffect(() => { load(); }, [load]);

  const totals  = report?.totals;
  const periods = report?.periods ?? [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-4 lg:px-5 flex-wrap">
        <span className="text-[13px] font-bold">Отчёты</span>
        <TabGroup items={TAB_ITEMS} active={tab} onChange={t => { setTab(t); setReport(null); }} />
        <div className="flex-1" />
        <TabGroup items={GRAN_ITEMS} active={gran} onChange={setGran} small />
        {tab === "Звонки" ? (
          <select value={opId} onChange={e => setOpId(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
            <option value="">Все операторы</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        ) : (
          <select value={admin} onChange={e => setAdmin(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
            <option value="">Все сотрудники</option>
            {admins.map(a => <option key={a.surname} value={a.surname}>{a.surname}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1.5">
          <input type="date" value={dates.from}
            onChange={e => setDates(d => ({ ...d, from: e.target.value }))}
            className="rounded-md border border-border bg-background px-2 py-1 text-[12px]" />
          <span className="text-[12px] text-muted-foreground/50">—</span>
          <input type="date" value={dates.to}
            onChange={e => setDates(d => ({ ...d, to: e.target.value }))}
            className="rounded-md border border-border bg-background px-2 py-1 text-[12px]" />
        </div>
      </header>

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-28"/>)}</div>
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </>
        ) : !totals ? (
          <Empty />
        ) : tab === "Звонки" ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="Принято"     value={fmt(totals.incoming)} valueClass="text-emerald-600 dark:text-emerald-400" deltaDir={report.deltas?.incoming?.dir} deltaPct={report.deltas?.incoming?.pct} />
              <MetricCard label="Исходящие"   value={fmt(totals.outgoing)} valueClass="text-blue-600 dark:text-blue-400"       deltaDir={report.deltas?.outgoing?.dir} deltaPct={report.deltas?.outgoing?.pct} />
              <MetricCard label="Пропущенные" value={fmt(totals.missed)}   valueClass="text-red-600 dark:text-red-400"         deltaDir={report.deltas?.missed?.dir}   deltaPct={report.deltas?.missed?.pct}   invert />
              <MetricCard label="Потеряно"    value={fmt(totals.lost ?? 0)} valueClass="text-red-600 dark:text-red-400" />
            </div>

            {periods.length > 1 && (
              <SectionCard title={`Динамика по ${gran.toLowerCase()}м`}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={periods} barGap={2} barCategoryGap="35%" margin={{top:0,right:4,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                    <XAxis dataKey="period" tickFormatter={s => fmtPeriod(s,gran)} tick={{fontSize:10,fill:ct.axis}} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{fontSize:10,fill:ct.axis}} axisLine={false} tickLine={false} />
                    <Tooltip {...ct.tooltip} labelFormatter={s=>fmtPeriod(s,gran)} />
                    <Bar dataKey="incoming" name="Принятые"    fill="#16a34a" radius={[3,3,0,0]} maxBarSize={22} />
                    <Bar dataKey="outgoing" name="Исходящие"   fill="#2563eb" radius={[3,3,0,0]} maxBarSize={22} />
                    <Bar dataKey="missed"   name="Пропущенные" fill="#dc2626" radius={[3,3,0,0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            )}

            <SectionCard title="Сводная таблица" noPad>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr>
                    <Th>Период</Th><Th right>Принято</Th><Th right>Исходящие</Th>
                    <Th right>Пропущено</Th><Th right>% пропуска</Th><Th right>Потеряно</Th>
                  </tr></thead>
                  <tbody>
                    {periods.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/40 transition-colors">
                        <Td>{fmtPeriod(r.period, gran)}</Td>
                        <Td right color="#16a34a" bold>{fmt(r.incoming)}</Td>
                        <Td right color="#2563eb">{fmt(r.outgoing)}</Td>
                        <Td right>{fmt(r.missed)}</Td>
                        <Td right>
                          <StatusPill color={r.missed_pct>10?"red":r.missed_pct>6?"amber":"green"}>
                            {fmtPct(r.missed_pct ?? (r.received>0?r.missed/r.received*100:0))}
                          </StatusPill>
                        </Td>
                        <Td right color="#dc2626">{fmt(r.lost ?? 0)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="Всего записей" value={fmt(totals.total)} deltaDir={report.deltas?.total?.dir} deltaPct={report.deltas?.total?.pct} />
              <MetricCard label="Явки"          value={fmt(totals.visits)} valueClass="text-emerald-600 dark:text-emerald-400" deltaDir={report.deltas?.visits?.dir} deltaPct={report.deltas?.visits?.pct} />
              <MetricCard label="Неявки"        value={fmt(totals.noshow)} valueClass="text-red-600 dark:text-red-400" deltaDir={report.deltas?.noshow?.dir} deltaPct={report.deltas?.noshow?.pct} invert />
              <MetricCard label="Новые пациенты" value={fmt(totals.new_patients)} valueClass="text-violet-600 dark:text-violet-400" />
            </div>

            {periods.length > 1 && (
              <SectionCard title={`Динамика по ${gran.toLowerCase()}м`}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={periods} barGap={2} barCategoryGap="35%" margin={{top:0,right:4,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                    <XAxis dataKey="period" tickFormatter={s=>fmtPeriod(s,gran)} tick={{fontSize:10,fill:ct.axis}} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{fontSize:10,fill:ct.axis}} axisLine={false} tickLine={false} />
                    <Tooltip {...ct.tooltip} labelFormatter={s=>fmtPeriod(s,gran)} />
                    <Bar dataKey="total"  name="Записей" fill="#2563eb" radius={[3,3,0,0]} maxBarSize={22} />
                    <Bar dataKey="visits" name="Явки"    fill="#16a34a" radius={[3,3,0,0]} maxBarSize={22} />
                    <Bar dataKey="noshow" name="Неявки"  fill="#dc2626" radius={[3,3,0,0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            )}

            <SectionCard title="Сводная таблица" noPad>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr>
                    <Th>Период</Th><Th right>Записей</Th><Th right>Явки</Th><Th right>% явки</Th><Th right>Неявки</Th><Th right>Новые</Th>
                  </tr></thead>
                  <tbody>
                    {periods.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/40 transition-colors">
                        <Td>{fmtPeriod(r.period, gran)}</Td>
                        <Td right bold>{fmt(r.total)}</Td>
                        <Td right color="#16a34a" bold>{fmt(r.visits)}</Td>
                        <Td right>
                          <StatusPill color={r.visit_pct>=80?"green":r.visit_pct>=60?"amber":"red"}>
                            {fmtPct(r.visit_pct ?? (r.total>0?r.visits/r.total*100:0))}
                          </StatusPill>
                        </Td>
                        <Td right color="#dc2626">{fmt(r.noshow)}</Td>
                        <Td right color="#7c3aed">{fmt(r.new_patients)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}
      </PageContent>
    </div>
  );
}
