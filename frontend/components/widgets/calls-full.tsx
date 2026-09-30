"use client";
import { Phone, TrendingUp, TrendingDown } from "lucide-react";
import { OperatorStats, DailyItem } from "@/lib/api";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function Metric({ label, value, pct, dir, color }: {
  label: string; value: string; pct: number | null; dir: string | null; color: string;
}) {
  return (
    <div>
      <div className="text-[11px] mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      {pct !== null && dir && dir !== "flat" ? (
        <div className={`flex items-center gap-0.5 text-[10px] font-medium mt-0.5 ${dir === "up" ? "text-emerald-400" : "text-red-400"}`}>
          {dir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {dir === "up" ? "+" : "−"}{pct}%
        </div>
      ) : <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>—</div>}
    </div>
  );
}

export function CallsFullWidget({ stats, daily, loading }: {
  stats: OperatorStats | null; daily: DailyItem[]; loading: boolean;
}) {
  if (loading) return <div className="h-full rounded-2xl animate-pulse" style={{ background: "#0f172a" }} />;
  const fmt = (n: number) => n.toLocaleString("ru-RU");
  const dur = stats?.avg_duration ?? 0;
  return (
    <div className="h-full flex flex-col p-5 rounded-2xl overflow-hidden" style={{ background: "#0f172a" }}>
      <div className="flex items-center gap-2 mb-5">
        <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.2)" }}>
          <Phone className="h-4 w-4" style={{ color: "#60a5fa" }} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Звонки · полная сводка</div>
          <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>входящие, исходящие, пропущенные, ср. длительность</div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-6 mb-5">
        <Metric label="Входящие" value={fmt(stats?.incoming ?? 0)} pct={stats?.incoming_delta_pct ?? null} dir={stats?.incoming_delta_dir ?? null} color="#93c5fd" />
        <Metric label="Исходящие" value={fmt(stats?.outgoing ?? 0)} pct={stats?.outgoing_delta_pct ?? null} dir={stats?.outgoing_delta_dir ?? null} color="#c4b5fd" />
        <Metric label="Пропущенные" value={fmt(stats?.missed ?? 0)} pct={stats?.missed_delta_pct ?? null} dir={stats?.missed_delta_dir ?? null} color="#fca5a5" />
        <Metric label="Ср. длительность" value={`${Math.floor(dur/60)}м ${dur%60}с`} pct={stats?.avg_duration_delta_pct ?? null} dir={stats?.avg_duration_delta_dir ?? null} color="#fcd34d" />
      </div>
      <div className="flex-1 min-h-0">
        {daily.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="30%">
              <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1e293b", color: "#fff" }}
                labelFormatter={d => new Date(d).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})} />
              <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.4)", paddingTop: 4 }}
                formatter={v => v === "incoming" ? "Вход." : v === "outgoing" ? "Исход." : "Проп."} />
              <Bar dataKey="incoming" fill="#3b82f6" opacity={0.85} radius={[2,2,0,0]} />
              <Bar dataKey="outgoing" fill="#8b5cf6" opacity={0.85} radius={[2,2,0,0]} />
              <Bar dataKey="missed"   fill="#f43f5e" opacity={0.85} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="h-full flex items-center justify-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>нет данных</div>}
      </div>
    </div>
  );
}
