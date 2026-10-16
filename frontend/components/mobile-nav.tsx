"use client";

import { createContext, useContext } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * На узких экранах (меньше md, 768 px) боковое меню прячется и открывается
 * шторкой. Шапка страницы показывает кнопку, которая её открывает.
 */
export const MobileNavContext = createContext<{ open: () => void } | null>(null);

export function MenuButton({ className }: { className?: string }) {
  const nav = useContext(MobileNavContext);
  if (!nav) return null;
  return (
    <button
      type="button"
      onClick={nav.open}
      aria-label="Меню"
      data-tour="menu-button"
      className={cn(
        "-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] text-text-2 transition-colors hover:bg-accent hover:text-foreground md:hidden",
        className,
      )}
    >
      <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </button>
  );
}
