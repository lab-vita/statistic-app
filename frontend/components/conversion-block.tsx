"use client";

import { useEffect, useState } from "react";
import { fetchConversion, ConversionResponse } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversionBlockProps {
  dateFrom: string;
  dateTo:   string;
}

function convColor(pct: number) {
  return pct >= 70 ? "text-emerald-600 dark:text-emerald-400"
       : pct >= 40 ? "text-amber-600 dark:text-amber-400"
       : "text-red-600 dark:text-red-400";
}
function convBar(pct: number) {
  return pct >= 70 ? "bg-emerald-500"
       : pct >= 40 ? "bg-amber-500"
       : "bg-red-500";
}

export function ConversionBlock({ dateFrom, dateTo }: ConversionBlockProps) {
  const [data, setData]       = useState<ConversionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchConversion(dateFrom, dateTo)
      .then(setData).catch(() => {})
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  if (loading) {
    return <div className="h-32 rounded-lg border border-border bg-card animate-pulse" />;
  }
  if (!data || data.operators.length === 0) return null;

  return (
    <Card>
      <CardHeader className="border-b px-5 py-3.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground/60" />
          <CardTitle className="text-sm font-semibold">Конверсия звонок → запись</CardTitle>
          <span className="ml-auto text-[11px] text-muted-foreground/60">только колл-центр</span>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {data.operators.map(op => (
          <div key={op.operator_id}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-medium">{op.name.split(" ")[0]}</span>
                <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                  {op.incoming} прин. → {op.appointments} зап.
                </span>
              </div>
              <span className={cn("text-[13px] font-semibold tabular-nums", convColor(op.conversion_pct))}>
                {op.conversion_pct}%
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-border overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", convBar(op.conversion_pct))}
                style={{ width: `${Math.min(op.conversion_pct, 100)}%` }}
              />
            </div>
          </div>
        ))}

        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold">Итого</span>
              <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                {data.total.incoming} прин. → {data.total.appointments} зап.
              </span>
            </div>
            <span className={cn("text-[13px] font-bold tabular-nums", convColor(data.total.conversion_pct))}>
              {data.total.conversion_pct}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-border overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", convBar(data.total.conversion_pct))}
              style={{ width: `${Math.min(data.total.conversion_pct, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="px-5 pb-4 pt-0">
        <p className="text-[11px] text-muted-foreground/50">
          Конверсия = записи сделанные оператором / входящие звонки × 100%
        </p>
      </CardFooter>
    </Card>
  );
}
