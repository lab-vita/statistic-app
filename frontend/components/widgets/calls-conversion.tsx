"use client";

import { Repeat } from "lucide-react";
import type { ConversionResponse } from "@/lib/api";
import { formatPct, type ConversionValue } from "@/lib/call-metrics";
import { WidgetCard, WidgetLabel, WidgetSkeleton, WidgetEmpty, DeltaBadge, C } from "./widget-card";
import { cn } from "@/lib/utils";

const tone = (pct: number) =>
  pct >= 70 ? { text: "text-emerald-600 dark:text-emerald-400", bar: C.green }
  : pct >= 40 ? { text: "text-amber-600 dark:text-amber-400", bar: C.amber }
  : { text: "text-red-600 dark:text-red-400", bar: C.red };

export function CallsConversionWidget({ data, value, loading }: {
  data: ConversionResponse | null;
  value: ConversionValue | null;
  loading: boolean;
}) {
  if (loading) return <WidgetSkeleton />;

  if (!data) {
    return (
      <WidgetCard>
        <WidgetLabel>Конверсия звонок → запись</WidgetLabel>
        <WidgetEmpty icon={Repeat} text="Нет данных о конверсии" />
      </WidgetCard>
    );
  }

  const ops = [...data.operators].sort((a, b) => b.conversion_pct - a.conversion_pct);

  return (
    <WidgetCard>
      <WidgetLabel>Конверсия звонок → запись</WidgetLabel>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[30px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-blue-600 dark:text-blue-400">
          {formatPct(data.total.conversion_pct)}
        </span>
        {value && <DeltaBadge pct={value.deltaPct} dir={value.deltaDir} />}
      </div>
      <p className="mt-1 truncate text-[11px] text-text-3">
        {data.total.appointments.toLocaleString("ru-RU")} записей из {data.total.incoming.toLocaleString("ru-RU")} принятых
      </p>

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto border-t border-hairline pt-3">
        {ops.length === 0 && <p className="text-[11px] text-text-3">Нет операторов колл-центра</p>}
        {ops.map(op => {
          const t = tone(op.conversion_pct);
          return (
            <div key={op.operator_id} className="flex items-center gap-2">
              <span className="w-[38%] min-w-0 truncate text-[11px] text-text-2" title={op.name}>{op.surname || op.name}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(op.conversion_pct, 100)}%`, background: t.bar }} />
              </div>
              <span className={cn("w-11 shrink-0 text-right text-[11px] font-bold tabular-nums", t.text)}>
                {formatPct(op.conversion_pct)}
              </span>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
