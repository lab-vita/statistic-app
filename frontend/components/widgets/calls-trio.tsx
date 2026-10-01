"use client";
import { Phone, TrendingUp, TrendingDown } from "lucide-react";
import { OperatorStats } from "@/lib/api";

function Delta({ pct, dir }: { pct:number|null; dir:string|null }) {
  if (!pct||!dir||dir==="flat") return <span className="text-[10px] text-foreground/25">—</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
      dir==="up"?"text-emerald-600 dark:text-emerald-300":"text-red-600 dark:text-red-300"
    }`}>
      {dir==="up"?<TrendingUp className="h-2.5 w-2.5"/>:<TrendingDown className="h-2.5 w-2.5"/>}
      {dir==="up"?"+":"−"}{pct}%
    </span>
  );
}

const ITEMS = [
  { key:"incoming" as const, label:"Входящие",
    light:"bg-blue-50 border-blue-100 text-blue-700",
    dark:"dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300",
    deltaK:"incoming_delta" },
  { key:"missed" as const, label:"Пропущенные",
    light:"bg-red-50 border-red-100 text-red-700",
    dark:"dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300",
    deltaK:"missed_delta" },
  { key:"outgoing" as const, label:"Исходящие",
    light:"bg-violet-50 border-violet-100 text-violet-700",
    dark:"dark:bg-violet-500/10 dark:border-violet-500/20 dark:text-violet-300",
    deltaK:"outgoing_delta" },
];

export function CallsTrioWidget({ stats, loading }: { stats:OperatorStats|null; loading:boolean }) {
  if (loading) return <div className="h-full rounded-2xl bg-muted/40 animate-pulse" />;
  return (
    <div className="h-full flex flex-col p-5 rounded-2xl overflow-hidden
      bg-white border border-border
      dark:bg-[#0f172a] dark:border-white/5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Phone className="h-4 w-4 text-blue-500 dark:text-blue-400"/>
        </div>
        <span className="text-sm font-semibold">Звонки</span>
      </div>
      <div className="grid grid-cols-3 gap-3 flex-1">
        {ITEMS.map(item => {
          const value = (stats?.[item.key]??0).toLocaleString("ru-RU");
          const pct   = (stats as any)?.[`${item.deltaK}_pct`]??null;
          const dir   = (stats as any)?.[`${item.deltaK}_dir`]??null;
          return (
            <div key={item.key}
              className={`rounded-xl border p-3 flex flex-col justify-between ${item.light} ${item.dark}`}>
              <div className="text-[11px] font-medium opacity-60">{item.label}</div>
              <div className="text-2xl font-bold mt-2">{value}</div>
              <div className="mt-1"><Delta pct={pct} dir={dir}/></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}