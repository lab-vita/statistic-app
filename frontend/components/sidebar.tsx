"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { LayoutDashboard, Phone, Calendar, BarChart2 } from "lucide-react";

export type Section = "home" | "calls" | "appointments" | "reports";

interface SidebarProps {
  section: Section;
  onSelectSection: (s: Section) => void;
}

const SECTIONS = [
  { id: "home"         as Section, label: "Главная",  icon: LayoutDashboard },
  { id: "calls"        as Section, label: "Звонки",   icon: Phone           },
  { id: "appointments" as Section, label: "Записи",   icon: Calendar        },
  { id: "reports"      as Section, label: "Отчёты",   icon: BarChart2       },
];

export function Sidebar({ section, onSelectSection }: SidebarProps) {
  return (
    <aside className="w-[180px] flex-shrink-0 border-r border-border bg-muted/20 flex flex-col">
      <div className="h-14 flex flex-col justify-center px-4 border-b border-border">
        <span className="font-semibold text-sm tracking-tight">Лабвита</span>
        <span className="text-[11px] text-muted-foreground">аналитика</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelectSection(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              section === id
                ? "bg-background border border-border font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Тема</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
