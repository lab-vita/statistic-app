"use client";
import { Phone, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { OperatorStats } from "@/lib/api";

export function CallsSingleWidget({ stats, loading }: { stats:OperatorStats|null; loading:boolean }) {
  if (loading) return <div className="h-full rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 animate-pulse" />;

  const value = stats?.incoming ?? 0;
  const delta = stats?.incoming_delta_pct ?? null;
  const dir   = stats?.incoming_delta_dir ?? null;

  return (
    <div className="relative h-full flex flex-col justify-between p-5 rounded-2xl overflow-hidden select-none
      bg-gradient-to-br from-blue-600 to-blue-700">
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 pointer-events-none"/>
      <div className="absolute -right-2 -bottom-8 h-36 w-36 rounded-full bg-white/5  pointer-events-none"/>
      <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center z-10">
        <Phone className="h-4 w-4 text-white"/>
      </div>
      <div className="z-10">
        <div className="text-4xl font-bold text-white tracking-tight">{value.toLocaleString("ru-RU")}</div>
        <div className="text-sm text-blue-100 mt-0.5">Входящие звонки</div>
      </div>
      <div className="z-10">
        {delta!==null&&dir&&dir!=="flat"
          ? <span className={`inline-flex items-center gap-1 text-xs font-semibold ${dir==="up"?"text-emerald-200":"text-red-200"}`}>
              {dir==="up"?<TrendingUp className="h-3.5 w-3.5"/>:<TrendingDown className="h-3.5 w-3.5"/>}
              {dir==="up"?"+":"−"}{delta}% к прошлому периоду
            </span>
          : <span className="inline-flex items-center gap-1 text-xs text-blue-200">
              <Minus className="h-3 w-3"/> нет изменений
            </span>}
      </div>
    </div>
  );
}