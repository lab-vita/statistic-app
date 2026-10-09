"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { OperatorStats } from "@/lib/api";
import { deltaIsGood, formatPct, formatReaction } from "@/lib/call-metrics";
import { Card } from "@/components/ui/card";
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
      value: n(s?.incoming),
      sub: s ? `из ${n(s.received)} поступивших` : "",
      accent: "text-emerald-600 dark:text-emerald-400",
      deltaPct: s?.incoming_delta_pct ?? null,
      deltaDir: s?.incoming_delta_dir ?? null,
      invert: false,
    },
    {
      key: "lost", label: "Потеряно",
      value: n(s?.lost),
      sub: s ? `${formatPct(s.lost_pct)} от поступивших` : "",
      accent: "text-red-600 dark:text-red-400",
      deltaPct: s?.lost_delta_pct ?? null,
      deltaDir: s?.lost_delta_dir ?? null,
      invert: true,
    },
    {
      key: "reaction", label: "До перезвона",
      value: formatReaction(s?.avg_reaction_sec),
      sub: "среднее до первой попытки",
      accent: "text-amber-600 dark:text-amber-400",
      deltaPct: s?.avg_reaction_sec_delta_pct ?? null,
      deltaDir: s?.avg_reaction_sec_delta_dir ?? null,
      invert: true,
    },
  ];
}

function MetricCard({ item }: { item: Item }) {
  const { label, value, sub, accent, deltaPct, deltaDir, invert } = item;
  const good = deltaIsGood(deltaDir, invert);
  return (
    <Card className="flex flex-col justify-between p-5 h-full">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">
        {label}
      </span>
      <div className={cn("text-[26px] font-semibold leading-none tracking-tight tabular-nums mb-1", accent)}>
        {value}
      </div>
      {sub && <p className="text-[11px] text-muted-foreground/60 mb-0">{sub}</p>}
      <div className="mt-3">
        {deltaPct !== null && deltaDir && deltaDir !== "flat" ? (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
            good ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                 : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}>
            {deltaDir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {deltaDir === "up" ? "+" : "−"}{deltaPct}%
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
            <Minus className="h-3 w-3" />без изменений
          </span>
        )}
      </div>
    </Card>
  );
}

export function CallsTrioWidget({ stats, loading }: {
  stats: OperatorStats | null; loading: boolean;
}) {
  if (loading) return (
    <div className="h-full grid grid-cols-3 gap-3">
      {[0,1,2].map(i => <div key={i} className="rounded-lg bg-muted/60 animate-pulse" />)}
    </div>
  );
  return (
    <div className="h-full grid grid-cols-3 gap-3">
      {buildItems(stats).map(item => <MetricCard key={item.key} item={item} />)}
    </div>
  );
}
