"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { OperatorStats } from "@/lib/api";

const ITEMS = [
  {
    key:      "incoming" as const,
    label:    "Входящие",
    from:     "#2563eb", to: "#1d4ed8",
    deltaK:   "incoming_delta",
  },
  {
    key:      "missed" as const,
    label:    "Пропущенные",
    from:     "#dc2626", to: "#b91c1c",
    deltaK:   "missed_delta",
  },
  {
    key:      "outgoing" as const,
    label:    "Исходящие",
    from:     "#7c3aed", to: "#6d28d9",
    deltaK:   "outgoing_delta",
  },
];

function MetricBlock({ label, value, from, to, deltaPct, deltaDir }: {
  label: string; value: string;
  from: string; to: string;
  deltaPct: number|null; deltaDir: string|null;
}) {
  return (
    <div
      className="relative flex flex-col justify-between p-4 rounded-2xl overflow-hidden h-full"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {/* Декоративные круги */}
      <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -right-2 -bottom-6 h-24 w-24 rounded-full bg-white/5  pointer-events-none" />

      {/* Метка */}
      <div className="text-xs font-medium text-white/60 z-10">{label}</div>

      {/* Значение */}
      <div className="text-3xl font-bold text-white tracking-tight z-10 my-2">{value}</div>

      {/* Дельта */}
      <div className="z-10">
        {deltaPct !== null && deltaDir && deltaDir !== "flat"
          ? <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
              deltaDir === "up" ? "text-emerald-200" : "text-red-200"
            }`}>
              {deltaDir === "up"
                ? <TrendingUp className="h-3 w-3"/>
                : <TrendingDown className="h-3 w-3"/>}
              {deltaDir === "up" ? "+" : "−"}{deltaPct}%
            </span>
          : <span className="inline-flex items-center gap-1 text-xs text-white/30">
              <Minus className="h-3 w-3"/> —
            </span>
        }
      </div>
    </div>
  );
}

export function CallsTrioWidget({ stats, loading }: {
  stats: OperatorStats|null; loading: boolean;
}) {
  if (loading) return <div className="h-full rounded-2xl bg-muted/40 animate-pulse" />;

  return (
    <div className="h-full grid grid-cols-3 gap-3">
      {ITEMS.map(item => {
        const value    = (stats?.[item.key] ?? 0).toLocaleString("ru-RU");
        const deltaPct = (stats as any)?.[`${item.deltaK}_pct`] ?? null;
        const deltaDir = (stats as any)?.[`${item.deltaK}_dir`] ?? null;
        return (
          <MetricBlock
            key={item.key}
            label={item.label}
            value={value}
            from={item.from}
            to={item.to}
            deltaPct={deltaPct}
            deltaDir={deltaDir}
          />
        );
      })}
    </div>
  );
}