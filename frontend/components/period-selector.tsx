"use client";

import { PeriodType, Period, shiftPeriod, formatPeriodLabel } from "@/lib/periods";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toDateStr } from "@/lib/api";

const PERIODS: { type: PeriodType; label: string }[] = [
  { type: "day",     label: "День"     },
  { type: "week",    label: "Неделя"   },
  { type: "month",   label: "Месяц"    },
  { type: "quarter", label: "Квартал"  },
  { type: "year",    label: "Год"      },
  { type: "custom",  label: "Период"   },
];

interface PeriodSelectorProps {
  period: Period;
  onChange: (p: Period) => void;
  onTypeChange: (type: PeriodType) => void;
  customFrom?: string;
  customTo?: string;
  onCustomFromChange?: (v: string) => void;
  onCustomToChange?: (v: string) => void;
}

export function PeriodSelector({
  period, onChange, onTypeChange,
  customFrom, customTo,
  onCustomFromChange, onCustomToChange,
}: PeriodSelectorProps) {
  const isToday = toDateStr(period.dateTo) >= toDateStr(new Date());

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

      {/* Переключатель типа периода */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
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

      {/* Кастомный период */}
      {period.type === "custom" ? (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={customFrom}
            onChange={e => onCustomFromChange?.(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium outline-none focus:border-foreground/40 transition-colors"
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="date"
            value={customTo}
            onChange={e => onCustomToChange?.(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium outline-none focus:border-foreground/40 transition-colors"
          />
        </div>
      ) : (
        /* Навигация по периоду */
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => onChange(shiftPeriod(period, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-48 text-center text-sm font-medium">
            {formatPeriodLabel(period)}
          </span>
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => onChange(shiftPeriod(period, 1))}
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}