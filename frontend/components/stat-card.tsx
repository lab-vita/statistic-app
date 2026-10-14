import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DeltaDir } from "@/lib/api";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title:        string;
  value:        string | number;
  sub?:         string;
  icon?:        React.ReactNode;
  valueColor?:  string;
  accent?:      "green" | "blue" | "red" | "yellow" | "purple";
  deltaPct?:    number | null;
  deltaDir?:    DeltaDir;
  deltaInvert?: boolean;
  planValue?:   number | null;
  planPct?:     number | null;
  planLabel?:   string;
  planInvert?:  boolean;
}

const ACCENT_VALUE: Record<string, string> = {
  green:  "text-emerald-600 dark:text-emerald-400",
  blue:   "text-blue-600 dark:text-blue-400",
  red:    "text-red-600 dark:text-red-400",
  yellow: "text-amber-600 dark:text-amber-400",
  purple: "text-violet-600 dark:text-violet-400",
};

function Delta({ pct, dir, invert }: { pct?: number | null; dir?: DeltaDir; invert?: boolean }) {
  if (!dir || dir === "flat" || pct == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />без изменений
      </span>
    );
  }
  const good = invert ? dir === "down" : dir === "up";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
      good
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-red-500/10 text-red-600 dark:text-red-400"
    )}>
      {dir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

function Bar({ pct, invert }: { pct: number; invert?: boolean }) {
  const c    = Math.min(pct, 100);
  const good = invert ? pct <= 100 : pct >= 80;
  const mid  = !invert && pct >= 60 && pct < 80;
  return (
    <div className="h-1 w-full rounded-full bg-border overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500",
          good ? "bg-emerald-500" : mid ? "bg-amber-500" : "bg-red-500"
        )}
        style={{ width: `${c}%` }}
      />
    </div>
  );
}

export function StatCard({
  title, value, sub, icon, valueColor, accent,
  deltaPct, deltaDir, deltaInvert,
  planValue, planPct, planLabel, planInvert,
}: StatCardProps) {
  const color = valueColor ?? (accent ? ACCENT_VALUE[accent] : "text-foreground");
  const hasPlan = planPct != null && (planValue == null || planValue > 0);

  return (
    <Card className="flex flex-col p-5 gap-0 transition-all duration-150 hover:border-foreground/20">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3">
          {title}
        </span>
        {icon && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground/60">
            {icon}
          </span>
        )}
      </div>

      <div className={cn("text-[26px] font-extrabold leading-none tracking-[-0.04em] tabular-nums mb-1", color)}>
        {value}
      </div>

      {sub && <p className="text-[11px] text-muted-foreground/60 leading-none">{sub}</p>}

      {hasPlan && (
        <div className="mt-3 space-y-1.5">
          <Bar pct={planPct!} invert={planInvert} />
          <div className="flex justify-between">
            {planLabel && <span className="text-[11px] text-muted-foreground/60">{planLabel}</span>}
            <span className={cn("text-[11px] font-semibold tabular-nums ml-auto",
              planInvert
                ? planPct! <= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                : planPct! >= 80  ? "text-emerald-600 dark:text-emerald-400"
                : planPct! >= 60  ? "text-amber-600 dark:text-amber-400"
                : "text-red-500"
            )}>{planPct}%</span>
          </div>
        </div>
      )}

      {deltaDir !== undefined && (
        <div className="mt-3">
          <Delta pct={deltaPct} dir={deltaDir} invert={deltaInvert} />
        </div>
      )}
    </Card>
  );
}