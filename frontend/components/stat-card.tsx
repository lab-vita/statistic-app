import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { DeltaDir } from "@/lib/api";

interface StatCardProps {
  title:   string;
  value:   string | number;
  sub?:    string;
  icon?:   React.ReactNode;
  accent?: "green" | "blue" | "red" | "yellow" | "purple";
  // Дельта vs предыдущий период
  deltaPct?: number | null;
  deltaDir?: DeltaDir;
  // Для пропущенных — инвертируем смысл (рост = плохо)
  deltaInvert?: boolean;
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

  // Инвертируем цвет если рост метрики — это плохо (пропущенные)
  const isGood = invert ? dir === "down" : dir === "up";
  const colorClass = isGood ? "text-emerald-500" : "text-red-500";

  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${colorClass}`}>
      {dir === "up"
        ? <TrendingUp className="h-3 w-3" />
        : <TrendingDown className="h-3 w-3" />
      }
      {dir === "up" ? "+" : "−"}{pct}% к пред. периоду
    </span>
  );
}

export function StatCard({ title, value, sub, icon, accent, deltaPct, deltaDir, deltaInvert }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 hover:border-foreground/20 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        {icon}
      </div>
      <div className={`text-2xl font-semibold tracking-tight font-mono ${accent ? ACCENTS[accent] : ""}`}>
        {value}
      </div>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
      {deltaDir !== undefined && (
        <Delta pct={deltaPct} dir={deltaDir} invert={deltaInvert} />
      )}
    </div>
  );
}
