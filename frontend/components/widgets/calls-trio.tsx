"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { OperatorStats } from "@/lib/api";
import { deltaIsGood, formatPct, formatReaction } from "@/lib/call-metrics";

interface Item {
  key:      string;
  label:    string;
  value:    string;
  sub:      string;
  from:     string;
  to:       string;
  deltaPct: number | null;
  deltaDir: string | null;
  /** рост — это плохо (цвет изменения переворачивается) */
  invert:   boolean;
}

/**
 * Три главных показателя работы колл-центра:
 *   Принято       — сколько клиентов дозвонились и получили ответ
 *   Потеряно      — сколько клиентов так и не были обслужены (не перезвонили или не дозвонились)
 *   До перезвона  — как быстро реагируем на пропущенные
 */
function buildItems(s: OperatorStats | null): Item[] {
  const n = (v: number | undefined) => (v ?? 0).toLocaleString("ru-RU");
  return [
    {
      key: "incoming", label: "Принято", value: n(s?.incoming),
      sub: s ? `из ${n(s.received)} поступивших` : "",
      from: "#2563eb", to: "#1d4ed8",
      deltaPct: s?.incoming_delta_pct ?? null, deltaDir: s?.incoming_delta_dir ?? null, invert: false,
    },
    {
      key: "lost", label: "Потеряно", value: n(s?.lost),
      sub: s ? `${formatPct(s.lost_pct)} от поступивших` : "",
      from: "#e11d48", to: "#be123c",
      deltaPct: s?.lost_delta_pct ?? null, deltaDir: s?.lost_delta_dir ?? null, invert: true,
    },
    {
      key: "reaction", label: "До перезвона", value: formatReaction(s?.avg_reaction_sec),
      sub: "среднее до первой попытки",
      from: "#f97316", to: "#ea580c",
      deltaPct: s?.avg_reaction_sec_delta_pct ?? null, deltaDir: s?.avg_reaction_sec_delta_dir ?? null, invert: true,
    },
  ];
}

function MetricBlock({ item }: { item: Item }) {
  const { label, value, sub, from, to, deltaPct, deltaDir, invert } = item;
  const good = deltaIsGood(deltaDir, invert);
  return (
    <div
      className="relative flex flex-col justify-between p-4 rounded-2xl overflow-hidden h-full"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {/* Декоративные круги */}
      <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -right-2 -bottom-6 h-24 w-24 rounded-full bg-white/5  pointer-events-none" />

      <div className="text-xs font-medium text-white/60 z-10">{label}</div>

      <div className="z-10 my-1">
        <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
        {sub && <div className="text-[11px] text-white/55 mt-0.5 truncate">{sub}</div>}
      </div>

      <div className="z-10">
        {deltaPct !== null && deltaDir && deltaDir !== "flat"
          ? <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
              good ? "text-emerald-200" : "text-red-200"
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
      {buildItems(stats).map(item => <MetricBlock key={item.key} item={item} />)}
    </div>
  );
}
