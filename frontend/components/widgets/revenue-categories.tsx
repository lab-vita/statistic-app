"use client";

import { Layers } from "lucide-react";
import type { SalesByCategoryResponse } from "@/lib/api";
import { CATEGORY_COLORS } from "@/components/revenue-categories";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, DeltaBadge } from "./widget-card";

const rub = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(v)) + " ₽";

/** Выручка по направлениям: доля каждого и изменение к прошлому периоду. */
export function RevenueCategoriesWidget({ data, loading }: { data: SalesByCategoryResponse | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;
  const rows = data?.categories ?? [];
  return (
    <WidgetCard>
      <WidgetHeader title="Направления" meta={data ? rub(data.total.sum) : undefined} />
      {rows.length === 0 ? (
        <WidgetEmpty icon={Layers} text="Нет продаж за период" />
      ) : (
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
          {rows.map((c, i) => (
            <div key={c.title}>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-text-2">{c.title}</span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  <span className="text-text-3">{rub(c.total)}</span>
                  {c.prev_total ? <DeltaBadge pct={c.delta_pct} dir={c.delta_dir} /> : null}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full" style={{ width: `${Math.min(c.share, 100)}%`, background: CATEGORY_COLORS[i] ?? "#94b3c9" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
