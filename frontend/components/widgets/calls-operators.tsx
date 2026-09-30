"use client";
import { Phone, Users } from "lucide-react";
import { OperatorStats } from "@/lib/api";

interface Props {
  operators: Record<string, OperatorStats> | null;
  loading:   boolean;
}

const COLORS = ["#3b82f6","#8b5cf6","#22c55e","#f59e0b","#f43f5e","#06b6d4","#ec4899"];

export function CallsOperatorsWidget({ operators, loading }: Props) {
  if (loading) return <div className="h-full rounded-2xl bg-slate-900/80 animate-pulse" />;

  const total = operators?.["total"]?.incoming ?? 0;
  const rows  = Object.entries(operators ?? {})
    .filter(([k]) => k !== "total")
    .map(([, v]) => v)
    .sort((a, b) => b.incoming - a.incoming)
    .slice(0, 8);

  return (
    <div className="h-full flex flex-col p-5 bg-slate-900 rounded-2xl overflow-hidden">

      {/* Шапка */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Users className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Операторы</div>
          <div className="text-[11px] text-white/30">входящие звонки · всего {total.toLocaleString("ru-RU")}</div>
        </div>
      </div>

      {/* Список */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-white/20">
            нет данных
          </div>
        ) : rows.map((op, i) => {
          const pct = total > 0 ? op.incoming / total * 100 : 0;
          const color = COLORS[i % COLORS.length];
          return (
            <div key={op.name} className="flex items-center gap-3">
              {/* Номер */}
              <span className="text-[11px] text-white/30 w-4 flex-shrink-0 text-right">{i + 1}</span>

              {/* Имя */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white truncate">{op.name}</span>
                  <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color }}>
                    {op.incoming.toLocaleString("ru-RU")}
                  </span>
                </div>
                {/* Прогресс-бар */}
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>

              {/* % */}
              <span className="text-[10px] text-white/30 w-8 text-right flex-shrink-0">
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
