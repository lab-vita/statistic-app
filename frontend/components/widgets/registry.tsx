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
    default:
      return null;
  }
}
