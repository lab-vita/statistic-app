import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DeltaDir } from "@/lib/api";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "green" | "blue" | "red" | "yellow" | "purple";
  deltaPct?: number | null;
  deltaDir?: DeltaDir;
  deltaInvert?: boolean;
  planValue?: number | null;
  planLabel?: string;
  planPct?: number | null;
  planInvert?: boolean;
}

const ACCENT_TEXT: Record<string, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  red: "text-red-500 dark:text-red-400",
  yellow: "text-amber-600 dark:text-amber-400",
  purple: "text-violet-600 dark:text-violet-400",
};

const ACCENT_ICON_BG: Record<string, string> = {
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  red: "bg-red-500/10 text-red-500",
  yellow: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

function Delta({
  pct,
  dir,
  invert,
}: {
  pct: number | null | undefined;
  dir: DeltaDir;
  invert?: boolean;
}) {
  if (pct == null || dir == null || dir === "flat") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        без изменений
      </span>
    );
  }
  const isGood = invert ? dir === "down" : dir === "up";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isGood
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 dark:text-red-400",
      )}
    >
      {dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {dir === "up" ? "+" : "−"}
      {pct}% к пред. периоду
    </span>
  );
}

function PlanBar({ pct, invert }: { pct: number; invert?: boolean }) {
  const clamped = Math.min(pct, 100);
  const isGood = invert ? pct <= 100 : pct >= 80;
  const isMid = !invert && pct >= 60 && pct < 80;
  const color = isGood ? "bg-emerald-500" : isMid ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function StatCard({
  title,
  value,
  sub,
  icon,
  accent,
  deltaPct,
  deltaDir,
  deltaInvert,
  planValue,
  planLabel,
  planPct,
  planInvert,
}: StatCardProps) {
  const hasPlan = planPct != null && planValue != null && planValue > 0;

  return (
    <Card className="flex flex-col gap-3 p-5 transition-all duration-200 hover:border-border hover:shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        {icon && (
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              accent ? ACCENT_ICON_BG[accent] : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {/* Value */}
      <div className={cn("text-[28px] font-semibold leading-none tracking-tight tabular-nums", accent ? ACCENT_TEXT[accent] : "text-foreground")}>
        {value}
      </div>

      {sub && <p className="text-xs leading-none text-muted-foreground">{sub}</p>}

      {/* Plan progress */}
      {hasPlan && (
        <div className="space-y-1.5 pt-1">
          <PlanBar pct={planPct!} invert={planInvert} />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{planLabel}</span>
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                planInvert
                  ? planPct! <= 100
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500"
                  : planPct! >= 80
                    ? "text-emerald-600 dark:text-emerald-400"
                    : planPct! >= 60
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-500",
              )}
            >
              {planPct}%
            </span>
          </div>
        </div>
      )}

      {/* Delta */}
      {deltaDir !== undefined && (
        <div className="pt-1">
          <Delta pct={deltaPct} dir={deltaDir} invert={deltaInvert} />
        </div>
      )}
    </Card>
  );
}
