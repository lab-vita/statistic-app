"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar, type Section } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { AuthGate, useAuth } from "@/components/auth-gate";
import { HomeDashboard } from "@/components/home-dashboard";
import { ReportsDashboard } from "@/components/reports-dashboard";
import { PlansDashboard } from "@/components/plans-dashboard";
import { RevenueDashboard } from "@/components/revenue-dashboard";
import { AdminPanel } from "@/components/admin-panel";

import { CardsOverview } from "@/components/cards-overview";
import { HourlyChart } from "@/components/hourly-chart";
import { DailyChart } from "@/components/daily-chart";
import { HeatmapChart } from "@/components/heatmap-chart";
import { ComparisonChart } from "@/components/comparison-chart";
import { OperatorsTable } from "@/components/operators-table";
import { ConversionBlock } from "@/components/conversion-block";

import { AppointmentCards } from "@/components/appointments-cards";
import { AppointmentsTable } from "@/components/appointments-table";
import { AppointmentsDailyChart } from "@/components/appointments-daily-chart";

import {
  fetchStats, fetchHourly, fetchDaily, fetchHeatmap, fetchComparison,
  fetchOperators, fetchAdmins, collectCalls, collectAppointments,
  fetchAppointmentStats, fetchAppointmentDaily,
  toDateStr, addDays,
  type Operator, type Admin,
  type StatsResponse, type HourlyResponse, type DailyResponse,
  type HeatmapResponse, type ComparisonResponse, type ComparisonMetric,
  type AppointmentStatsResponse, type AppointmentDailyResponse,
} from "@/lib/api";
import { Period, PeriodType, getDefaultPeriod } from "@/lib/periods";

/* ── helpers ── */
const Skeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-lg bg-muted/60 animate-pulse" />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-lg bg-muted/60 animate-pulse" />)}
    </div>
  </div>
);

const PageHeader = ({ title, sub }: { title: string; sub?: string }) => (
  <div>
    <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
    {sub && <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>}
  </div>
);

const ErrorBanner = ({ msg }: { msg: string }) => (
  <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] text-red-600 dark:text-red-400">
    {msg}
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
    <p className="text-[13px] text-muted-foreground/60">{text}</p>
  </div>
);

