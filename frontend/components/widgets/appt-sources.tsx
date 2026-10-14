"use client";

import { Share2 } from "lucide-react";
import type { AppointmentStatsResponse } from "@/lib/api";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, C } from "./widget-card";

const GROUPS = [
  { key: "callcenter", label: "Колл-центр",     color: C.blue   },
  { key: "admin",      label: "Администраторы", color: C.green  },
  { key: "other",      label: "Прочие",         color: C.violet },
  { key: "unknown",    label: "Не указан",      color: C.slate  },
];

export function ApptSourcesWidget({ data, loading }: { data: AppointmentStatsResponse | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;

  const rows = GROUPS
    .map(g => ({ ...g, item: data?.by_group?.[g.key] }))
    .filter(r => r.item && r.item.count > 0);

  return (
    <WidgetCard>
      <WidgetHeader
        title="Источники записей"
        right={data?.total ? (
          <span className="shrink-0 text-[11px] font-medium text-text-3">всего {data.total.total.toLocaleString("ru-RU")}</span>
        ) : undefined}
      />
      {rows.length === 0 ? (
        <WidgetEmpty icon={Share2} text="Нет данных об источниках" />
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {rows.map(r => (
            <div key={r.key}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-[7px] text-[12px] font-medium text-text-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.color }} />
                  {r.label}
                </span>
                <span className="text-[12px] tabular-nums">
                  <span className="font-bold">{r.item!.count.toLocaleString("ru-RU")}</span>
                  <span className="ml-1.5 text-[11px] text-text-3">{r.item!.pct}%</span>
                </span>
              </div>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(r.item!.pct, 100)}%`, background: r.color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
