"use client";

import { Operator, getInitials, OPERATOR_COLORS } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { BarChart2, Calendar, AlertTriangle } from "lucide-react";

export type Section = "calls" | "appointments" | "suspicious";

interface SidebarProps {
  operators: Operator[];
  selectedOperator: string | null;
  onSelectOperator: (id: string | null) => void;
  section: Section;
  onSelectSection: (s: Section) => void;
}

const SECTIONS = [
  { id: "calls"        as Section, label: "Звонки",    icon: BarChart2      },
  { id: "appointments" as Section, label: "Записи",    icon: Calendar       },
  { id: "suspicious"   as Section, label: "Антифрод",  icon: AlertTriangle  },
];

export function Sidebar({
  operators, selectedOperator, onSelectOperator,
  section, onSelectSection,
}: SidebarProps) {
  return (
    <aside className="w-[200px] flex-shrink-0 border-r border-border bg-muted/20 flex flex-col">
      {/* Лого */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <span className="font-semibold text-sm tracking-tight">Лабвита</span>
        <span className="text-border mx-1.5 select-none">·</span>
        <span className="text-xs text-muted-foreground">аналитика</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">

        {/* Разделы */}
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { onSelectSection(id); onSelectOperator(null); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              section === id && selectedOperator === null
                ? "bg-background border border-border font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Icon className={`h-4 w-4 flex-shrink-0 ${
              id === "suspicious" ? "text-red-500" : ""
            }`} />
            {label}
          </button>
        ))}

        {/* Операторы — только для звонков и записей */}
        {section !== "suspicious" && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                Операторы
              </span>
            </div>

            {operators.map((op, i) => {
              const colors   = OPERATOR_COLORS[i % 4];
              const initials = getInitials(op.name);
              const isActive = selectedOperator === op.id;
              const parts    = op.name.split(" ");
              const short    = parts[0] + (parts[1] ? " " + parts[1][0] + "." : "");

              return (
                <button
                  key={op.id}
                  onClick={() => onSelectOperator(op.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    isActive
                      ? "bg-background border border-border font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {initials}
                  </div>
                  <span className="truncate">{short}</span>
                </button>
              );
            })}
          </>
        )}
      </nav>

      {/* Низ */}
      <div className="border-t border-border px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Тема</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}