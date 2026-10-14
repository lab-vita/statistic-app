"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { Section } from "@/lib/permissions";
import { useAuth } from "@/components/auth-gate";
import {
  Home, Phone, Calendar, TrendingUp, FileText, Filter, Clock,
  Users, Settings, Info, Activity, ChevronLeft, Moon, Sun,
} from "lucide-react";

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "home",         label: "Главная",    icon: Home },
  { id: "calls",        label: "Звонки",     icon: Phone },
  { id: "appointments", label: "Записи",     icon: Calendar },
  { id: "revenue",      label: "Выручка",    icon: TrendingUp },
  { id: "doctors",      label: "Врачи",      icon: Users },
  { id: "funnel",       label: "Воронка",    icon: Filter },
  { id: "plans",        label: "Планы",      icon: Clock },
  { id: "reports",      label: "Отчёты",     icon: FileText },
  { id: "admin",        label: "Настройки",  icon: Settings },
  { id: "about",        label: "О системе",  icon: Info },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец", admin: "Администратор", viewer: "Наблюдатель",
};

const STORAGE_KEY = "pulse.sidebar.expanded";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]).join("").toUpperCase() || "—";
}

interface Props {
  section:         Section;
  onSelectSection: (s: Section) => void;
}

export function Sidebar({ section, onSelectSection }: Props) {
  const { user, canSee } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  // Сайдбар рендерится только на клиенте (внутри AuthGate), поэтому
  // начальное состояние можно читать из localStorage сразу.
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  function toggle() {
    setExpanded(v => {
      const next = !v;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  }

  const visible = SECTIONS.filter(s => s.id === "about" || canSee(s.id));
  const isDark  = resolvedTheme === "dark";

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar",
        "transition-[width] duration-200 ease-[cubic-bezier(.4,0,.2,1)]",
        expanded ? "w-[220px]" : "w-14",
      )}
    >
      {/* Logo / toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-label={expanded ? "Свернуть меню" : "Развернуть меню"}
        aria-expanded={expanded}
        className="flex h-[52px] shrink-0 items-center gap-[9px] overflow-hidden whitespace-nowrap border-b border-sidebar-border px-[15px] text-left"
      >
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-brand text-brand-foreground">
          <Activity className="h-[15px] w-[15px]" strokeWidth={2} />
        </span>
        <span className={cn(
          "flex-1 text-[14px] font-bold tracking-[-0.03em] transition-opacity duration-150",
          expanded ? "opacity-100" : "opacity-0",
        )}>
          Пульс
        </span>
        <ChevronLeft
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-text-3 transition-transform duration-200",
            !expanded && "-scale-x-100",
          )}
          strokeWidth={2}
        />
      </button>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-px overflow-y-auto overflow-x-hidden py-2">
        {visible.map(({ id, label, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectSection(id)}
              title={expanded ? undefined : label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "mx-2.5 flex h-9 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[7px] px-2.5 text-left transition-colors duration-100",
                active
                  ? "bg-brand text-brand-foreground"
                  : "text-text-3 hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
              <span className={cn(
                "text-[13px] font-medium transition-opacity duration-100",
                expanded ? "opacity-100" : "pointer-events-none opacity-0",
              )}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Theme */}
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        title={expanded ? undefined : (isDark ? "Светлая тема" : "Тёмная тема")}
        className="mx-2.5 mb-2 flex h-9 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[7px] px-2.5 text-text-3 transition-colors hover:bg-accent hover:text-foreground"
      >
        {isDark ? <Sun className="h-4 w-4 shrink-0" strokeWidth={1.6} /> : <Moon className="h-4 w-4 shrink-0" strokeWidth={1.6} />}
        <span className={cn("text-[13px] font-medium transition-opacity", expanded ? "opacity-100" : "opacity-0")}>
          {isDark ? "Светлая тема" : "Тёмная тема"}
        </span>
      </button>

      {/* User */}
      <div className="flex shrink-0 items-center gap-[9px] overflow-hidden whitespace-nowrap border-t border-sidebar-border p-[14px]">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-text-2"
          title={expanded ? undefined : user.name}
        >
          {initials(user.name)}
        </span>
        <div className={cn("min-w-0 transition-opacity duration-150", expanded ? "opacity-100" : "opacity-0")}>
          <div className="truncate text-[12px] font-semibold text-foreground">{user.name}</div>
          <div className="text-[10px] text-text-3">{ROLE_LABELS[user.role] ?? user.role}</div>
        </div>
      </div>
    </aside>
  );
}
