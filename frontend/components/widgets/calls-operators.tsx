"use client";
import { Users } from "lucide-react";
import { OperatorStats } from "@/lib/api";
import { useTheme } from "next-themes";

const COLORS = ["#3b82f6","#8b5cf6","#22c55e","#f59e0b","#f43f5e","#06b6d4","#ec4899","#84cc16"];

export function CallsOperatorsWidget({ operators, loading }: {
  operators:Record<string,OperatorStats>|null; loading:boolean;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme==="dark";
  if (loading) return <div className="h-full rounded-2xl bg-muted/40 animate-pulse" />;

  const total = operators?.["total"]?.incoming ?? 0;
  const rows  = Object.entries(operators??{})
    .filter(([k])=>k!=="total")
    .map(([,v])=>v)
    .sort((a,b)=>b.incoming-a.incoming)
    .slice(0,8);

  const bg    = dark ? "#0f172a" : "#ffffff";
  const nameC = dark ? "#fff"    : "#0f172a";
  const subC  = dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.4)";
  const barBg = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  return (
    <div className="h-full flex flex-col p-5 rounded-2xl overflow-hidden border border-border"
      style={{background:bg}}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Users className="h-4 w-4 text-blue-500 dark:text-blue-400"/>
        </div>
        <div>
          <div className="text-sm font-semibold">Операторы</div>
          <div className="text-[11px] text-muted-foreground">входящие · всего {total.toLocaleString("ru-RU")}</div>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {rows.length===0
          ? <div className="h-full flex items-center justify-center text-xs text-muted-foreground">нет данных</div>
          : rows.map((op,i) => {
              const pct   = total>0 ? op.incoming/total*100 : 0;
              const color = COLORS[i%COLORS.length];
              return (
                <div key={op.name} className="flex items-center gap-3">
                  <span className="text-[11px] w-4 text-right flex-shrink-0" style={{color:subC}}>{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium truncate" style={{color:nameC}}>{op.name}</span>
                      <span className="text-xs font-bold ml-2 flex-shrink-0" style={{color}}>{op.incoming.toLocaleString("ru-RU")}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{background:barBg}}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{width:`${pct}%`,background:color}}/>
                    </div>
                  </div>
                  <span className="text-[10px] w-8 text-right flex-shrink-0" style={{color:subC}}>{pct.toFixed(0)}%</span>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}