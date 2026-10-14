"use client";

import { cn } from "@/lib/utils";
import type { Section } from "@/lib/permissions";
import {
  Home, Phone, Calendar, TrendingUp, FileText,
  Filter, Target, Activity, Settings, Info,
} from "lucide-react";

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "home",         label: "Главная",    icon: Home },
  { id: "calls",        label: "Звонки",     icon: Phone },
  { id: "appointments", label: "Записи",     icon: Calendar },
  { id: "revenue",      label: "Выручка",    icon: TrendingUp },
  { id: "doctors",      label: "Врачи",      icon: Activity },
  { id: "funnel",       label: "Воронка",    icon: Filter },
  { id: "plans",        label: "Планы",      icon: Target },
  { id: "reports",      label: "Отчёты",     icon: FileText },
  { id: "admin",        label: "Настройки",  icon: Settings },
  { id: "about",        label: "О системе",  icon: Info },
];

interface Props {
  section:         Section;
  onSelectSection: (s: Section) => void;
}

export function Sidebar({ section, onSelectSection }: Props) {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        <div className="h-6 w-6 rounded-md bg-foreground" />
        <span className="text-[13px] font-semibold tracking-tight">Labvita Analytics</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelectSection(id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md mx-2 px-3 py-2 text-[13px] transition-colors",
              "w-[calc(100%-16px)]",
              section === id
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
