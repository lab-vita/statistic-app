import { TrendingUp, TrendingDown } from "lucide-react";
import { DeltaDir } from "@/lib/api";

interface StatCardProps {
  title:        string;
  value:        string | number;
  sub?:         string;
  icon?:        React.ReactNode;
  accent?:      "green" | "blue" | "red" | "yellow" | "purple";
  deltaPct?:    number | null;
  deltaDir?:    DeltaDir;
  deltaInvert?: boolean;
  // План
  planValue?:  number | null;
  planLabel?:  string;
  planPct?:    number | null;
  planInvert?: boolean;
}

const ACCENTS = {
  green:  "text-emerald-500",
  blue:   "text-blue-500",
  red:    "text-red-500",
  yellow: "text-yellow-500",
  purple: "text-purple-500",
};

function Delta({ pct, dir, invert }: { pct: number | null | undefined; dir: DeltaDir; invert?: boolean }) {
  if (pct == null || dir == null || dir === "flat") {
    return <span className="text-[10px] text-muted-foreground">= без изменений</span>;
  }
  const isGood = invert ? dir === "down" : dir === "up";
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isGood ? "text-emerald-500" : "text-red-500"}`}>
      {dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {dir === "up" ? "+" : "−"}{pct}% к пред. периоду
    </span>
  );
}

function PlanBar({ pct, invert }: { pct: number; invert?: boolean }) {
  const clamped = Math.min(pct, 100);
  const isGood  = invert ? pct <= 100 : pct >= 80;
  const isMid   = !invert && pct >= 60 && pct < 80;
  const color   = isGood ? "bg-emerald-500" : isMid ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function StatCard({
  title, value, sub, icon, accent,
  deltaPct, deltaDir, deltaInvert,
  planValue, planLabel, planPct, planInvert,
}: StatCardProps) {
  const hasPlan = planPct != null && planValue != null && planValue > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 hover:border-foreground/20 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        {icon}
      </div>
      <div className={`text-2xl font-semibold tracking-tight font-mono ${accent ? ACCENTS[accent] : ""}`}>
        {value}
      </div>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}

      {hasPlan && (
        <div className="space-y-1 mt-0.5">
          <PlanBar pct={planPct!} invert={planInvert} />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{planLabel}</span>
            <span className={`text-[10px] font-medium ${
              planInvert
                ? planPct! <= 100 ? "text-emerald-500" : "text-red-500"
                : planPct! >= 80  ? "text-emerald-500"
                : planPct! >= 60  ? "text-yellow-500"
                : "text-red-500"
            }`}>
              {planPct}%
            </span>
          </div>
        </div>
      )}

      {deltaDir !== undefined && (
        <Delta pct={deltaPct} dir={deltaDir} invert={deltaInvert} />
      )}
    </div>
  );
}
