"use client";
import { Phone, TrendingUp, TrendingDown } from "lucide-react";
import { OperatorStats, DailyItem } from "@/lib/api";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useTheme } from "next-themes";

function Metric({ label,value,pct,dir,light,dark: dc }: {
  label:string; value:string; pct:number|null; dir:string|null; light:string; dark:string;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-2xl font-bold ${light} dark:${dc}`}>{value}</div>
      {pct!==null&&dir&&dir!=="flat"
        ? <div className={`flex items-center gap-0.5 text-[10px] font-medium mt-0.5 ${
            dir==="up"?"text-emerald-600 dark:text-emerald-400":"text-red-600 dark:text-red-400"}`}>
            {dir==="up"?<TrendingUp className="h-2.5 w-2.5"/>:<TrendingDown className="h-2.5 w-2.5"/>}
            {dir==="up"?"+":"−"}{pct}%
          </div>
        : <div className="text-[10px] text-muted-foreground mt-0.5">—</div>}
    </div>
  );
}

export function CallsFullWidget({ stats, daily, loading }: {
  stats:OperatorStats|null; daily:DailyItem[]; loading:boolean;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme==="dark";
  if (loading) return <div className="h-full rounded-2xl bg-muted/40 animate-pulse" />;

  const fmt = (n:number) => n.toLocaleString("ru-RU");
  const dur = stats?.avg_duration ?? 0;
  const bg    = dark ? "#0f172a" : "#ffffff";
  const ttBg  = dark ? "#1e293b" : "#f8fafc";
  const ttBor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const ttCol = dark ? "#fff" : "#0f172a";
  const tickC = dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.35)";

  return (
    <div className="h-full flex flex-col p-5 rounded-2xl overflow-hidden border border-border"
      style={{background:bg}}>
      <div className="flex items-center gap-2 mb-5">
        <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Phone className="h-4 w-4 text-blue-500 dark:text-blue-400"/>
        </div>
        <div>
          <div className="text-sm font-semibold">Звонки · полная сводка</div>
          <div className="text-[11px] text-muted-foreground">входящие, исходящие, пропущенные, ср. длительность</div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-6 mb-5">
        <Metric label="Входящие"  value={fmt(stats?.incoming??0)} pct={stats?.incoming_delta_pct??null} dir={stats?.incoming_delta_dir??null} light="text-blue-700"   dark="text-blue-300"/>
        <Metric label="Исходящие" value={fmt(stats?.outgoing??0)} pct={stats?.outgoing_delta_pct??null} dir={stats?.outgoing_delta_dir??null} light="text-violet-700" dark="text-violet-300"/>
        <Metric label="Пропущенные" value={fmt(stats?.missed??0)} pct={stats?.missed_delta_pct??null}   dir={stats?.missed_delta_dir??null}   light="text-red-700"    dark="text-red-300"/>
        <Metric label="Ср. длительность" value={`${Math.floor(dur/60)}м ${dur%60}с`}
          pct={stats?.avg_duration_delta_pct??null} dir={stats?.avg_duration_delta_dir??null}
          light="text-amber-700" dark="text-amber-300"/>
      </div>
      <div className="flex-1 min-h-0">
        {daily.length>0?(
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{top:0,right:0,bottom:0,left:0}} barCategoryGap="30%">
              <XAxis dataKey="date"
                tickFormatter={d=>new Date(d).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}
                tick={{fontSize:9,fill:tickC}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
              <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:`1px solid ${ttBor}`,background:ttBg,color:ttCol}}
                labelFormatter={d=>new Date(String(d)).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}/>
              <Legend wrapperStyle={{fontSize:10,color:tickC,paddingTop:4}}
                formatter={v=>v==="incoming"?"Вход.":v==="outgoing"?"Исход.":"Проп."}/>
              <Bar dataKey="incoming" fill="#3b82f6" opacity={0.85} radius={[2,2,0,0]}/>
              <Bar dataKey="outgoing" fill="#8b5cf6" opacity={0.85} radius={[2,2,0,0]}/>
              <Bar dataKey="missed"   fill="#f43f5e" opacity={0.85} radius={[2,2,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        ):(
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">нет данных</div>
        )}
      </div>
    </div>
  );
}