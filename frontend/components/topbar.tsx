"use client";

import { Period, PeriodType, shiftPeriod, formatPeriodLabel } from "@/lib/periods";
import { toDateStr, Operator, Admin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, RefreshCw, ChevronDown, CalendarDays } from "lucide-react";
import { Section } from "@/components/sidebar";
import { useState, useRef, useEffect } from "react";

const PERIODS: { type: PeriodType; label: string }[] = [
  { type: "day", label: "День" },
  { type: "week", label: "Неделя" },
  { type: "month", label: "Месяц" },
  { type: "quarter", label: "Квартал" },
  { type: "year", label: "Год" },
  { type: "custom", label: "Период" },
];

const SECTION_LABELS: Record<Section, string> = {
  home: "Главная",
  calls: "Звонки",
  appointments: "Записи",
  revenue: "Выручка",
  reports: "Отчёты",
  plans: "Планы",
  admin: "Доступ",
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
  operators?: Operator[];
  selectedOperator?: string | null;
  onSelectOperator?: (id: string | null) => void;
  admins?: Admin[];
  selectedAdmin?: string | null;
  onSelectAdmin?: (surname: string | null) => void;
}

const GROUP_ORDER = ["callcenter", "admin", "other"] as const;
const GROUP_LABELS: Record<string, string> = {
  callcenter: "Колл-центр",
  admin: "Администраторы",
  other: "Прочие",
};

export function Topbar({
  section,
  period,
  onChange,
  onTypeChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onRefresh,
  refreshing,
  operators = [],
  selectedOperator,
  onSelectOperator,
  admins = [],
  selectedAdmin,
  onSelectAdmin,
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

  const filterLabel = (() => {
    if (section === "calls") {
      if (!selectedOperator) return "Все операторы";
      return operators.find((o) => o.id === selectedOperator)?.name.split(" ")[0] ?? "Все";
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

  const adminsByGroup = GROUP_ORDER.reduce(
    (acc, g) => {
      acc[g] = admins.filter((a) => a.group === g);
      return acc;
    },
    {} as Record<string, Admin[]>,
  );

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-5">
      {/* Title + filter */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <h2 className="text-sm font-semibold tracking-tight whitespace-nowrap">
          {SECTION_LABELS[section]}
        </h2>

        {showFilter && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              <span>{filterLabel}</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1.5 max-h-80 min-w-[200px] overflow-y-auto rounded-xl border border-border bg-popover py-1.5 shadow-lg">
                {section === "calls" && onSelectOperator && (
                  <>
                    <button
                      onClick={() => {
                        onSelectOperator(null);
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs transition-colors ${
                        !selectedOperator
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      Все операторы
                    </button>
                    <div className="mx-2 my-1 h-px bg-border" />
                    {operators.map((op) => (
                      <button
                        key={op.id}
                        onClick={() => {
                          onSelectOperator(op.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-left text-xs transition-colors ${
                          selectedOperator === op.id
                            ? "bg-accent font-medium text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {op.name}
                      </button>
                    ))}
                  </>
                )}

                {section === "appointments" && onSelectAdmin && (
                  <>
                    <button
                      onClick={() => {
                        onSelectAdmin(null);
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs transition-colors ${
                        !selectedAdmin
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      Все сотрудники
                    </button>
                    <div className="mx-2 my-1 h-px bg-border" />
                    {GROUP_ORDER.map((group) => {
                      const items = adminsByGroup[group];
                      if (!items?.length) return null;
                      return (
                        <div key={group}>
                          <div className="px-3.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                            {GROUP_LABELS[group]}
                          </div>
                          {items.map((admin) => (
                            <button
                              key={admin.surname}
                              onClick={() => {
                                onSelectAdmin(admin.surname);
                                setDropdownOpen(false);
                              }}
                              className={`w-full px-3.5 py-2 text-left text-xs transition-colors ${
                                selectedAdmin === admin.surname
                                  ? "bg-accent font-medium text-foreground"
                                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
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

      {/* Period selector — centered on desktop, hidden on mobile (shown below) */}
      <div className="hidden flex-1 justify-center lg:flex">
        <div className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-muted/30 p-1">
          {PERIODS.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => onTypeChange(type)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                period.type === type
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile period selector */}
      <div className="flex flex-1 justify-center lg:hidden">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5">
          {PERIODS.slice(0, 4).map(({ type, label }) => (
            <button
              key={type}
              onClick={() => onTypeChange(type)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                period.type === type
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Right — date navigation + refresh */}
      <div className="flex shrink-0 items-center gap-1.5">
        {period.type === "custom" ? (
          <div className="hidden items-center gap-1.5 sm:flex">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={customFrom}
                onChange={(e) => onCustomFromChange?.(e.target.value)}
                className="rounded-lg border border-border bg-background py-1.5 pl-7 pr-2 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <span className="text-xs text-muted-foreground">—</span>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={customTo}
                onChange={(e) => onCustomToChange?.(e.target.value)}
                className="rounded-lg border border-border bg-background py-1.5 pl-7 pr-2 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-lg"
              onClick={() => onChange(shiftPeriod(period, -1))}
              aria-label="Предыдущий период"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="hidden min-w-[110px] text-center text-xs font-medium tabular-nums sm:inline">
              {formatPeriodLabel(period)}
            </span>
            <span className="min-w-0 truncate text-center text-[11px] font-medium sm:hidden">
              {formatPeriodLabel(period)}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-lg"
              onClick={() => onChange(shiftPeriod(period, 1))}
              disabled={isMaxDate}
              aria-label="Следующий период"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="ml-1 h-5 w-px bg-border hidden sm:block" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-lg"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Обновить данные"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </header>
  );
}
