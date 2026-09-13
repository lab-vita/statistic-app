"use client";

import { useEffect, useState } from "react";
import { fetchConversion, ConversionResponse } from "@/lib/api";
import { TrendingUp } from "lucide-react";

interface ConversionBlockProps {
  dateFrom: string;
  dateTo:   string;
}

function ConversionBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const color   = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function ConversionBlock({ dateFrom, dateTo }: ConversionBlockProps) {
  const [data, setData]     = useState<ConversionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchConversion(dateFrom, dateTo)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  if (loading) {
    return <div className="h-32 rounded-xl border border-border bg-card animate-pulse" />;
  }

  if (!data || data.operators.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Конверсия звонок → запись</span>
        <span className="text-xs text-muted-foreground ml-auto">
          только колл-центр
        </span>
      </div>

      <div className="space-y-4">
        {data.operators.map(op => (
          <div key={op.operator_id}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{op.name.split(" ")[0]}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{op.incoming} вх.</span>
                  <span>→</span>
                  <span>{op.appointments} зап.</span>
                </div>
              </div>
              <span className={`text-sm font-semibold font-mono ${
                op.conversion_pct >= 70 ? "text-emerald-500"
                : op.conversion_pct >= 40 ? "text-yellow-500"
                : "text-red-500"
              }`}>
                {op.conversion_pct}%
              </span>
            </div>
            <ConversionBar pct={op.conversion_pct} />
          </div>
        ))}

        {/* Итого */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">Итого</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{data.total.incoming} вх.</span>
                <span>→</span>
                <span>{data.total.appointments} зап.</span>
              </div>
            </div>
            <span className={`text-sm font-semibold font-mono ${
              data.total.conversion_pct >= 70 ? "text-emerald-500"
              : data.total.conversion_pct >= 40 ? "text-yellow-500"
              : "text-red-500"
            }`}>
              {data.total.conversion_pct}%
            </span>
          </div>
          <ConversionBar pct={data.total.conversion_pct} />
        </div>
      </div>

      {/* Подсказка */}
      <p className="text-[11px] text-muted-foreground mt-4">
        Конверсия = записи сделанные оператором / входящие звонки × 100%
      </p>
    </div>
  );
}
