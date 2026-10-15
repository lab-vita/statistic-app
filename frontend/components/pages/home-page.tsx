"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings2 } from "lucide-react";
import {
  fetchStats, fetchDaily, fetchConversion, fetchPlanRange, fetchHeatmap,
  fetchAppointmentStats, fetchAppointmentDaily,
  fetchPaymentStats, fetchPaymentDaily, fetchPaymentByDoctor, fetchSalesStats,
  fetchNoshows, fetchReturns, fetchSalesByCategory,
  fetchCallsReport, fetchApptReport,
  toDateStr, addDays,
} from "@/lib/api";
import { getDefaultPeriod, shiftPeriod, formatPeriodLabel, type Period, type PeriodType } from "@/lib/periods";
import { loadHomeData, emptyHomeData, needsKey, type HomeApi, type HomeData, type HomeNeeds } from "@/lib/home-data";
import { widgetDef, type PlacedWidget, type WidgetPermission } from "@/lib/grid";
import {
  PageContent, PageHeader, HeaderControls, PeriodPill, DateNav, HeaderDivider, RefreshButton,
} from "@/components/ui/primitives";
import { HomeDashboard } from "@/components/home-dashboard";
import { useAuth } from "@/components/auth-gate";
import { cn } from "@/lib/utils";

const PERIODS = ["День", "Неделя", "Месяц", "Квартал", "Год"];
const P_MAP: Record<string, PeriodType> = {
  "День": "day", "Неделя": "week", "Месяц": "month", "Квартал": "quarter", "Год": "year",
};

const API: HomeApi = {
  fetchStats, fetchDaily, fetchConversion, fetchPlanRange,
  fetchHeatmap:          (f, t) => fetchHeatmap(f, t),
  fetchAppointmentStats: (f, t) => fetchAppointmentStats(f, t),
  fetchAppointmentDaily: (f, t) => fetchAppointmentDaily(f, t),
  fetchPaymentStats, fetchPaymentDaily,
  fetchPaymentByDoctor:  (f, t) => fetchPaymentByDoctor(f, t, 15),
  fetchSalesStats:       (f, t) => fetchSalesStats(f, t, 15),
  fetchCallsReport:      (f, t) => fetchCallsReport(f, t, "month"),
  fetchApptReport:       (f, t) => fetchApptReport(f, t, "month"),
  fetchNoshows, fetchReturns,
  fetchSalesByCategory:  (f, t) => fetchSalesByCategory(f, t, 5),
};

/** Объединение данных, которые нужны виджетам на экране. */
function needsOf(widgets: PlacedWidget[]): HomeNeeds {
  const out: HomeNeeds = {};
  for (const w of widgets) for (const k of widgetDef(w.type)?.data ?? []) out[k] = true;
  return out;
}

export function HomePage() {
  const { can } = useAuth();
  const canWidget = useCallback((p: WidgetPermission) => can(p), [can]);

  const [periodLabel, setPeriodLabel] = useState("Месяц");
  const [period,      setPeriod]      = useState<Period>(getDefaultPeriod("month"));
  const [data,        setData]        = useState<HomeData>(() => emptyHomeData());
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  // null — раскладка ещё не известна, данные не грузим
  const [needs,       setNeeds]       = useState<HomeNeeds | null>(null);

  const dateFrom  = toDateStr(period.dateFrom);
  const dateTo    = toDateStr(period.dateTo);
  const yesterday = toDateStr(addDays(new Date(), -1));

  const onLayout = useCallback((widgets: PlacedWidget[]) => {
    const next = needsOf(widgets);
    setNeeds(prev => (prev && needsKey(prev) === needsKey(next) ? prev : next));
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!needs) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const d = await loadHomeData(dateFrom, dateTo, API, needs);
    setData(d);
    setLoading(false);
    setRefreshing(false);
  }, [dateFrom, dateTo, needs]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader title="Главная">
        <HeaderControls>
          <button
            type="button"
            onClick={() => setEditMode(v => !v)}
            aria-pressed={editMode}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-semibold transition-colors",
              editMode
                ? "border-brand bg-brand-soft text-brand"
                : "border-border bg-card text-text-2 hover:border-brand/50 hover:text-foreground",
            )}
          >
            <Settings2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span className="max-sm:sr-only">{editMode ? "Настройка…" : "Настроить"}</span>
          </button>
          <HeaderDivider />
          <PeriodPill
            items={PERIODS}
            active={periodLabel}
            onChange={l => { setPeriodLabel(l); setPeriod(getDefaultPeriod(P_MAP[l] ?? "month")); }}
          />
          <HeaderDivider />
          <DateNav
            label={formatPeriodLabel(period)}
            onPrev={() => setPeriod(p => shiftPeriod(p, -1))}
            onNext={() => setPeriod(p => shiftPeriod(p, 1))}
            nextDisabled={toDateStr(period.dateTo) >= yesterday}
          />
          <HeaderDivider />
          <RefreshButton onClick={() => load(true)} refreshing={refreshing} />
        </HeaderControls>
      </PageHeader>

      <PageContent>
        <HomeDashboard
          data={data}
          loading={loading}
          editMode={editMode}
          onEditMode={setEditMode}
          can={canWidget}
          onLayout={onLayout}
        />
      </PageContent>
    </div>
  );
}
