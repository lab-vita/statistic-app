"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar, Section } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { HomeDashboard } from "@/components/home-dashboard";
import { ReportsDashboard } from "@/components/reports-dashboard";
import { PlansDashboard } from "@/components/plans-dashboard";
import { CardsOverview } from "@/components/cards-overview";
import { HourlyChart } from "@/components/hourly-chart";
import { DailyChart } from "@/components/daily-chart";
import { HeatmapChart } from "@/components/heatmap-chart";
import { ComparisonChart } from "@/components/comparison-chart";
import { OperatorsTable } from "@/components/operators-table";
import { AppointmentCards } from "@/components/appointments-cards";
import { AppointmentsTable } from "@/components/appointments-table";
import { AppointmentsDailyChart } from "@/components/appointments-daily-chart";
import {
  fetchStats, fetchHourly, fetchDaily, fetchHeatmap, fetchComparison,
  fetchOperators, fetchAdmins, collectCalls,
  fetchAppointmentStats, fetchAppointmentDaily,
  collectAppointments,
  toDateStr, addDays,
  Operator, Admin,
  StatsResponse, HourlyResponse, DailyResponse,
  HeatmapResponse, ComparisonResponse, ComparisonMetric,
  AppointmentStatsResponse, AppointmentDailyResponse,
} from "@/lib/api";
import { Period, PeriodType, getDefaultPeriod } from "@/lib/periods";

export default function DashboardPage() {
  const [section, setSection]             = useState<Section>("home");
  const [operators, setOperators]         = useState<Operator[]>([]);
  const [admins, setAdmins]               = useState<Admin[]>([]);
  const [selectedOp, setSelectedOp]       = useState<string | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);

  const [period, setPeriod]               = useState<Period>(getDefaultPeriod("day"));
  const [interval, setIntervalVal]        = useState(60);
  const [customFrom, setCustomFrom]       = useState(toDateStr(addDays(new Date(), -7)));
  const [customTo, setCustomTo]           = useState(toDateStr(addDays(new Date(), -1)));

  const [stats, setStats]                 = useState<StatsResponse | null>(null);
  const [hourly, setHourly]               = useState<HourlyResponse | null>(null);
  const [daily, setDaily]                 = useState<DailyResponse | null>(null);
  const [heatmap, setHeatmap]             = useState<HeatmapResponse | null>(null);
  const [comparison, setComparison]       = useState<ComparisonResponse | null>(null);
  const [compMetric, setCompMetric]       = useState<ComparisonMetric>("total");

  const [apptStats, setApptStats]         = useState<AppointmentStatsResponse | null>(null);
  const [apptDaily, setApptDaily]         = useState<AppointmentDailyResponse | null>(null);

  const [loading, setLoading]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const dateFrom = period.type === "custom" ? customFrom : toDateStr(period.dateFrom);
  const dateTo   = period.type === "custom" ? customTo   : toDateStr(period.dateTo);

  useEffect(() => {
    fetchOperators().then(r => setOperators(r.operators)).catch(() => {});
    fetchAdmins().then(r => setAdmins(r.admins)).catch(() => {});
  }, []);

  const noTopbar = ["home", "reports", "plans"];

  const load = useCallback(async () => {
    if (noTopbar.includes(section)) return;
    setLoading(true);
    setError(null);
    try {
      if (section === "calls") {
        const promises: Promise<any>[] = [
          fetchStats(dateFrom, dateTo, selectedOp ?? undefined),
          fetchHeatmap(dateFrom, dateTo, selectedOp ?? undefined),
        ];
        if (period.type === "day") {
          promises.push(fetchHourly(dateFrom, dateTo, interval, selectedOp ?? undefined));
        } else {
          promises.push(fetchDaily(dateFrom, dateTo, selectedOp ?? undefined));
          if (!selectedOp) promises.push(fetchComparison(dateFrom, dateTo, compMetric));
        }
        const [s, hm, chart, comp] = await Promise.all(promises);
        setStats(s); setHeatmap(hm);
        if (period.type === "day") {
          setHourly(chart); setDaily(null); setComparison(null);
        } else {
          setDaily(chart); setHourly(null); setComparison(comp ?? null);
        }
      } else if (section === "appointments") {
        const [as_, ad] = await Promise.all([
          fetchAppointmentStats(dateFrom, dateTo, selectedAdmin ?? undefined),
          fetchAppointmentDaily(dateFrom, dateTo, selectedAdmin ?? undefined),
        ]);
        setApptStats(as_); setApptDaily(ad);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, period.type, interval, selectedOp, selectedAdmin, compMetric, section]);

  useEffect(() => { load(); }, [load]);

  function handleTypeChange(type: PeriodType) {
    setPeriod(getDefaultPeriod(type));
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      if (section === "calls") await collectCalls(dateFrom, dateTo);
      else if (section === "appointments") await collectAppointments(dateFrom, dateTo);
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  function handleSelectSection(s: Section) {
    setSection(s);
    setSelectedOp(null);
    setSelectedAdmin(null);
    setError(null);
  }

  const callsTotal   = stats?.operators["total"];
  const callsOpData  = selectedOp ? stats?.operators[selectedOp] : null;
  const displayCalls = selectedOp ? callsOpData : callsTotal;

  const Skeleton = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar section={section} onSelectSection={handleSelectSection} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {!noTopbar.includes(section) && (
          <Topbar
            section={section}
            period={period}
            onChange={setPeriod}
            onTypeChange={handleTypeChange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            operators={operators}
            selectedOperator={selectedOp}
            onSelectOperator={setSelectedOp}
            admins={admins}
            selectedAdmin={selectedAdmin}
            onSelectAdmin={setSelectedAdmin}
          />
        )}

        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-500">
              {error}
            </div>
          )}

          {section === "home" && <HomeDashboard onNavigate={handleSelectSection} />}
          {section === "reports" && <ReportsDashboard />}
          {section === "plans" && <PlansDashboard />}

          {section === "calls" && (
            <>
              {loading ? <Skeleton /> : displayCalls ? (
                <CardsOverview stats={displayCalls} />
              ) : (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Нет данных за выбранный период
                </div>
              )}
              {!loading && hourly && (
                <HourlyChart data={hourly.slots} interval={interval} onIntervalChange={setIntervalVal} />
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
            </>
          )}

          {section === "appointments" && (
            <>
              {loading ? <Skeleton /> : apptStats ? (
                <AppointmentCards stats={apptStats.total} />
              ) : (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Нет данных за выбранный период
                </div>
              )}
              {!loading && apptDaily && apptDaily.days.length > 0 && (
                <AppointmentsDailyChart data={apptDaily.days} />
              )}
              {!loading && !selectedAdmin && apptStats && (
                <AppointmentsTable byAdmin={apptStats.by_admin} total={apptStats.total} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
