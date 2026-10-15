"use client";

// Единая точка: какой компонент рисует каждый тип виджета и какие у него настройки.
// Используется и сеткой главной, и превью в каталоге.

import type { PlacedWidget, WidgetTypeId } from "@/lib/grid";
import type { HomeData } from "@/lib/home-data";
import type { PlanMetric } from "@/lib/plan-forecast";
import { CallsSingleWidget, CALLS_SINGLE_METRICS, type CallsSingleMetric } from "./calls-single";
import { CallsTrioWidget } from "./calls-trio";
import { CallsChartWidget, CHART_METRICS, type ChartMetric } from "./calls-chart";
import { CallsFunnelWidget } from "./calls-funnel";
import { CallsPlanWidget } from "./calls-plan";
import { CallsOperatorsWidget } from "./calls-operators";
import { CallsConversionWidget } from "./calls-conversion";
import { ApptSummaryWidget } from "./appt-summary";
import { ApptSourcesWidget } from "./appt-sources";
import { RevenueSingleWidget, REVENUE_METRICS, type RevenueMetric } from "./revenue-single";
import { RevenueMethodsWidget } from "./revenue-methods";
import { CallsHeatmapWidget, HEATMAP_METRICS, type HeatmapMetric } from "./calls-heatmap";
import { ApptSingleWidget, APPT_METRICS, type ApptMetric } from "./appt-single";
import { ApptChartWidget } from "./appt-chart";
import { ApptAdminsWidget } from "./appt-admins";
import { RevenueChartWidget } from "./revenue-chart";
import { RevenueServicesWidget } from "./revenue-services";
import { DoctorsTopWidget } from "./doctors-top";
import { FunnelStepsWidget } from "./funnel-steps";
import { FunnelTrendWidget } from "./funnel-trend";
import { PlansProgressWidget } from "./plans-progress";
import { ReportsMonthsWidget, REPORTS_METRICS, type ReportsMetric } from "./reports-months";
import { PatientsNoshowsWidget } from "./patients-noshows";
import { PatientsReturnsWidget } from "./patients-returns";
import { RevenueCategoriesWidget } from "./revenue-categories";

export interface WidgetOption { value: string; label: string; hint?: string }

/** Настройка «что показывать» для виджетов с выбором метрики. */
export const WIDGET_OPTIONS: Partial<Record<WidgetTypeId, { title: string; key: "metric"; options: WidgetOption[] }>> = {
  calls_single: {
    title: "Какую метрику показывать",
    key: "metric",
    options: CALLS_SINGLE_METRICS.map(m => ({ value: m.key, label: m.label, hint: m.hint })),
  },
  calls_chart: {
    title: "Показатель на графике по умолчанию",
    key: "metric",
    options: CHART_METRICS.map(m => ({ value: m.key, label: m.label })),
  },
  revenue_single: {
    title: "Какую метрику показывать",
    key: "metric",
    options: REVENUE_METRICS.map(m => ({ value: m.key, label: m.label, hint: m.hint })),
  },
  calls_heatmap: {
    title: "Что считать",
    key: "metric",
    options: HEATMAP_METRICS.map(m => ({ value: m.key, label: m.label, hint: m.hint })),
  },
  appt_single: {
    title: "Какую метрику показывать",
    key: "metric",
    options: APPT_METRICS.map(m => ({ value: m.key, label: m.label, hint: m.hint })),
  },
  reports_months: {
    title: "Что показывать",
    key: "metric",
    options: REPORTS_METRICS.map(m => ({ value: m.key, label: m.label, hint: m.hint })),
  },
};

/** Подпись виджета в интерфейсе настройки: «Одна метрика · Принятые». */
export function widgetCaption(pw: Pick<PlacedWidget, "type" | "config">, name: string): string {
  const opt = WIDGET_OPTIONS[pw.type];
  const value = pw.config?.metric;
  const label = opt && value ? opt.options.find(o => o.value === value)?.label : undefined;
  return label ? `${name} · ${label}` : name;
}

