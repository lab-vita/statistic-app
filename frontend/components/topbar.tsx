"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, ChevronDown, CalendarDays } from "lucide-react";
import { Period, PeriodType, shiftPeriod, formatPeriodLabel } from "@/lib/periods";
import { toDateStr, Operator, Admin } from "@/lib/api";
import { type Section } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const PERIODS: { type: PeriodType; label: string }[] = [
  { type: "day",     label: "День"    },
  { type: "week",    label: "Неделя"  },
  { type: "month",   label: "Месяц"   },
  { type: "quarter", label: "Квартал" },
  { type: "year",    label: "Год"     },
  { type: "custom",  label: "Период"  },
];

const SECTION_LABELS: Record<Section, string> = {
  home: "Главная", calls: "Звонки", appointments: "Записи",
  revenue: "Выручка", reports: "Отчёты", funnel: "Воронка", plans: "Планы",
  doctors: "Врачи", admin: "Доступ", about: "О приложении",
};

const GROUP_ORDER  = ["callcenter", "admin", "other"] as const;
const GROUP_LABELS: Record<string, string> = {
  callcenter: "Колл-центр", admin: "Администраторы", other: "Прочие",
};

interface TopbarProps {
  section:              Section;
  period:               Period;
  onChange:             (p: Period) => void;
  onTypeChange:         (t: PeriodType) => void;
  customFrom?:          string;
  customTo?:            string;
  onCustomFromChange?:  (v: string) => void;
  onCustomToChange?:    (v: string) => void;
  onRefresh:            () => void;
  refreshing:           boolean;
  operators?:           Operator[];
  selectedOperator?:    string | null;
  onSelectOperator?:    (id: string | null) => void;
  admins?:              Admin[];
  selectedAdmin?:       string | null;
  onSelectAdmin?:       (s: string | null) => void;
}

function Dropdown({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(v => !v)}>{trigger}</div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] max-h-64 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg">
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

function DropItem({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-3 py-1.5 text-left text-[12px] transition-colors",
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function DropLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{children}</div>;
}

function DropDivider() {
  return <div className="mx-2 my-1 h-px bg-border" />;
}

export function Topbar({
  section, period, onChange, onTypeChange,
  customFrom, customTo, onCustomFromChange, onCustomToChange,
  onRefresh, refreshing,
  operators = [], selectedOperator, onSelectOperator,
  admins = [], selectedAdmin, onSelectAdmin,
}: TopbarProps) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isMax = toDateStr(period.dateTo) >= toDateStr(yesterday);

  const showOpFilter   = section === "calls"        && !!onSelectOperator && operators.length > 0;
  const showAdmFilter  = section === "appointments" && !!onSelectAdmin    && admins.length > 0;

  const filterLabel = showOpFilter
    ? (selectedOperator ? operators.find(o => o.id === selectedOperator)?.name ?? "Все" : "Все операторы")
    : showAdmFilter
    ? (selectedAdmin ?? "Все сотрудники")
    : null;

  const adminsByGroup = GROUP_ORDER.reduce(
    (acc, g) => { acc[g] = admins.filter(a => a.group === g); return acc; },
    {} as Record<string, Admin[]>,
  );

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-sidebar px-4 lg:px-5">

      {/* Title + filter */}
      <div className="flex items-center gap-2 shrink-0">
        <h2 className="text-[13px] font-semibold whitespace-nowrap">{SECTION_LABELS[section]}</h2>

        {(!!(showOpFilter || showAdmFilter) && filterLabel && (
          <Dropdown
            trigger={
              <button className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-colors">
                {filterLabel}
                <ChevronDown className="h-3 w-3" />
              </button>
            }
          >
            {showOpFilter && onSelectOperator && (
              <>
                <DropItem active={!selectedOperator} onClick={() => onSelectOperator(null)}>Все операторы</DropItem>
                <DropDivider />
                {operators.map(op => (
                  <DropItem key={op.id} active={selectedOperator === op.id} onClick={() => onSelectOperator(op.id)}>
                    {op.name}
                  </DropItem>
                ))}
              </>
            )}
            {showAdmFilter && onSelectAdmin && (
              <>
                <DropItem active={!selectedAdmin} onClick={() => onSelectAdmin(null)}>Все сотрудники</DropItem>
                <DropDivider />
                {GROUP_ORDER.map(g => {
                  const items = adminsByGroup[g];
                  if (!items?.length) return null;
                  return (
                    <div key={g}>
                      <DropLabel>{GROUP_LABELS[g]}</DropLabel>
                      {items.map(a => (
                        <DropItem key={a.surname} active={selectedAdmin === a.surname} onClick={() => onSelectAdmin(a.surname)}>
                          {a.surname}
                        </DropItem>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </Dropdown>
        ))}
      </div>

      {/* Period tabs */}
      <div className="flex flex-1 justify-center">
        <div className="tab-group">
          {PERIODS.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => onTypeChange(type)}
              className={cn("tab-btn", period.type === type ? "tab-btn-active" : "tab-btn-idle")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex shrink-0 items-center gap-1">
        {period.type === "custom" ? (
          <div className="hidden sm:flex items-center gap-1.5">
            {[
              { val: customFrom, onChange: onCustomFromChange },
              { val: customTo,   onChange: onCustomToChange   },
            ].map((inp, i) => (
              <div key={i} className="relative">
                <CalendarDays className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <input
                  type="date" value={inp.val}
                  onChange={e => inp.onChange?.(e.target.value)}
                  className="rounded-md border border-border bg-background py-1 pl-7 pr-2 text-[12px] outline-none focus:border-foreground/30 transition-colors"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onChange(shiftPeriod(period, -1))}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="hidden sm:inline min-w-[110px] text-center text-[12px] font-medium tabular-nums">
              {formatPeriodLabel(period)}
            </span>
            <button
              onClick={() => onChange(shiftPeriod(period, 1))}
              disabled={isMax}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="hidden sm:block mx-1 h-4 w-px bg-border" />

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </button>
      </div>
    </header>
  );
}
