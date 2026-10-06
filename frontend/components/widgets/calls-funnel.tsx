"use client";
import { PhoneIncoming, TrendingUp, TrendingDown } from "lucide-react";
import { OperatorStats } from "@/lib/api";
import { deltaIsGood, formatPct } from "@/lib/call-metrics";

interface Seg {
  key:       string;
  label:     string;
  value:     number;
  dot:       string;   // цвет сегмента и точки в легенде
  note?:     string;
}

const n = (v: number) => v.toLocaleString("ru-RU");

/** Полоса из сегментов: ширина каждого пропорциональна значению (flex-grow). */
function SegBar({ segs, label }: { segs: Seg[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-3 gap-0.5 rounded-full overflow-hidden bg-white/10">
      {segs.filter(s => s.value > 0).map(s => (
        <div
          key={s.key}
          title={`${s.label}: ${n(s.value)}`}
          className={s.dot}
          style={{ flexGrow: s.value, flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

function Legend({ segs, total }: { segs: Seg[]; total: number }) {
  return (
    <>
      {segs.map(s => (
        <div key={s.key} className="flex items-center gap-1.5 text-[11px] min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
          <span className="text-white/70 truncate">{s.label}</span>
          <span className="ml-auto font-semibold text-white tabular-nums">
            {n(s.value)}
            {total > 0 && <span className="ml-1 font-normal text-white/45">{formatPct(s.value / total * 100)}</span>}
          </span>
        </div>
      ))}
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full rounded-2xl overflow-hidden p-4 flex flex-col gap-3 text-white
      bg-gradient-to-br from-indigo-700 to-slate-900">
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -right-3 -bottom-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
      {children}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2 z-10">
      <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
        <PhoneIncoming className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">Судьба звонков</div>
        <div className="text-[11px] text-white/55">что стало с каждым входящим</div>
      </div>
    </div>
  );
}

/**
 * «Судьба звонков»: сколько поступило, сколько из них пропущено и что стало с пропущенными.
 * Главная цифра — «Потеряно»: клиенты, которых так и не обслужили.
 */
export function CallsFunnelWidget({ stats, loading }: {
  stats: OperatorStats | null; loading: boolean;
}) {
  if (loading) return <div className="h-full rounded-2xl bg-muted/40 animate-pulse" />;

  const received = stats?.received ?? 0;
  if (!stats || received === 0) {
    return (
      <Shell>
        <Header />
        <div className="flex-1 flex items-center justify-center text-sm text-white/60 z-10">
          За период нет звонков
        </div>
      </Shell>
    );
  }

  const first: Seg[] = [
    { key: "accepted", label: "Принято",    value: stats.incoming, dot: "bg-sky-300"    },
    { key: "missed",   label: "Пропущено",  value: stats.missed,   dot: "bg-orange-300" },
  ];
  const fate: Seg[] = [
    { key: "reached", label: "Перезвонили, дозвонились",    value: stats.outcome_reached ?? 0, dot: "bg-emerald-300" },
    { key: "self",    label: "Клиент дозвонился сам",       value: stats.outcome_self    ?? 0, dot: "bg-teal-200"    },
    { key: "failed",  label: "Перезвонили, не дозвонились", value: stats.outcome_failed  ?? 0, dot: "bg-amber-300"   },
    { key: "none",    label: "Не перезвонили",              value: stats.outcome_none    ?? 0, dot: "bg-rose-400"    },
  ];

  const deltaDir = stats.lost_delta_dir ?? null;
  const deltaPct = stats.lost_delta_pct ?? null;
  const good = deltaIsGood(deltaDir, true);   // рост потерь — это плохо

  return (
    <Shell>
      <Header />

      {/* 1. Поступило → принято / пропущено */}
      <div className="z-10">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs text-white/60">Поступило</span>
          <span className="text-lg font-bold tabular-nums">{n(received)}</span>
        </div>
        <SegBar segs={first} label={`Принято ${stats.incoming}, пропущено ${stats.missed}`} />
        <div className="grid grid-cols-2 gap-x-4 mt-2">
          <Legend segs={first} total={received} />
        </div>
      </div>

      {/* 2. Что стало с пропущенными */}
      {stats.missed > 0 ? (
        <div className="z-10">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-white/60">Из пропущенных</span>
            <span className="text-sm font-semibold tabular-nums">{n(stats.missed)}</span>
          </div>
          <SegBar segs={fate} label="Судьба пропущенных звонков" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            <Legend segs={fate} total={stats.missed} />
          </div>
        </div>
      ) : (
        <div className="z-10 text-xs text-emerald-200">Пропущенных звонков нет</div>
      )}

      {/* 3. Итог */}
      <div className="z-10 mt-auto flex items-end justify-between border-t border-white/15 pt-3">
        <div>
          <div className="text-[11px] text-white/60">Потеряно</div>
          <div className="text-3xl font-bold tracking-tight tabular-nums">{n(stats.lost ?? 0)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">{formatPct(stats.lost_pct ?? 0)}</div>
          <div className="text-[11px] text-white/60">от поступивших</div>
          {deltaPct !== null && deltaDir && deltaDir !== "flat" && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-0.5 ${
              good ? "text-emerald-200" : "text-red-200"
            }`}>
              {deltaDir === "up" ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
              {deltaDir === "up" ? "+" : "−"}{deltaPct}%
            </span>
          )}
        </div>
      </div>
    </Shell>
  );
}
