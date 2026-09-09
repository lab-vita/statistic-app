"use client";

import { Period, PeriodType, getDefaultPeriod, shiftPeriod, formatPeriodLabel } from "@/lib/periods";
import { toDateStr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw, ChevronDown } from "lucide-react";
import { Section } from "@/components/sidebar";
import { Operator, OPERATOR_COLORS, getInitials } from "@/lib/api";
import { useState, useRef, useEffect } from "react";

const PERIODS: { type: PeriodType; label: string }[] = [
  { type: "day",     label: "День"    },
  { type: "week",    label: "Неделя"  },
  { type: "month",   label: "Месяц"   },
  { type: "quarter", label: "Квартал" },
  { type: "year",    label: "Год"     },
  { type: "custom",  label: "Период"  },
];

const SECTION_LABELS: Record<Section, string> = {
  calls:        "Звонки",
  appointments: "Записи",
};

interface TopbarProps {
  section: Section;
  period: Period;
  onChange: (p: Period) => void;
  onTypeChange: (t: PeriodType) => void;
  customFrom?: string;
  customTo?: string;
  onCustomFromChange?: (v: string) => void;
  onCustomToChange?: (v: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  // Фильтр по людям
  operators?: Operator[];
  selectedOperator?: string | null;
  onSelectOperator?: (id: string | null) => void;
  // Антифрод-вкладка (только для записей)
  appointmentsTab?: "overview" | "antifraud";
  onAppointmentsTabChange?: (tab: "overview" | "antifraud") => void;
}

export function Topbar({
  section, period, onChange, onTypeChange,
  customFrom, customTo, onCustomFromChange, onCustomToChange,
  onRefresh, refreshing,
  operators = [], selectedOperator, onSelectOperator,
  appointmentsTab, onAppointmentsTabChange,
}: TopbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isMaxDate = toDateStr(period.dateTo) >= toDateStr(yesterday);

  // Закрываем дропдаун при клике вне
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedOp = operators.find(o => o.id === selectedOperator);
  const opLabel = selectedOp
    ? (() => { const parts = selectedOp.name.split(" "); return parts[0] + (parts[1] ? " " + parts[1][0] + "." : ""); })()
    : "Все";

  return (
    <header className="h-14 border-b border-border flex items-center px-5 gap-4 flex-shrink-0 bg-background">

      {/* Заголовок раздела + подзаголовок-фильтр */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-sm">{SECTION_LABELS[section]}</span>

        {/* Вкладки внутри записей */}
        {section === "appointments" && onAppointmentsTabChange && (
          <div className="flex items-center gap-1 ml-2 rounded-md border border-border bg-muted/30 p-0.5">
            <button
              onClick={() => onAppointmentsTabChange("overview")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                appointmentsTab === "overview"
                  ? "bg-background border border-border text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Обзор
            </button>
            <button
              onClick={() => onAppointmentsTabChange("antifraud")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                appointmentsTab === "antifraud"
                  ? "bg-background border border-border text-red-500"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Антифрод
            </button>
          </div>
        )}

        {/* Фильтр по оператору/администратору */}
        {onSelectOperator && operators.length > 0 && appointmentsTab !== "antifraud" && (
          <div className="relative ml-1" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedOperator && selectedOp && (
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold flex-shrink-0"
                  style={{
                    background: OPERATOR_COLORS[(operators.indexOf(selectedOp)) % 4].bg,
                    color: OPERATOR_COLORS[(operators.indexOf(selectedOp)) % 4].text,
                  }}
                >
                  {getInitials(selectedOp.name)}
                </div>
              )}
              <span>{opLabel}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border bg-background shadow-md py-1">
                <button
                  onClick={() => { onSelectOperator(null); setDropdownOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left ${
                    !selectedOperator ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  Все
                </button>
                {operators.map((op, i) => {
                  const colors = OPERATOR_COLORS[i % 4];
                  const initials = getInitials(op.name);
                  const parts = op.name.split(" ");
                  const short = parts[0] + (parts[1] ? " " + parts[1][0] + "." : "");
                  return (
                    <button
                      key={op.id}
                      onClick={() => { onSelectOperator(op.id); setDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left ${
                        selectedOperator === op.id ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {initials}
                      </div>
                      {short}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Центр — переключатель периодов */}
      <div className="flex-1 flex justify-center">
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
      </div>

      {/* Правая часть — навигация по дате + обновление */}
      <div className="flex items-center gap-2 flex-shrink-0">
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