/* ── main ── */
function DashboardPage() {
  const { can, canSee } = useAuth();

  const [section,       setSection]       = useState<Section>("home");
  const [period,        setPeriod]        = useState<Period>(getDefaultPeriod("day"));
  const [interval,      setInterval]      = useState(60);
  const [customFrom,    setCustomFrom]    = useState(toDateStr(addDays(new Date(), -7)));
  const [customTo,      setCustomTo]      = useState(toDateStr(addDays(new Date(), -1)));
  const [selectedOp,    setSelectedOp]    = useState<string | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);
  const [compMetric,    setCompMetric]    = useState<ComparisonMetric>("total");

  const [operators, setOperators] = useState<Operator[]>([]);
  const [admins,    setAdmins]    = useState<Admin[]>([]);

  const [stats,      setStats]      = useState<StatsResponse | null>(null);
  const [hourly,     setHourly]     = useState<HourlyResponse | null>(null);
  const [daily,      setDaily]      = useState<DailyResponse | null>(null);
  const [heatmap,    setHeatmap]    = useState<HeatmapResponse | null>(null);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [apptStats,  setApptStats]  = useState<AppointmentStatsResponse | null>(null);
  const [apptDaily,  setApptDaily]  = useState<AppointmentDailyResponse | null>(null);

  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const dateFrom = period.type === "custom" ? customFrom : toDateStr(period.dateFrom);
  const dateTo   = period.type === "custom" ? customTo   : toDateStr(period.dateTo);

  const noTopbar = ["home", "reports", "plans", "revenue", "admin"];

  /* load operators/admins once */
  useEffect(() => {
    if (can("view:calls") || can("view:reports"))
      fetchOperators().then(r => setOperators(r.operators)).catch(() => {});
    if (can("view:appointments") || can("view:reports"))
      fetchAdmins().then(r => setAdmins(r.admins)).catch(() => {});
  }, [can]);

  const load = useCallback(async () => {
    if (noTopbar.includes(section)) return;
    setLoading(true); setError(null);
    try {
      if (section === "calls") {
        const isDay = period.type === "day";
        const base  = [
          fetchStats(dateFrom, dateTo, selectedOp ?? undefined),
          fetchHeatmap(dateFrom, dateTo, selectedOp ?? undefined),
        ];
        const chart = isDay
          ? fetchHourly(dateFrom, dateTo, interval, selectedOp ?? undefined)
          : fetchDaily(dateFrom, dateTo, selectedOp ?? undefined);
        const comp  = (!isDay && !selectedOp)
          ? fetchComparison(dateFrom, dateTo, compMetric)
          : Promise.resolve(null);

        const [s, hm, ch, cp] = await Promise.all([...base, chart, comp]);
        setStats(s); setHeatmap(hm);
        if (isDay)  { setHourly(ch as HourlyResponse); setDaily(null); setComparison(null); }
        else        { setDaily(ch as DailyResponse); setHourly(null); setComparison(cp); }
      }
      if (section === "appointments") {
        const [as_, ad] = await Promise.all([
          fetchAppointmentStats(dateFrom, dateTo, selectedAdmin ?? undefined),
          fetchAppointmentDaily(dateFrom, dateTo, selectedAdmin ?? undefined),
        ]);
        setApptStats(as_); setApptDaily(ad);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [section, dateFrom, dateTo, period.type, interval, selectedOp, selectedAdmin, compMetric]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      if (can("data:collect")) {
        if (section === "calls")        await collectCalls(dateFrom, dateTo);
        if (section === "appointments") await collectAppointments(dateFrom, dateTo);
      }
      await load();
    } finally { setRefreshing(false); }
  }

  function handleSelectSection(s: Section) {
    if (!canSee(s)) return;
    setSection(s); setSelectedOp(null); setSelectedAdmin(null); setError(null);
  }

  const callsStats  = selectedOp ? stats?.operators[selectedOp] : stats?.operators["total"];
  const revFrom     = toDateStr(addDays(new Date(), -30));
  const revTo       = toDateStr(addDays(new Date(), -1));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — desktop left, mobile top */}
      <div className="hidden lg:flex lg:flex-col lg:w-[210px] lg:shrink-0 lg:border-r lg:border-border">
        <Sidebar section={section} onSelectSection={handleSelectSection} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile sidebar header */}
        <div className="lg:hidden">
          <Sidebar section={section} onSelectSection={handleSelectSection} />
        </div>

        {/* Topbar for data sections */}
        {!noTopbar.includes(section) && (
          <Topbar
            section={section} period={period}
            onChange={setPeriod} onTypeChange={t => setPeriod(getDefaultPeriod(t))}
            customFrom={customFrom} customTo={customTo}
            onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}
            onRefresh={handleRefresh} refreshing={refreshing}
            operators={operators} selectedOperator={selectedOp} onSelectOperator={setSelectedOp}
            admins={admins} selectedAdmin={selectedAdmin} onSelectAdmin={setSelectedAdmin}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6 space-y-5">

            {error && <ErrorBanner msg={error} />}

            {/* ── Главная ── */}
            {section === "home" && (
              can("view:calls")
                ? <HomeDashboard onNavigate={handleSelectSection} />
                : <Empty text="Нет доступа к данным. Выберите раздел в меню." />
            )}

            {/* ── Звонки ── */}
            {section === "calls" && canSee("calls") && (
              <>
                {loading ? <Skeleton /> : callsStats
                  ? <CardsOverview stats={callsStats} dateFrom={dateFrom} dateTo={dateTo} />
                  : <Empty text="Нет данных за выбранный период" />
                }
                {!loading && hourly && (
                  <HourlyChart data={hourly.slots} interval={interval} onIntervalChange={setInterval} />
                )}
                {!loading && daily && daily.days.length > 0 && (
                  <DailyChart data={daily.days} />
                )}
                {!loading && !selectedOp && comparison && comparison.series.length > 0 && (
                  <ComparisonChart
                    series={comparison.series} dates={comparison.dates}
                    metric={compMetric} onMetricChange={setCompMetric}
                  />
                )}
                {!loading && heatmap && heatmap.cells.length > 0 && (
                  <HeatmapChart cells={heatmap.cells} />
                )}
                {!loading && !selectedOp && stats && (
                  <OperatorsTable operators={stats.operators} />
                )}
                {!loading && !selectedOp && (
                  <ConversionBlock dateFrom={dateFrom} dateTo={dateTo} />
                )}
              </>
            )}

            {/* ── Записи ── */}
            {section === "appointments" && canSee("appointments") && (
              <>
                {loading ? <Skeleton /> : apptStats
                  ? <AppointmentCards stats={apptStats.total} byGroup={apptStats.by_group ?? {}} dateFrom={dateFrom} dateTo={dateTo} />
                  : <Empty text="Нет данных за выбранный период" />
                }
                {!loading && apptDaily && apptDaily.days.length > 0 && (
                  <AppointmentsDailyChart data={apptDaily.days} />
                )}
                {!loading && !selectedAdmin && apptStats && (
                  <AppointmentsTable byAdmin={apptStats.by_admin} total={apptStats.total} />
                )}
              </>
            )}

            {/* ── Выручка ── */}
            {section === "revenue" && canSee("revenue") && (
              <>
                <PageHeader
                  title="Выручка"
                  sub="Последние 30 дней · только обычные платежи (исключены возвраты и страховые)"
                />
                <RevenueDashboard dateFrom={revFrom} dateTo={revTo} />
              </>
            )}

            {/* ── Отчёты / Планы / Доступ ── */}
            {section === "reports" && canSee("reports") && <ReportsDashboard />}
            {section === "plans"   && canSee("plans")   && <PlansDashboard />}
            {section === "admin"   && canSee("admin")   && <AdminPanel />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Page() {
  return <AuthGate><DashboardPage /></AuthGate>;
}
