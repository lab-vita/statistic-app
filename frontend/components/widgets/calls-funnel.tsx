"use client";

import { PhoneIncoming } from "lucide-react";
import type { OperatorStats } from "@/lib/api";
import { formatPct } from "@/lib/call-metrics";
import {
  WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, DeltaBadge, SegmentBar, LegendRow, C,
} from "./widget-card";

const n = (v: number) => v.toLocaleString("ru-RU");
const share = (v: number, total: number) => (total > 0 ? formatPct((v / total) * 100) : "");

export function CallsFunnelWidget({ stats, loading }: { stats: OperatorStats | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;

  const received = stats?.received ?? 0;
  if (!stats || received === 0) {
    return (
      <WidgetCard>
        <WidgetHeader title="Судьба звонков" />
        <WidgetEmpty icon={PhoneIncoming} text="За период нет звонков" />
      </WidgetCard>
    );
  }

  const first = [
    { key: "accepted", label: "Принято",   value: stats.incoming, color: C.green },
    { key: "missed",   label: "Пропущено", value: stats.missed,   color: C.amber },
  ];
  const fate = [
    { key: "reached", label: "Перезвонили, дозвонились",    value: stats.outcome_reached ?? 0, color: C.green },
    { key: "self",    label: "Клиент дозвонился сам",       value: stats.outcome_self    ?? 0, color: C.blue  },
    { key: "failed",  label: "Перезвонили, не дозвонились", value: stats.outcome_failed  ?? 0, color: C.amber },
    { key: "none",    label: "Не перезвонили",              value: stats.outcome_none    ?? 0, color: C.red   },
  ];

  return (
    <WidgetCard>
      <WidgetHeader title="Судьба звонков" meta={`${n(received)} поступило`} />

      <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-3.5">
      <div className="space-y-2">
        <SegmentBar segments={first} total={received} />
        <div className="grid grid-cols-1 gap-x-5 gap-y-1 @[26rem]:grid-cols-2">
          {first.map(s => (
            <LegendRow key={s.key} color={s.color} label={s.label} value={n(s.value)} share={share(s.value, received)} />
          ))}
        </div>
      </div>

      {stats.missed > 0 && (
        <div className="space-y-2 border-t border-hairline pt-3.5">
          <p className="text-[11px] font-medium text-text-3">Из {n(stats.missed)} пропущенных</p>
          <SegmentBar segments={fate} total={stats.missed} />
          <div className="grid grid-cols-1 gap-x-5 gap-y-1 @[26rem]:grid-cols-2">
            {fate.map(s => (
              <LegendRow key={s.key} color={s.color} label={s.label} value={n(s.value)} share={share(s.value, stats.missed)} />
            ))}
          </div>
        </div>
      )}
      </div>

      <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-hairline pt-3.5">
        <div>
          <p className="metric-label mb-1">Потеряно навсегда</p>
          <p className="text-[30px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-red-600 dark:text-red-400">
            {n(stats.lost ?? 0)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <p className="text-[15px] font-bold tabular-nums">{formatPct(stats.lost_pct ?? 0)}</p>
          <p className="text-[11px] text-text-3">от поступивших</p>
          <DeltaBadge pct={stats.lost_delta_pct} dir={stats.lost_delta_dir} invert />
        </div>
      </div>
    </WidgetCard>
  );
}
