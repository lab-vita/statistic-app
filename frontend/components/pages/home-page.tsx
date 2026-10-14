"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings2 } from "lucide-react";
import {
  fetchStats, fetchDaily, fetchConversion, fetchPlanRange, fetchAppointmentStats, fetchPaymentStats,
  toDateStr, addDays,
} from "@/lib/api";
import { getDefaultPeriod, shiftPeriod, formatPeriodLabel, type Period, type PeriodType } from "@/lib/periods";
import { loadHomeData, emptyHomeData, type HomeData, type HomeNeeds } from "@/lib/home-data";
import { widgetDef, type PlacedWidget, type WidgetPermission } from "@/lib/grid";
import {
  PageContent, PageHeader, PeriodPill, DateNav, HeaderDivider, RefreshButton,
} from "@/components/ui/primitives";
import { HomeDashboard } from "@/components/home-dashboard";
import { useAuth } from "@/components/auth-gate";
import { cn } from "@/lib/utils";

const PERIODS = ["День", "Неделя", "Месяц", "Квартал", "Год"];
const P_MAP: Record<string, PeriodType> = {
  "День": "day", "Неделя": "week", "Месяц": "month", "Квартал": "quarter", "Год": "year",
};

function needsOf(widgets: PlacedWidget[]): HomeNeeds {
  const perms = new Set(widgets.map(w => widgetDef(w.type)?.permission));
  return {
    calls:        perms.has("view:calls"),
    appointments: perms.has("view:appointments"),
    payments:     perms.has("view:revenue"),
  };
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
    setNeeds(prev =>
      prev && prev.calls === next.calls && prev.appointments === next.appointments && prev.payments === next.payments ? prev : next,
    );
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!needs) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const d = await loadHomeData(dateFrom, dateTo, {
      fetchStats, fetchDaily, fetchConversion, fetchPlanRange, fetchAppointmentStats, fetchPaymentStats,
    }, needs);
    setData(d);
    setLoading(false);
    setRefreshing(false);
  }, [dateFrom, dateTo, needs]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader title="Главная">
        <div className="flex-1" />
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
          {editMode ? "Настройка…" : "Настроить"}
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
