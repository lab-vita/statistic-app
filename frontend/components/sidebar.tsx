"use client";

import { useState } from "react";
import {
  LayoutDashboard, Phone, Calendar, Banknote,
  BarChart2, Target, ShieldCheck, Menu, X, Activity,
} from "lucide-react";
import { useAuth } from "@/components/auth-gate";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROLE_LABELS, type Section } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export type { Section };

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "home",         label: "Главная",  icon: LayoutDashboard },
  { id: "calls",        label: "Звонки",   icon: Phone           },
  { id: "appointments", label: "Записи",   icon: Calendar        },
  { id: "revenue",      label: "Выручка",  icon: Banknote        },
  { id: "reports",      label: "Отчёты",   icon: BarChart2       },
  { id: "plans",        label: "Планы",    icon: Target          },
  { id: "admin",        label: "Доступ",   icon: ShieldCheck     },
];

interface SidebarProps {
  section: Section;
  onSelectSection: (s: Section) => void;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 h-[52px]">
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground">
        <Activity className="h-3.5 w-3.5 text-background" strokeWidth={2.5} />
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
      </div>
      <div>
        <p className="text-[13px] font-semibold leading-none tracking-tight">Пульс</p>
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50 mt-0.5">
          Аналитика
        </p>
      </div>
    </div>
  );
}

function NavContent({ section, onSelectSection, onAfter }: SidebarProps & { onAfter?: () => void }) {
  const { user, canSee } = useAuth();
  return (
    <div className="flex flex-col h-full bg-sidebar">
      <Brand />
      <div className="h-px bg-border" />

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.filter(n => canSee(n.id)).map(({ id, label, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => { onSelectSection(id); onAfter?.(); }}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", active ? "text-background" : "text-muted-foreground/60")}
                strokeWidth={active ? 2.5 : 2}
              />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="h-px bg-border" />
      <div className="px-3 py-3 flex items-center gap-2.5">
        <div className="h-7 w-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
          {(user.name?.[0] ?? "?").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium leading-none truncate">{user.name || `ID ${user.id}`}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{ROLE_LABELS[user.role] ?? user.role}</p>
        </div>
      </div>

      <div className="h-px bg-border" />
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-[11px] text-muted-foreground/50">Тема</span>
        <ThemeToggle />
      </div>
    </div>
  );
}

export function Sidebar({ section, onSelectSection }: SidebarProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-[210px] shrink-0 flex-col border-r border-border">
        <NavContent section={section} onSelectSection={onSelectSection} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex lg:hidden h-12 items-center justify-between border-b border-border bg-sidebar px-4 shrink-0">
        <Brand />
        <button
          onClick={() => setOpen(v => !v)}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-black/25" onClick={() => setOpen(false)} />
          <aside className="relative w-[210px] border-r border-border shadow-xl">
            <NavContent section={section} onSelectSection={onSelectSection} onAfter={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
