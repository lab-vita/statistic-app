"use client";
import { Phone, TrendingUp, TrendingDown } from "lucide-react";
import { OperatorStats } from "@/lib/api";

interface Props {
  stats: OperatorStats | null;
  loading: boolean;
}

function Delta({ pct, dir }: { pct: number | null; dir: string | null }) {
  if (!pct || !dir || dir === "flat") return <span className="text-[10px] text-white/40">—</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
      dir === "up" ? "text-emerald-300" : "text-red-300"
    }`}>
      {dir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

export function CallsTrioWidget({ stats, loading }: Props) {
  if (loading) return <div className="h-full rounded-2xl bg-slate-800/50 animate-pulse" />;

  const incoming   = stats?.incoming   ?? 0;
  const missed     = stats?.missed     ?? 0;
  const conversion = stats && stats.incoming > 0
    ? null // вычислим когда будут данные по записям
    : null;

  const items = [
    {
      label: "Входящие",
      value: incoming.toLocaleString("ru-RU"),
      pct:   stats?.incoming_delta_pct ?? null,
      dir:   stats?.incoming_delta_dir ?? null,
      color: "text-blue-300",
      bg:    "bg-blue-500/20",
    },
    {
      label: "Пропущенные",
      value: missed.toLocaleString("ru-RU"),
      pct:   stats?.missed_delta_pct ?? null,
      dir:   stats?.missed_delta_dir ?? null,
      color: "text-rose-300",
      bg:    "bg-rose-500/20",
    },
    {
      label: "Исходящие",
      value: (stats?.outgoing ?? 0).toLocaleString("ru-RU"),
      pct:   stats?.outgoing_delta_pct ?? null,
      dir:   stats?.outgoing_delta_dir ?? null,
      color: "text-violet-300",
      bg:    "bg-violet-500/20",
    },
  ];

  return (
    <div className="h-full flex flex-col justify-between p-5
      bg-slate-900 rounded-2xl overflow-hidden">

      {/* Заголовок */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Phone className="h-4 w-4 text-blue-400" />
        </div>
        <span className="text-sm font-semibold text-white">Звонки</span>
      </div>

      {/* Три метрики */}
      <div className="grid grid-cols-3 gap-3 flex-1">
        {items.map(item => (
          <div key={item.label} className={`${item.bg} rounded-xl p-3 flex flex-col justify-between`}>
            <div className="text-[11px] text-white/50 font-medium mb-2">{item.label}</div>
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div className="mt-1">
              <Delta pct={item.pct} dir={item.dir} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
