"use client";

import type { OperatorStats } from "@/lib/api";
import { formatPct, formatReaction } from "@/lib/call-metrics";
import { WidgetCard, WidgetLabel, WidgetSkeleton, DeltaBadge } from "./widget-card";
import { cn } from "@/lib/utils";

interface Item {
  key:      string;
  label:    string;
  value:    string;
  sub:      string;
  accent:   string;
  deltaPct: number | null;
  deltaDir: string | null;
  invert:   boolean;
}

function buildItems(s: OperatorStats | null): Item[] {
  const n = (v: number | undefined) => (v ?? 0).toLocaleString("ru-RU");
  return [
    {
      key: "incoming", label: "Принято",
      value: s ? n(s.incoming) : "—",
      sub: s ? `из ${n(s.received)} поступивших` : "",
      accent: "text-emerald-600 dark:text-emerald-400",
      deltaPct: s?.incoming_delta_pct ?? null, deltaDir: s?.incoming_delta_dir ?? null, invert: false,
    },
    {
      key: "lost", label: "Потеряно",
      value: s ? n(s.lost) : "—",
      sub: s ? `${formatPct(s.lost_pct)} от поступивших` : "",
      accent: "text-red-600 dark:text-red-400",
      deltaPct: s?.lost_delta_pct ?? null, deltaDir: s?.lost_delta_dir ?? null, invert: true,
    },
    {
      key: "reaction", label: "До перезвона",
      value: formatReaction(s?.avg_reaction_sec),
      sub: "среднее до первой попытки",
      accent: "text-amber-600 dark:text-amber-400",
      deltaPct: s?.avg_reaction_sec_delta_pct ?? null, deltaDir: s?.avg_reaction_sec_delta_dir ?? null, invert: true,
    },
  ];
}

export function CallsTrioWidget({ stats, loading }: { stats: OperatorStats | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;
  return (
    <WidgetCard className="px-0 py-0">
      <div className="grid h-full grid-cols-3">
        {buildItems(stats).map((item, i) => (
          <div key={item.key} className={cn("flex min-w-0 flex-col px-5 py-[18px]", i > 0 && "border-l border-hairline")}>
            <WidgetLabel>{item.label}</WidgetLabel>
            <p className={cn("mt-1.5 truncate text-[26px] font-extrabold leading-none tracking-[-0.04em] tabular-nums", item.accent)}>
              {item.value}
            </p>
            {item.sub && <p className="mt-1 truncate text-[11px] text-text-3">{item.sub}</p>}
            <div className="mt-auto pt-2">
              <DeltaBadge pct={item.deltaPct} dir={item.deltaDir} invert={item.invert} />
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
