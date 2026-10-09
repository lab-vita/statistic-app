"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { OperatorStats } from "@/lib/api";
import { deltaIsGood, formatPct, formatReaction, noDeltaLabel, type ConversionValue } from "@/lib/call-metrics";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type { ConversionValue };

export type CallsSingleMetric =
  | "incoming" | "received" | "outgoing" | "missed" | "missed_pct"
  | "lost" | "lost_pct" | "reaction" | "callback_count" | "callback_pct"
  | "avg_duration" | "conversion";

export const CALLS_SINGLE_METRICS: {
  key:    CallsSingleMetric;
  label:  string;
  hint?:  string;
  format: "number" | "percent" | "duration" | "minutes";
}[] = [
  { key: "incoming",       label: "Принятые",           hint: "отвеченные входящие",            format: "number"   },
  { key: "received",       label: "Поступило",          hint: "принятые + пропущенные",         format: "number"   },
  { key: "outgoing",       label: "Исходящие",                                                   format: "number"   },
  { key: "missed",         label: "Пропущенные",                                                 format: "number"   },
  { key: "missed_pct",     label: "% пропущенных",      hint: "от поступивших звонков",         format: "percent"  },
  { key: "lost",           label: "Потеряно",           hint: "не перезвонили или не дозвонились", format: "number" },
  { key: "lost_pct",       label: "% потерь",           hint: "потеряно от поступивших",        format: "percent"  },
  { key: "reaction",       label: "До перезвона",       hint: "среднее до первой попытки",      format: "minutes"  },
  { key: "callback_count", label: "Перезвонили",        hint: "из пропущенных, за 24 часа",     format: "number"   },
  { key: "callback_pct",   label: "% перезвонили",      hint: "от пропущенных",                 format: "percent"  },
  { key: "avg_duration",   label: "Ср. длительность",                                            format: "duration" },
  { key: "conversion",     label: "Конверсия → запись", hint: "записи ÷ принятые, колл-центр",  format: "percent"  },
];

const BAD_WHEN_UP = new Set<CallsSingleMetric>(["missed","missed_pct","lost","lost_pct","reaction"]);

const ACCENT: Record<CallsSingleMetric, string> = {
  incoming:       "text-emerald-600 dark:text-emerald-400",
  received:       "text-foreground",
  outgoing:       "text-blue-600 dark:text-blue-400",
  missed:         "text-red-600 dark:text-red-400",
  missed_pct:     "text-red-600 dark:text-red-400",
  lost:           "text-red-600 dark:text-red-400",
  lost_pct:       "text-red-600 dark:text-red-400",
  reaction:       "text-amber-600 dark:text-amber-400",
  callback_count: "text-emerald-600 dark:text-emerald-400",
  callback_pct:   "text-emerald-600 dark:text-emerald-400",
  avg_duration:   "text-foreground",
  conversion:     "text-emerald-600 dark:text-emerald-400",
};

function getValue(stats: OperatorStats | null, metric: CallsSingleMetric, conversion?: ConversionValue | null) {
  if (!stats) return { value: null, deltaPct: null, deltaDir: null };
  switch (metric) {
    case "incoming":       return { value: stats.incoming,        deltaPct: stats.incoming_delta_pct,        deltaDir: stats.incoming_delta_dir };
    case "received":       return { value: stats.received,        deltaPct: stats.received_delta_pct,        deltaDir: stats.received_delta_dir };
    case "outgoing":       return { value: stats.outgoing,        deltaPct: stats.outgoing_delta_pct,        deltaDir: stats.outgoing_delta_dir };
    case "missed":         return { value: stats.missed,          deltaPct: stats.missed_delta_pct,          deltaDir: stats.missed_delta_dir };
    case "missed_pct":     return { value: stats.missed_pct,      deltaPct: stats.missed_pct_delta_pct ?? null, deltaDir: stats.missed_pct_delta_dir ?? null };
    case "lost":           return { value: stats.lost,            deltaPct: stats.lost_delta_pct ?? null,    deltaDir: stats.lost_delta_dir ?? null };
    case "lost_pct":       return { value: stats.lost_pct,        deltaPct: stats.lost_pct_delta_pct ?? null, deltaDir: stats.lost_pct_delta_dir ?? null };
    case "reaction":       return { value: stats.avg_reaction_sec,deltaPct: stats.avg_reaction_sec_delta_pct ?? null, deltaDir: stats.avg_reaction_sec_delta_dir ?? null };
    case "callback_count": return { value: stats.callback_count,  deltaPct: stats.callback_count_delta_pct ?? null, deltaDir: stats.callback_count_delta_dir ?? null };
    case "callback_pct":   return { value: stats.callback_pct,    deltaPct: stats.callback_pct_delta_pct ?? null, deltaDir: stats.callback_pct_delta_dir ?? null };
    case "avg_duration":   return { value: stats.avg_duration,    deltaPct: stats.avg_duration_delta_pct,   deltaDir: stats.avg_duration_delta_dir };
    case "conversion":     return conversion ?? { value: null, deltaPct: null, deltaDir: null };
    default:               return { value: null, deltaPct: null, deltaDir: null };
  }
}

function formatValue(value: number, format: "number" | "percent" | "duration" | "minutes"): string {
  if (format === "percent")  return formatPct(value);
  if (format === "minutes")  return formatReaction(value);
  if (format === "duration") {
    const m = Math.floor(value / 60), s = Math.round(value % 60);
    return m > 0 ? `${m}м ${s}с` : `${s}с`;
  }
  return value.toLocaleString("ru-RU");
}

interface Props {
  stats:      OperatorStats | null;
  loading:    boolean;
  metric?:    CallsSingleMetric;
  conversion?: ConversionValue | null;
}

export function CallsSingleWidget({ stats, loading, metric = "incoming", conversion }: Props) {
  if (loading) return <div className="h-full rounded-lg bg-muted/60 animate-pulse" />;

  const def   = CALLS_SINGLE_METRICS.find(m => m.key === metric)!;
  const { value, deltaPct, deltaDir } = getValue(stats, metric, conversion);
  const good  = deltaIsGood(deltaDir, BAD_WHEN_UP.has(metric));
  const display = value !== null ? formatValue(value, def.format) : "—";

  return (
    <Card className="h-full flex flex-col justify-between p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {def.label}
        </span>
      </div>

      <div className={cn("text-[28px] font-semibold leading-none tracking-tight tabular-nums mb-1", ACCENT[metric])}>
        {display}
      </div>

      {def.hint && (
        <p className="text-[11px] text-muted-foreground/60 mb-0">{def.hint}</p>
      )}

      <div className="mt-3">
        {deltaPct !== null && deltaDir && deltaDir !== "flat" ? (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
            good
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}>
            {deltaDir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {deltaDir === "up" ? "+" : "−"}{deltaPct}%
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
            <Minus className="h-3 w-3" />{noDeltaLabel(deltaPct, deltaDir)}
          </span>
        )}
      </div>
    </Card>
  );
}
