"use client";
import { Phone, TrendingUp, TrendingDown } from "lucide-react";
import { OperatorStats } from "@/lib/api";

function Delta({ pct, dir }: { pct: number | null; dir: string | null }) {
  if (!pct || !dir || dir === "flat") return <span className="text-[10px] text-white/30">—</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${dir === "up" ? "text-emerald-300" : "text-red-300"}`}>
      {dir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

export function CallsTrioWidget({ stats, loading }: { stats: OperatorStats | null; loading: boolean }) {
  if (loading) return <div className="h-full rounded-2xl animate-pulse" style={{ background: "#1e293b" }} />;
  const items = [
    { label: "Входящие",    value: (stats?.incoming ?? 0).toLocaleString("ru-RU"), pct: stats?.incoming_delta_pct ?? null, dir: stats?.incoming_delta_dir ?? null, color: "#93c5fd", bg: "rgba(59,130,246,0.15)" },
    { label: "Пропущенные", value: (stats?.missed   ?? 0).toLocaleString("ru-RU"), pct: stats?.missed_delta_pct   ?? null, dir: stats?.missed_delta_dir   ?? null, color: "#fca5a5", bg: "rgba(239,68,68,0.15)"   },
    { label: "Исходящие",   value: (stats?.outgoing ?? 0).toLocaleString("ru-RU"), pct: stats?.outgoing_delta_pct ?? null, dir: stats?.outgoing_delta_dir ?? null, color: "#c4b5fd", bg: "rgba(139,92,246,0.15)" },
  ];
  return (
    <div className="h-full flex flex-col p-5 rounded-2xl overflow-hidden" style={{ background: "#0f172a" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.2)" }}>
          <Phone className="h-4 w-4" style={{ color: "#60a5fa" }} />
        </div>
        <span className="text-sm font-semibold text-white">Звонки</span>
      </div>
      <div className="grid grid-cols-3 gap-3 flex-1">
        {items.map(item => (
          <div key={item.label} className="rounded-xl p-3 flex flex-col justify-between" style={{ background: item.bg }}>
            <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>{item.label}</div>
            <div className="text-2xl font-bold mt-2" style={{ color: item.color }}>{item.value}</div>
            <div className="mt-1"><Delta pct={item.pct} dir={item.dir} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
