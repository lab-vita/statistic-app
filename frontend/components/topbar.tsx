"use client";

import { Period, PeriodType, getDefaultPeriod, shiftPeriod, formatPeriodLabel } from "@/lib/periods";
import { toDateStr, Operator, Admin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw, ChevronDown } from "lucide-react";
import { Section } from "@/components/sidebar";
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
  home:         "Главная",
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
  // Фильтр — операторы (звонки)
  operators?: Operator[];
  selectedOperator?: string | null;
  onSelectOperator?: (id: string | null) => void;
  // Фильтр — администраторы (записи)
  admins?: Admin[];
  selectedAdmin?: string | null;
  onSelectAdmin?: (surname: string | null) => void;
}

const GROUP_ORDER = ["callcenter", "admin", "other"] as const;
const GROUP_LABELS: Record<string, string> = {
  callcenter: "Колл-центр",
  admin:      "Администраторы",
  other:      "Прочие",
};

export function Topbar({
  section, period, onChange, onTypeChange,
  customFrom, customTo, onCustomFromChange, onCustomToChange,
  onRefresh, refreshing,
  operators = [], selectedOperator, onSelectOperator,
  admins = [], selectedAdmin, onSelectAdmin,
}: TopbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isMaxDate = toDateStr(period.dateTo) >= toDateStr(yesterday);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Определяем текущий лейбл фильтра
  const filterLabel = (() => {
    if (section === "calls") {
      if (!selectedOperator) return "Все операторы";
      return operators.find(o => o.id === selectedOperator)?.name.split(" ")[0] ?? "Все";
    }
    if (section === "appointments") {
      if (!selectedAdmin) return "Все";
      return selectedAdmin;
    }
    return null;
  })();

  const showFilter =
    (section === "calls" && onSelectOperator && operators.length > 0) ||
    (section === "appointments" && onSelectAdmin && admins.length > 0);

  // Группируем администраторов
  const adminsByGroup = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = admins.filter(a => a.group === g);
    return acc;
  }, {} as Record<string, Admin[]>);

  return (
    <header className="h-14 border-b border-border flex items-center px-5 gap-4 flex-shrink-0 bg-background">

      {/* Заголовок + фильтр */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-sm">{SECTION_LABELS[section]}</span>

        {showFilter && (
          <div className="relative ml-1" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{filterLabel}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-border bg-background shadow-md py-1 max-h-80 overflow-y-auto">

                {/* Звонки — список операторов */}
                {section === "calls" && onSelectOperator && (
                  <>
                    <button
                      onClick={() => { onSelectOperator(null); setDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        !selectedOperator ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      Все операторы
                    </button>
                    {operators.map(op => (
                      <button
                        key={op.id}
                        onClick={() => { onSelectOperator(op.id); setDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          selectedOperator === op.id ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        {op.name}
                      </button>
                    ))}
                  </>
                )}

                {/* Записи — администраторы по группам */}
                {section === "appointments" && onSelectAdmin && (
                  <>
                    <button
                      onClick={() => { onSelectAdmin(null); setDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        !selectedAdmin ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      Все
                    </button>
                    {GROUP_ORDER.map(group => {
                      const items = adminsByGroup[group];
                      if (!items?.length) return null;
                      return (
                        <div key={group}>
                          <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {GROUP_LABELS[group]}
                          </div>
                          {items.map(admin => (
                            <button
                              key={admin.surname}
                              onClick={() => { onSelectAdmin(admin.surname); setDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                                selectedAdmin === admin.surname ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                              }`}
                            >
                              {admin.surname}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}
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

      {/* Правая часть */}
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
