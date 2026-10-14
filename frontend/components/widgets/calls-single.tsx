"use client";

import type { DailyItem, OperatorStats } from "@/lib/api";
import { formatPct, formatReaction, type ConversionValue } from "@/lib/call-metrics";
import { SparkLine } from "@/components/ui/primitives";
import { WidgetCard, WidgetLabel, WidgetSkeleton, DeltaBadge, C } from "./widget-card";
import { cn } from "@/lib/utils";

export type { ConversionValue };

export type CallsSingleMetric =
  | "incoming" | "received" | "outgoing" | "missed" | "missed_pct"
  | "lost" | "lost_pct" | "reaction" | "callback_count" | "callback_pct"
  | "avg_duration" | "conversion";

type Format = "number" | "percent" | "duration" | "minutes";

export const CALLS_SINGLE_METRICS: {
  key:    CallsSingleMetric;
  label:  string;
  hint?:  string;
  format: Format;
}[] = [
  { key: "incoming",       label: "Принятые",           hint: "отвеченные входящие",               format: "number"   },
  { key: "received",       label: "Поступило",          hint: "принятые + пропущенные",            format: "number"   },
  { key: "outgoing",       label: "Исходящие",          hint: "совершённые звонки",                format: "number"   },
  { key: "missed",         label: "Пропущенные",        hint: "без ответа",                        format: "number"   },
  { key: "missed_pct",     label: "% пропущенных",      hint: "от поступивших звонков",            format: "percent"  },
  { key: "lost",           label: "Потеряно клиентов",  hint: "не перезвонили или не дозвонились", format: "number"   },
  { key: "lost_pct",       label: "% потерь",           hint: "потеряно от поступивших",           format: "percent"  },
  { key: "reaction",       label: "До перезвона",       hint: "среднее до первой попытки",         format: "minutes"  },
  { key: "callback_count", label: "Перезвонили",        hint: "из пропущенных, за 24 часа",        format: "number"   },
  { key: "callback_pct",   label: "% перезвонили",      hint: "от пропущенных",                    format: "percent"  },
  { key: "avg_duration",   label: "Ср. длительность",   hint: "успешные звонки",                   format: "duration" },
  { key: "conversion",     label: "Конверсия → запись", hint: "записи ÷ принятые, колл-центр",     format: "percent"  },
];

const BAD_WHEN_UP = new Set<CallsSingleMetric>(["missed", "missed_pct", "lost", "lost_pct", "reaction"]);

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
  conversion:     "text-blue-600 dark:text-blue-400",
};

/** Метрики, для которых есть ряд по дням — рисуем мини-график. */
const SPARK: Partial<Record<CallsSingleMetric, { key: keyof DailyItem; color: string }>> = {
  incoming: { key: "incoming", color: C.green },
  received: { key: "received", color: C.blue },
  outgoing: { key: "outgoing", color: C.blue },
  missed:   { key: "missed",   color: C.red },
  lost:     { key: "lost",     color: C.red },
};

type Val = { value: number | null; deltaPct: number | null; deltaDir: string | null };

function getValue(stats: OperatorStats | null, metric: CallsSingleMetric, conversion?: ConversionValue | null): Val {
  const none: Val = { value: null, deltaPct: null, deltaDir: null };
  if (metric === "conversion") return conversion ?? none;
  if (!stats) return none;
  switch (metric) {
    case "incoming":       return { value: stats.incoming,         deltaPct: stats.incoming_delta_pct,                 deltaDir: stats.incoming_delta_dir };
    case "received":       return { value: stats.received,         deltaPct: stats.received_delta_pct,                 deltaDir: stats.received_delta_dir };
    case "outgoing":       return { value: stats.outgoing,         deltaPct: stats.outgoing_delta_pct,                 deltaDir: stats.outgoing_delta_dir };
    case "missed":         return { value: stats.missed,           deltaPct: stats.missed_delta_pct,                   deltaDir: stats.missed_delta_dir };
    case "missed_pct":     return { value: stats.missed_pct,       deltaPct: stats.missed_pct_delta_pct ?? null,       deltaDir: stats.missed_pct_delta_dir ?? null };
    case "lost":           return { value: stats.lost,             deltaPct: stats.lost_delta_pct ?? null,             deltaDir: stats.lost_delta_dir ?? null };
    case "lost_pct":       return { value: stats.lost_pct,         deltaPct: stats.lost_pct_delta_pct ?? null,         deltaDir: stats.lost_pct_delta_dir ?? null };
    case "reaction":       return { value: stats.avg_reaction_sec, deltaPct: stats.avg_reaction_sec_delta_pct ?? null, deltaDir: stats.avg_reaction_sec_delta_dir ?? null };
    case "callback_count": return { value: stats.callback_count,   deltaPct: stats.callback_count_delta_pct ?? null,   deltaDir: stats.callback_count_delta_dir ?? null };
    case "callback_pct":   return { value: stats.callback_pct,     deltaPct: stats.callback_pct_delta_pct ?? null,     deltaDir: stats.callback_pct_delta_dir ?? null };
    case "avg_duration":   return { value: stats.avg_duration,     deltaPct: stats.avg_duration_delta_pct,             deltaDir: stats.avg_duration_delta_dir };
    default:               return none;
  }
}

function formatValue(value: number, format: Format): string {
  if (format === "percent")  return formatPct(value);
  if (format === "minutes")  return formatReaction(value);
  if (format === "duration") {
    const m = Math.floor(value / 60), s = Math.round(value % 60);
    return m > 0 ? `${m}м ${s}с` : `${s}с`;
  }
  return value.toLocaleString("ru-RU");
}

interface Props {
  stats:       OperatorStats | null;
  loading:     boolean;
  metric?:     CallsSingleMetric;
  conversion?: ConversionValue | null;
  daily?:      DailyItem[];
}

export function CallsSingleWidget({ stats, loading, metric = "incoming", conversion, daily }: Props) {
  if (loading) return <WidgetSkeleton />;

  const def = CALLS_SINGLE_METRICS.find(m => m.key === metric) ?? CALLS_SINGLE_METRICS[0];
  const { value, deltaPct, deltaDir } = getValue(stats, def.key, conversion);
  const spark = SPARK[def.key];
  const series = spark && daily && daily.length > 1 ? daily.map(d => Number(d[spark.key]) || 0) : null;

  return (
    <WidgetCard>
      <div className="flex items-start justify-between gap-2">
        <WidgetLabel className="pt-0.5">{def.label}</WidgetLabel>
        {series && <div className="-mt-1 shrink-0"><SparkLine values={series} color={spark!.color} width={72} height={28} /></div>}
      </div>
      <p className={cn(
        "mt-1.5 truncate text-[30px] font-extrabold leading-none tracking-[-0.04em] tabular-nums",
        value === null ? "text-text-3" : ACCENT[def.key],
      )}>
        {value !== null ? formatValue(value, def.format) : "—"}
      </p>
      {def.hint && <p className="mt-1 truncate text-[11px] text-text-3">{def.hint}</p>}
      <div className="mt-auto pt-2">
        <DeltaBadge pct={deltaPct} dir={deltaDir} invert={BAD_WHEN_UP.has(def.key)} />
      </div>
    </WidgetCard>
  );
}
