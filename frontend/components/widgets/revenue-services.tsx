"use client";

import { ShoppingBag } from "lucide-react";
import type { SalesStatsResponse } from "@/lib/api";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, DeltaBadge, C, num, rub } from "./widget-card";

export function RevenueServicesWidget({ data, loading }: { data: SalesStatsResponse | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;

  const services = (data?.services ?? []).filter(s => s.final_sum > 0);
  const max = services[0]?.final_sum ?? 0;

  return (
    <WidgetCard>
      <WidgetHeader
        title="Топ услуг"
        meta={data ? `продажи ${rub(data.total.final_sum)}` : undefined}
        right={data ? <DeltaBadge pct={data.total.delta_pct} dir={data.total.delta_dir} /> : undefined}
      />
      {services.length === 0 ? (
        <WidgetEmpty icon={ShoppingBag} text="Нет продаж за период" />
      ) : (
        <ol className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {services.map((s, i) => (
            <li key={`${s.service_id ?? s.service_title}-${i}`}>
              <div className="mb-1 flex items-baseline gap-2 text-[12px]">
                <span className="w-4 shrink-0 text-right text-[10px] font-bold tabular-nums text-text-3">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-text-2" title={s.service_title}>{s.service_title}</span>
                <span className="hidden shrink-0 text-[11px] tabular-nums text-text-3 @[24rem]:inline">
                  {num(s.amount)} {s.unit || "шт"}
                </span>
                <span className="shrink-0 font-bold tabular-nums">{rub(s.final_sum)}</span>
              </div>
              <div className="ml-6 h-1 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${max > 0 ? (s.final_sum / max) * 100 : 0}%`, background: C.blue }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </WidgetCard>
  );
}
