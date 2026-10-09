"use client";

import { PhoneIncoming, TrendingUp, TrendingDown } from "lucide-react";
import { OperatorStats } from "@/lib/api";
import { deltaIsGood, formatPct } from "@/lib/call-metrics";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Seg { key: string; label: string; value: number; color: string }

const n = (v: number) => v.toLocaleString("ru-RU");

function SegBar({ segs, total }: { segs: Seg[]; total: number }) {
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-border gap-px">
      {segs.filter(s => s.value > 0).map(s => (
        <div
          key={s.key}
          className={cn("h-full transition-all", s.color)}
          style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%` }}
        />
      ))}
    </div>
  );
}

export function CallsFunnelWidget({ stats, loading }: {
  stats: OperatorStats | null; loading: boolean;
}) {
  if (loading) return <div className="h-full rounded-lg bg-muted/60 animate-pulse" />;

  const received = stats?.received ?? 0;

  if (!stats || received === 0) {
    return (
      <Card className="h-full flex items-center justify-center p-5">
        <div className="text-center">
          <PhoneIncoming className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[12px] text-muted-foreground/60">За период нет звонков</p>
        </div>
      </Card>
    );
  }

  const firstSegs: Seg[] = [
    { key: "accepted", label: "Принято",   value: stats.incoming, color: "bg-emerald-500" },
    { key: "missed",   label: "Пропущено", value: stats.missed,   color: "bg-amber-400"  },
  ];
  const fateSegs: Seg[] = [
    { key: "reached", label: "Перезвонили, дозвонились",    value: stats.outcome_reached ?? 0, color: "bg-emerald-500" },
    { key: "self",    label: "Клиент дозвонился сам",       value: stats.outcome_self    ?? 0, color: "bg-blue-400"    },
    { key: "failed",  label: "Перезвонили, не дозвонились", value: stats.outcome_failed  ?? 0, color: "bg-amber-400"   },
    { key: "none",    label: "Не перезвонили",              value: stats.outcome_none    ?? 0, color: "bg-red-500"     },
  ];

  const deltaDir = stats.lost_delta_dir ?? null;
  const deltaPct = stats.lost_delta_pct ?? null;
  const good     = deltaIsGood(deltaDir, true);

  return (
    <Card className="h-full flex flex-col p-5 gap-4">
      {/* Заголовок */}
      <div className="flex items-center gap-2">
        <PhoneIncoming className="h-4 w-4 text-muted-foreground/60" />
        <div>
          <p className="text-[13px] font-semibold leading-none">Судьба звонков</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">что стало с каждым входящим</p>
        </div>
      </div>

      {/* Поступило */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] text-muted-foreground/60">Поступило</span>
          <span className="text-[18px] font-semibold tabular-nums">{n(received)}</span>
        </div>
        <SegBar segs={firstSegs} total={received} />
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {firstSegs.map(s => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full shrink-0", s.color)} />
              <span className="text-[11px] text-muted-foreground/70 truncate">{s.label}</span>
              <span className="ml-auto text-[11px] font-medium tabular-nums">
                {n(s.value)}
                {received > 0 && (
                  <span className="ml-1 text-muted-foreground/50">{formatPct(s.value / received * 100)}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Пропущенные */}
      {stats.missed > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[11px] text-muted-foreground/60">Из пропущенных</span>
            <span className="text-[13px] font-medium tabular-nums">{n(stats.missed)}</span>
          </div>
          <SegBar segs={fateSegs} total={stats.missed} />
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {fateSegs.map(s => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full shrink-0", s.color)} />
                <span className="text-[11px] text-muted-foreground/70 truncate">{s.label}</span>
                <span className="ml-auto text-[11px] font-medium tabular-nums">
                  {n(s.value)}
                  {stats.missed > 0 && (
                    <span className="ml-1 text-muted-foreground/50">{formatPct(s.value / stats.missed * 100)}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Итог */}
      <div className="mt-auto pt-3 border-t border-border flex items-end justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground/60 mb-0.5">Потеряно</p>
          <p className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-red-600 dark:text-red-400">
            {n(stats.lost ?? 0)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-semibold tabular-nums">{formatPct(stats.lost_pct ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground/60">от поступивших</p>
          {deltaPct !== null && deltaDir && deltaDir !== "flat" && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium mt-1",
              good ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                   : "bg-red-500/10 text-red-600 dark:text-red-400"
            )}>
              {deltaDir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {deltaDir === "up" ? "+" : "−"}{deltaPct}%
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
