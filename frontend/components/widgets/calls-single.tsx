"use client";
import { Phone, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { OperatorStats } from "@/lib/api";
import { deltaIsGood, formatPct, noDeltaLabel, type ConversionValue } from "@/lib/call-metrics";

export type { ConversionValue };

export type CallsSingleMetric =
  | "incoming"
  | "received"
  | "outgoing"
  | "missed"
  | "missed_pct"
  | "callback_count"
  | "callback_pct"
  | "avg_duration"
  | "conversion";

export const CALLS_SINGLE_METRICS: {
  key: CallsSingleMetric;
  label: string;
  /** Пояснение под названием: что именно считается. */
  hint?: string;
  format: "number" | "percent" | "duration";
}[] = [
  { key: "incoming",       label: "Принятые",          hint: "отвеченные входящие",           format: "number"  },
  { key: "received",       label: "Поступило",         hint: "принятые + пропущенные",        format: "number"  },
  { key: "outgoing",       label: "Исходящие",                                                format: "number"  },
  { key: "missed",         label: "Пропущенные",                                              format: "number"  },
  { key: "missed_pct",     label: "% пропущенных",     hint: "от поступивших звонков",        format: "percent" },
  { key: "callback_count", label: "Перезвонили",       hint: "из пропущенных, за 24 часа",    format: "number"  },
  { key: "callback_pct",   label: "% перезвонили",     hint: "от пропущенных",                format: "percent" },
  { key: "avg_duration",   label: "Ср. длительность",                                         format: "duration"},
  { key: "conversion",     label: "Конверсия → запись",hint: "записи ÷ принятые, колл-центр", format: "percent" },
];

/** Метрики, у которых рост — это плохо (цвет изменения переворачивается). */
const BAD_WHEN_UP = new Set<CallsSingleMetric>(["missed", "missed_pct"]);


// Цвета градиента по метрике
const GRADIENT: Record<CallsSingleMetric, string> = {
  incoming:       "from-blue-600 to-blue-700",
  received:       "from-cyan-600 to-cyan-700",
  outgoing:       "from-violet-600 to-violet-700",
  missed:         "from-rose-600 to-rose-700",
  missed_pct:     "from-rose-500 to-red-700",
  callback_count: "from-teal-600 to-teal-700",
  callback_pct:   "from-teal-500 to-emerald-700",
  avg_duration:   "from-amber-500 to-amber-700",
  conversion:     "from-emerald-600 to-emerald-700",
};

function getValue(
  stats: OperatorStats | null,
  metric: CallsSingleMetric,
  conversion?: ConversionValue | null,
): { value: number | null; deltaPct: number | null; deltaDir: string | null } {
  if (!stats) return { value: null, deltaPct: null, deltaDir: null };
  switch (metric) {
    case "incoming":
      return { value: stats.incoming, deltaPct: stats.incoming_delta_pct, deltaDir: stats.incoming_delta_dir };
    case "received":
      return { value: stats.received, deltaPct: stats.received_delta_pct, deltaDir: stats.received_delta_dir };
    case "outgoing":
      return { value: stats.outgoing, deltaPct: stats.outgoing_delta_pct, deltaDir: stats.outgoing_delta_dir };
    case "missed":
      return { value: stats.missed, deltaPct: stats.missed_delta_pct, deltaDir: stats.missed_delta_dir };
    case "missed_pct":
      // доля считается на сервере: пропущено ÷ поступило
      return { value: stats.missed_pct, deltaPct: stats.missed_pct_delta_pct ?? null, deltaDir: stats.missed_pct_delta_dir ?? null };
    case "callback_count":
      return { value: stats.callback_count, deltaPct: stats.callback_count_delta_pct ?? null, deltaDir: stats.callback_count_delta_dir ?? null };
    case "callback_pct":
      return { value: stats.callback_pct, deltaPct: stats.callback_pct_delta_pct ?? null, deltaDir: stats.callback_pct_delta_dir ?? null };
    case "avg_duration":
      return { value: stats.avg_duration, deltaPct: stats.avg_duration_delta_pct, deltaDir: stats.avg_duration_delta_dir };
    case "conversion":
      return conversion ?? { value: null, deltaPct: null, deltaDir: null };
    default:
      return { value: null, deltaPct: null, deltaDir: null };
  }
}

function formatValue(value: number, format: "number" | "percent" | "duration"): string {
  if (format === "percent")  return formatPct(value);
  if (format === "duration") {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return m > 0 ? `${m}м ${s}с` : `${s}с`;
  }
  return value.toLocaleString("ru-RU");
}

interface Props {
  stats:    OperatorStats | null;
  loading:  boolean;
  metric?:  CallsSingleMetric;
  conversion?: ConversionValue | null;
}

export function CallsSingleWidget({ stats, loading, metric = "incoming", conversion }: Props) {
  if (loading) return <div className="h-full rounded-2xl bg-blue-500/10 animate-pulse" />;

  const def = CALLS_SINGLE_METRICS.find(m => m.key === metric)!;
  const { value, deltaPct, deltaDir } = getValue(stats, metric, conversion);
  const good = deltaIsGood(deltaDir, BAD_WHEN_UP.has(metric));
  const gradient = GRADIENT[metric];

  const displayValue = value !== null ? formatValue(value, def.format) : "—";

  return (
    <div className={`relative h-full flex flex-col justify-between p-5 rounded-2xl overflow-hidden select-none
      bg-gradient-to-br ${gradient}`}>

      {/* Декоративные круги */}
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -right-2 -bottom-8 h-36 w-36 rounded-full bg-white/5  pointer-events-none" />

      {/* Иконка */}
      <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center z-10">
        <Phone className="h-4 w-4 text-white" />
      </div>

      {/* Значение */}
      <div className="z-10">
        <div className="text-4xl font-bold text-white tracking-tight">{displayValue}</div>
        <div className="text-sm text-white/70 mt-0.5">{def.label}</div>
        {def.hint && <div className="text-[11px] text-white/45">{def.hint}</div>}
      </div>

      {/* Дельта */}
      <div className="z-10">
        {deltaPct !== null && deltaDir && deltaDir !== "flat"
          ? <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
              good ? "text-emerald-200" : "text-red-200"
            }`}>
              {deltaDir === "up"
                ? <TrendingUp className="h-3.5 w-3.5"/>
                : <TrendingDown className="h-3.5 w-3.5"/>}
              {deltaDir === "up" ? "+" : "−"}{deltaPct}% к прошлому периоду
            </span>
          : <span className="inline-flex items-center gap-1 text-xs text-white/40">
              <Minus className="h-3 w-3"/> {noDeltaLabel(deltaPct, deltaDir)}
            </span>}
      </div>
    </div>
  );
}