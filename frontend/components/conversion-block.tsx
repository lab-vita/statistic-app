"use client";

import { useEffect, useState } from "react";
import { fetchConversion, ConversionResponse } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardAction, CardContent, CardFooter } from "@/components/ui/card";
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
  const [data, setData]       = useState<ConversionResponse | null>(null);
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
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Конверсия звонок → запись</CardTitle>
        </div>
        <CardAction>
          <span className="text-xs text-muted-foreground">только колл-центр</span>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {data.operators.map(op => (
          <div key={op.operator_id}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{op.name.split(" ")[0]}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{op.incoming} прин.</span>
                  <span>→</span>
                  <span className="tabular-nums">{op.appointments} зап.</span>
                </div>
              </div>
              <span className={`text-sm font-semibold font-mono tabular-nums ${
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{data.total.incoming} прин.</span>
                <span>→</span>
                <span className="tabular-nums">{data.total.appointments} зап.</span>
              </div>
            </div>
            <span className={`text-sm font-semibold font-mono tabular-nums ${
              data.total.conversion_pct >= 70 ? "text-emerald-500"
              : data.total.conversion_pct >= 40 ? "text-yellow-500"
              : "text-red-500"
            }`}>
              {data.total.conversion_pct}%
            </span>
          </div>
          <ConversionBar pct={data.total.conversion_pct} />
        </div>
      </CardContent>

      <CardFooter>
        <p className="text-[11px] text-muted-foreground">
          Конверсия = записи сделанные оператором / входящие звонки × 100%
        </p>
      </CardFooter>
    </Card>
  );
}
