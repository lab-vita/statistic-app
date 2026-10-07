"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Phone,
  Calendar,
  BarChart2,
  Target,
  Banknote,
  ShieldCheck,
  Activity,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-gate";
import { ROLE_LABELS, type Section } from "@/lib/permissions";
import { useState } from "react";

export type { Section };

interface SidebarProps {
  section: Section;
  onSelectSection: (s: Section) => void;
}

const SECTIONS = [
  { id: "home" as Section, label: "Главная", icon: LayoutDashboard },
  { id: "calls" as Section, label: "Звонки", icon: Phone },
  { id: "appointments" as Section, label: "Записи", icon: Calendar },
  { id: "revenue" as Section, label: "Выручка", icon: Banknote },
  { id: "reports" as Section, label: "Отчёты", icon: BarChart2 },
  { id: "plans" as Section, label: "Планы", icon: Target },
  { id: "admin" as Section, label: "Доступ", icon: ShieldCheck },
];

/** Логотип Пульс — пульсирующая точка + вордмарк */
function PulseBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
        <Activity className="h-4 w-4" strokeWidth={2.5} />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background dark:ring-sidebar animate-pulse" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">Пульс</span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Аналитика
        </span>
      </div>
    </div>
  );
}

function SidebarContent({
  section,
  onSelectSection,
  onAfterSelect,
}: SidebarProps & { onAfterSelect?: () => void }) {
  const { user, canSee } = useAuth();

  return (
    <>
      {/* Brand */}
      <div className="flex h-[60px] items-center px-4">
        <PulseBrand />
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Навигация
        </p>
        {SECTIONS.filter(({ id }) => canSee(id)).map(({ id, label, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => {
                onSelectSection(id);
                onAfterSelect?.();
              }}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  active ? "text-background" : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              {label}
            </button>
          );
        })}
      </nav>

      <Separator />

      {/* User */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {(user.name?.[0] ?? String(user.id)[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium leading-none" title={user.name}>
              {user.name || `ID ${user.id}`}
            </div>
            <div className="text-[11px] leading-none text-muted-foreground mt-1">
              {ROLE_LABELS[user.role] ?? user.role}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Theme toggle */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Тема</span>
        <ThemeToggle />
      </div>
    </>
  );
}

export function Sidebar({ section, onSelectSection }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <SidebarContent section={section} onSelectSection={onSelectSection} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <PulseBrand />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative flex w-[260px] flex-col bg-sidebar shadow-xl animate-in slide-in-from-left">
            <SidebarContent
              section={section}
              onSelectSection={onSelectSection}
              onAfterSelect={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