export function WidgetContent({ pw, data, loading }: {
  pw: Pick<PlacedWidget, "type" | "config">; data: HomeData; loading: boolean;
}) {
  const total = data.stats?.operators["total"] ?? null;
  const metric = pw.config?.metric;

  switch (pw.type) {
    case "calls_single":
      return (
        <CallsSingleWidget
          stats={total} loading={loading} conversion={data.conversion}
          daily={data.daily?.days}
          metric={(metric as CallsSingleMetric) ?? "incoming"}
        />
      );
    case "calls_trio":
      return <CallsTrioWidget stats={total} loading={loading} />;
    case "calls_chart":
      return (
        <CallsChartWidget
          key={metric ?? "incoming"}
          daily={data.daily?.days ?? []} prevDaily={data.prevDaily?.days ?? null} loading={loading}
          metric={(metric as ChartMetric) ?? "incoming"}
        />
      );
    case "calls_funnel":
      return <CallsFunnelWidget stats={total} loading={loading} />;
    case "calls_plan":
      return (
        <CallsPlanWidget
          days={data.daily?.days ?? []} plan={data.plan} dateFrom={data.dateFrom} dateTo={data.dateTo}
          loading={loading} metric={(metric as PlanMetric) ?? "calls_incoming"}
        />
      );
    case "calls_operators":
      return <CallsOperatorsWidget operators={data.stats?.operators ?? null} conversion={data.conversionData} loading={loading} />;
    case "calls_conversion":
      return <CallsConversionWidget data={data.conversionData} value={data.conversion} loading={loading} />;
    case "appt_summary":
      return <ApptSummaryWidget data={data.appointments} loading={loading} />;
    case "appt_sources":
      return <ApptSourcesWidget data={data.appointments} loading={loading} />;
    case "revenue_single":
      return <RevenueSingleWidget data={data.payments} loading={loading} metric={(metric as RevenueMetric) ?? "total_paid"} />;
    case "revenue_methods":
      return <RevenueMethodsWidget data={data.payments} loading={loading} />;
    case "calls_heatmap":
      return <CallsHeatmapWidget data={data.heatmap} loading={loading} metric={(metric as HeatmapMetric) ?? "total"} />;
    case "appt_single":
      return (
        <ApptSingleWidget
          data={data.appointments} daily={data.apptDaily?.days} loading={loading}
          metric={(metric as ApptMetric) ?? "total"}
        />
      );
    case "appt_chart":
      return <ApptChartWidget days={data.apptDaily?.days ?? []} loading={loading} />;
    case "appt_admins":
      return <ApptAdminsWidget data={data.appointments} loading={loading} />;
    case "revenue_chart":
      return <RevenueChartWidget days={data.paymentDaily?.days ?? []} loading={loading} />;
    case "revenue_services":
      return <RevenueServicesWidget data={data.sales} loading={loading} />;
    case "doctors_top":
      return <DoctorsTopWidget data={data.doctors} loading={loading} />;
    case "funnel_steps":
      return <FunnelStepsWidget data={data} loading={loading} />;
    case "funnel_trend":
      return (
        <FunnelTrendWidget
          days={data.conversionData?.days ?? []}
          total={data.conversionData ? data.conversionData.total.conversion_pct : null}
          loading={loading}
        />
      );
    case "plans_progress":
      return <PlansProgressWidget data={data} loading={loading} />;
    case "patients_noshows":
      return <PatientsNoshowsWidget data={data.noshows} loading={loading} />;
    case "patients_returns":
      return <PatientsReturnsWidget data={data.returns} loading={loading} />;
    case "revenue_categories":
      return <RevenueCategoriesWidget data={data.categories} loading={loading} />;
    case "reports_months":
      return <ReportsMonthsWidget data={data} loading={loading} metric={(metric as ReportsMetric) ?? "calls"} />;
    default:
      return null;
  }
}
