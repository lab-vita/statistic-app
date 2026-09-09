"use client";

import { Period, PeriodType, getDefaultPeriod, shiftPeriod, formatPeriodLabel } from "@/lib/periods";
import { toDateStr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const PERIODS: { type: PeriodType; label: string }[] = [
  { type: "day",     label: "День"    },
  { type: "week",    label: "Неделя"  },
  { type: "month",   label: "Месяц"   },
  { type: "quarter", label: "Квартал" },
  { type: "year",    label: "Год"     },
  { type: "custom",  label: "Период"  },
];

interface TopbarProps {
  period: Period;
  onChange: (p: Period) => void;
  onTypeChange: (t: PeriodType) => void;
  customFrom?: string;
  customTo?: string;
  onCustomFromChange?: (v: string) => void;
  onCustomToChange?: (v: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  operatorName?: string;
}

export function Topbar({
  period, onChange, onTypeChange,
  customFrom, customTo, onCustomFromChange, onCustomToChange,
  onRefresh, refreshing, operatorName,
}: TopbarProps) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isMaxDate = toDateStr(period.dateTo) >= toDateStr(yesterday);

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 flex-shrink-0 gap-4">
      {/* Левая часть — имя оператора или заголовок */}
      <div className="w-40 flex-shrink-0">
        {operatorName ? (
          <span className="text-sm font-medium truncate">{operatorName}</span>
        ) : (
          <span className="text-sm text-muted-foreground">Все операторы</span>
        )}
      </div>

      {/* Центр — переключатель периодов */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {PERIODS.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => onTypeChange(type)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              period.type === type
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Правая часть — навигация по дате */}
      <div className="flex items-center gap-2 w-40 justify-end flex-shrink-0">
        {period.type === "custom" ? (
          <div className="flex items-center gap-1.5">
            <input
              type="date" value={customFrom}
              onChange={e => onCustomFromChange?.(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/40"
            />
            <span className="text-muted-foreground text-xs">—</span>
            <input
              type="date" value={customTo}
              onChange={e => onCustomToChange?.(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/40"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-7 w-7"
              onClick={() => onChange(shiftPeriod(period, -1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium text-center min-w-24 truncate">
              {formatPeriodLabel(period)}
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7"
              onClick={() => onChange(shiftPeriod(period, 1))}
              disabled={isMaxDate}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </header>
  );
}