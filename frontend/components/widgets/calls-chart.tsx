"use client";
import { Phone, TrendingUp, TrendingDown } from "lucide-react";
import { OperatorStats, DailyItem } from "@/lib/api";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "next-themes";

export function CallsChartWidget({ stats, daily, loading }: {
  stats:OperatorStats|null; daily:DailyItem[]; loading:boolean;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  if (loading) return <div className="h-full rounded-2xl bg-muted/40 animate-pulse" />;

  const value     = stats?.incoming ?? 0;
  const delta     = stats?.incoming_delta_pct ?? null;
  const dir       = stats?.incoming_delta_dir ?? null;
  const missedPct = value>0&&stats ? Math.round(stats.missed/value*100) : 0;

  const bg      = dark ? "#0f172a" : "#ffffff";
  const ttBg    = dark ? "#1e293b" : "#f8fafc";
  const ttBord  = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const ttColor = dark ? "#fff" : "#0f172a";
  const tickC   = dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.35)";

  return (
    <div className="h-full flex flex-col p-5 rounded-2xl overflow-hidden border border-border"
      style={{background:bg}}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Phone className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400"/>
            </div>
            <span className="text-xs font-medium text-muted-foreground">Входящие звонки</span>
          </div>
          <div className="text-4xl font-bold tracking-tight">{value.toLocaleString("ru-RU")}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {delta!==null&&dir&&dir!=="flat"&&(
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
              dir==="up"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}>
              {dir==="up"?<TrendingUp className="h-3 w-3"/>:<TrendingDown className="h-3 w-3"/>}
              {dir==="up"?"+":"−"}{delta}%
            </span>
          )}
          <div className="text-right">
            <div className="text-lg font-bold text-red-500">{missedPct}%</div>
            <div className="text-[10px] text-muted-foreground">пропущено</div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {daily.length>0?(
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{top:4,right:0,bottom:0,left:0}}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date"
                tickFormatter={d=>new Date(d).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}
                tick={{fontSize:9,fill:tickC}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
              <Tooltip
                contentStyle={{fontSize:11,borderRadius:8,border:`1px solid ${ttBord}`,background:ttBg,color:ttColor}}
                labelFormatter={d=>new Date(String(d)).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}
                formatter={(v)=>[Number(v).toLocaleString("ru-RU"),"Входящие"]}/>
              <Area type="monotone" dataKey="incoming" stroke="#3b82f6" strokeWidth={2} fill="url(#cg)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        ):(
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">нет данных</div>
        )}
      </div>
    </div>
  );
}