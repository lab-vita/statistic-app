"use client";
import { Phone, TrendingUp, TrendingDown } from "lucide-react";
import { OperatorStats, DailyItem } from "@/lib/api";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";

export function CallsChartWidget({ stats, daily, loading }: {
  stats: OperatorStats | null; daily: DailyItem[]; loading: boolean;
}) {
  if (loading) return <div className="h-full rounded-2xl animate-pulse" style={{ background: "#0f172a" }} />;
  const value     = stats?.incoming ?? 0;
  const delta     = stats?.incoming_delta_pct ?? null;
  const dir       = stats?.incoming_delta_dir ?? null;
  const missedPct = value > 0 && stats ? Math.round(stats.missed / value * 100) : 0;
  return (
    <div className="h-full flex flex-col p-5 rounded-2xl overflow-hidden" style={{ background: "#0f172a" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(59,130,246,0.2)" }}>
              <Phone className="h-3.5 w-3.5" style={{ color: "#60a5fa" }} />
            </div>
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>Входящие звонки</span>
          </div>
          <div className="text-4xl font-bold text-white tracking-tight">{value.toLocaleString("ru-RU")}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {delta !== null && dir && dir !== "flat" && (
            <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
              dir === "up" ? "text-emerald-400" : "text-red-400"
            }`} style={{ background: dir === "up" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
              {dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {dir === "up" ? "+" : "−"}{delta}%
            </div>
          )}
          <div className="text-right">
            <div className="text-lg font-bold" style={{ color: "#f87171" }}>{missedPct}%</div>
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>пропущено</div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {daily.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1e293b", color: "#fff" }}
                labelFormatter={d => new Date(d).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}
                formatter={(v: number) => [v.toLocaleString("ru-RU"), "Входящие"]} />
              <Area type="monotone" dataKey="incoming" stroke="#3b82f6" strokeWidth={2} fill="url(#cg)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <div className="h-full flex items-center justify-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>нет данных</div>}
      </div>
    </div>
  );
}
