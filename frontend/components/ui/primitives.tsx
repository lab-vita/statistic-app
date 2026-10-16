"use client";

// Переиспользуемые примитивы дизайн-системы «Пульс»
// Используются во всех страницах. Визуальные правила — DESIGN.md.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight,
  ChevronDown, CalendarDays, RefreshCw, Inbox,
} from "lucide-react";
import type { DeltaDir } from "@/lib/api";
import { MenuButton } from "@/components/mobile-nav";

// ── Delta badge ────────────────────────────────────────────────────────
interface DeltaProps {
  dir?:    DeltaDir;
  pct?:    number | null;
  invert?: boolean;
  size?:   "sm" | "md";
}

export function Delta({ dir, pct, invert, size = "sm" }: DeltaProps) {
  const px = size === "md" ? "px-2 py-1 text-[12px]" : "px-[7px] py-[3px] text-[11px]";
  if (!dir || dir === "flat" || pct == null) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-[5px] bg-accent font-bold text-text-2", px)}>
        <Minus className="h-2.5 w-2.5" strokeWidth={2.5} />
        без изменений
      </span>
    );
  }
  const good = invert ? dir === "down" : dir === "up";
  return (
    <span className={cn(
      "inline-flex items-center gap-[3px] rounded-[5px] font-bold tabular-nums",
      px,
      good
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-red-500/10 text-red-600 dark:text-red-400"
    )}>
      {dir === "up"
        ? <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
        : <TrendingDown className="h-2.5 w-2.5" strokeWidth={2.5} />}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────
interface ProgressBarProps {
  pct:     number;
  invert?: boolean;
  height?: number;
}

export function ProgressBar({ pct, invert, height = 4 }: ProgressBarProps) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const color = invert
    ? (pct <= 100 ? "bg-emerald-500" : "bg-red-500")
    : (pct >= 80  ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500");

  return (
    <div className="w-full overflow-hidden rounded-full bg-border" style={{ height }}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────
type PillColor = "green" | "red" | "amber" | "blue" | "violet" | "muted";

const PILL_STYLES: Record<PillColor, string> = {
  green:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  red:    "bg-red-500/10 text-red-600 dark:text-red-400",
  amber:  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  blue:   "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  muted:  "bg-accent text-text-2",
};

interface StatusPillProps {
  color?:    PillColor;
  children:  React.ReactNode;
  className?: string;
}

export function StatusPill({ color = "muted", children, className }: StatusPillProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
      PILL_STYLES[color],
      className
    )}>
      {children}
    </span>
  );
}

// ── Metric Card ────────────────────────────────────────────────────────
interface MetricCardProps {
  label:        string;
  value:        string | number;
  sub?:         string;
  valueClass?:  string;
  deltaDir?:    DeltaDir;
  deltaPct?:    number | null;
  invert?:      boolean;
  planPct?:     number | null;
  planLabel?:   string;
  planInvert?:  boolean;
  icon?:        React.ReactNode;
  iconTone?:    "blue" | "green" | "red" | "amber";
  children?:    React.ReactNode;
}

const ICON_TONE: Record<NonNullable<MetricCardProps["iconTone"]>, string> = {
  blue:  "bg-blue-500/10 text-blue-500 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
  red:   "bg-red-500/10 text-red-500 dark:text-red-400",
  amber: "bg-amber-500/10 text-amber-500 dark:text-amber-400",
};

export function MetricCard({
  label, value, sub, valueClass,
  deltaDir, deltaPct, invert,
  planPct, planLabel, planInvert,
  icon, iconTone = "blue",
  children,
}: MetricCardProps) {
  const hasTop = !!icon;
  return (
    <div className="card-surface @container flex min-w-0 flex-col px-4 py-4 sm:px-5 sm:py-[18px]">
      {hasTop && (
        <div className="mb-3.5 flex items-start justify-between">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-[9px] [&_svg]:h-[18px] [&_svg]:w-[18px]", ICON_TONE[iconTone])}>
            {icon}
          </span>
          {deltaDir !== undefined && <Delta dir={deltaDir} pct={deltaPct} invert={invert} />}
        </div>
      )}
      <p className="metric-label mb-[5px]">{label}</p>
      <p className={cn(
        // крупная цифра уменьшается в узкой карточке (две карточки в ряд на телефоне)
        "mb-1 text-[length:min(30px,15cqw)] font-extrabold leading-none tracking-[-0.04em] tabular-nums",
        valueClass ?? "text-foreground"
      )}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] leading-snug text-text-3">{sub}</p>
      )}
      {planPct != null && (
        <div className="mt-3.5 space-y-1.5 border-t border-hairline pt-3">
          <div className="flex justify-between">
            {planLabel && <span className="text-[11px] text-text-3">{planLabel}</span>}
            <span className={cn(
              "ml-auto text-[11px] font-bold tabular-nums",
              planInvert
                ? planPct <= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                : planPct >= 80  ? "text-emerald-600 dark:text-emerald-400"
                : planPct >= 50  ? "text-amber-600 dark:text-amber-400"
                :                  "text-red-600 dark:text-red-400"
            )}>
              {planPct}%
            </span>
          </div>
          <ProgressBar pct={planPct} invert={planInvert} />
        </div>
      )}
      {deltaDir !== undefined && !hasTop && (
        <div className="mt-3">
          <Delta dir={deltaDir} pct={deltaPct} invert={invert} />
        </div>
      )}
      {children}
    </div>
  );
}

// ── Section card ───────────────────────────────────────────────────────
interface SectionCardProps {
  title:     string;
  right?:    React.ReactNode;
  children:  React.ReactNode;
  className?: string;
  noPad?:    boolean;
}

export function SectionCard({ title, right, children, className, noPad }: SectionCardProps) {
  return (
    <div className={cn("card-surface overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-[18px] pb-3">
        <h3 className="section-title">{title}</h3>
        {right && <div className="text-[11px] font-medium text-text-3">{right}</div>}
      </div>
      <div className={cn(noPad ? "" : "px-5 pb-[18px]")}>{children}</div>
    </div>
  );
}

// ── Source bar row ─────────────────────────────────────────────────────
interface SrcBarProps {
  name:      string;
  nameColor: string;
  count:     number;
  pct:       number;
  barColor:  string;
}

export function SrcBar({ name, nameColor, count, pct, barColor }: SrcBarProps) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-[7px] text-[12px] font-medium text-text-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: nameColor }} />
          {name}
        </span>
        <span className="text-[12px] tabular-nums">
          <span className="font-bold text-foreground">{count}</span>
          <span className="ml-1.5 text-[11px] text-text-3">{pct}%</span>
        </span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

// ── Tab group (чипы) ───────────────────────────────────────────────────
interface TabGroupProps {
  items:    string[];
  active:   string;
  onChange: (v: string) => void;
  small?:   boolean;
}

export function TabGroup({ items, active, onChange, small }: TabGroupProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5" role="tablist">
      {items.map(item => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={active === item}
          onClick={() => onChange(item)}
          className={cn(
            "rounded-full border font-semibold transition-colors duration-100",
            small ? "px-2.5 py-[3px] text-[11px]" : "px-3.5 py-[5px] text-[12px]",
            active === item
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-text-2 hover:border-brand hover:text-brand"
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

// ── Table helpers ──────────────────────────────────────────────────────
export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn(
      "whitespace-nowrap border-b border-hairline px-4 py-2 text-[10px] font-bold uppercase tracking-[.06em] text-text-3",
      right ? "text-right" : "text-left"
    )}>
      {children}
    </th>
  );
}

export function Td({ children, right, color, bold, muted, className }: {
  children?:  React.ReactNode;
  right?:     boolean;
  color?:     string;
  bold?:      boolean;
  muted?:     boolean;
  className?: string;
}) {
  return (
    <td className={cn(
      "border-b border-hairline px-4 py-[9px] text-[12px] tabular-nums",
      right   ? "text-right"   : "text-left",
      bold    ? "font-bold"    : "font-normal",
      muted   ? "text-text-3"  : "",
      className
    )} style={color ? { color } : undefined}>
      {children}
    </td>
  );
}

// ── Spark line ─────────────────────────────────────────────────────────
export function SparkLine({ values, color, width = 64, height = 32 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = width, h = height, pad = 2;
  const xs = values.map((_, i) => pad + (i / (values.length - 1)) * (w - pad * 2));
  const ys = values.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const area = `${pts} ${xs[xs.length-1]},${h} ${xs[0]},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polygon points={area} fill={color} fillOpacity={0.14} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Page wrapper ───────────────────────────────────────────────────────
export function PageContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto max-w-[1400px] space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-5 lg:px-6 min-[1800px]:max-w-[1640px]">
        {children}
      </div>
    </main>
  );
}

// ── Popover (лёгкий, без зависимостей) ─────────────────────────────────
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export function MenuPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "absolute left-0 top-[calc(100%+6px)] z-50 min-w-[140px] max-w-[calc(100vw-24px)] rounded-lg border border-border bg-popover p-1 shadow-pop",
      className,
    )}>
      {children}
    </div>
  );
}

export function MenuItem({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[5px] px-2.5 py-[7px] text-left text-[12px] font-medium transition-colors",
        active ? "font-semibold text-brand" : "pl-6 text-text-2 hover:bg-accent hover:text-foreground",
      )}
    >
      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[.07em] text-text-3">{children}</div>;
}

export function MenuDivider() {
  return <div className="mx-1.5 my-1 h-px bg-hairline" />;
}

// ── Header building blocks ─────────────────────────────────────────────
export function PageHeader({ title, children, className }: { title: string; children?: React.ReactNode; className?: string }) {
  return (
    <header className={cn(
      "flex min-h-[52px] shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-border bg-card px-3 py-2 sm:px-4 lg:px-6",
      className,
    )}>
      <MenuButton />
      <h1 data-tour="page-title" className="whitespace-nowrap text-[14px] font-bold tracking-[-0.02em]">{title}</h1>
      {children}
    </header>
  );
}

/**
 * Правая группа шапки: период, даты, обновление. На телефоне уходит на
 * отдельную строку во всю ширину, разделители между кнопками прячутся.
 */
export function HeaderControls({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "ml-auto flex min-w-0 items-center gap-2.5 max-sm:w-full max-sm:justify-between max-sm:gap-2",
      className,
    )}>
      {children}
    </div>
  );
}

/** Акцентная «пилюля» выбора периода с выпадающим списком (как в макете). */
export function PeriodPill({ items, active, onChange }: { items: string[]; active: string; onChange: (v: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="relative" ref={ref} data-tour="period">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-7 items-center gap-[5px] rounded-[7px] bg-brand pl-2 pr-2.5 text-[12px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
      >
        <CalendarDays className="h-3 w-3" strokeWidth={1.8} />
        {active}
        <ChevronDown className={cn("h-2.5 w-2.5 opacity-60 transition-transform", open && "rotate-180")} strokeWidth={2.5} />
      </button>
      {open && (
        <MenuPanel className="min-w-[130px]">
          {items.map(it => (
            <MenuItem key={it} active={it === active} onClick={() => { onChange(it); setOpen(false); }}>
              {it}
            </MenuItem>
          ))}
        </MenuPanel>
      )}
    </div>
  );
}

/** ‹ Октябрь 2026 › */
export function DateNav({ label, onPrev, onNext, nextDisabled }: {
  label: string; onPrev?: () => void; onNext?: () => void; nextDisabled?: boolean;
}) {
  const btn = "flex h-7 w-7 items-center justify-center rounded-[5px] text-text-3 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35";
  return (
    <div className="flex items-center gap-1.5" data-tour="date-nav">
      <button type="button" onClick={onPrev} className={btn} aria-label="Предыдущий период">
        <ChevronLeft className="h-3 w-3" strokeWidth={2.2} />
      </button>
      <span className="min-w-[112px] whitespace-nowrap text-center text-[12px] font-medium tabular-nums text-text-2 first-letter:uppercase">
        {label}
      </span>
      <button type="button" onClick={onNext} disabled={nextDisabled} className={btn} aria-label="Следующий период">
        <ChevronRight className="h-3 w-3" strokeWidth={2.2} />
      </button>
    </div>
  );
}

export function HeaderDivider() {
  return <div className="h-5 w-px shrink-0 bg-border max-sm:hidden" />;
}

export function RefreshButton({ onClick, refreshing }: { onClick?: () => void; refreshing?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      aria-label="Обновить данные"
      data-tour="refresh"
      className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-border bg-card text-text-3 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} strokeWidth={1.8} />
    </button>
  );
}

/** Кнопка-фильтр с выпадающим меню (оператор, сотрудник и т.п.). */
export function FilterButton({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="relative" ref={ref} data-tour="filter">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-[7px] border px-2.5 text-[12px] font-semibold transition-colors",
          open
            ? "border-brand text-brand"
            : "border-border bg-card text-text-2 hover:border-brand/50 hover:text-foreground",
        )}
      >
        {label}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} strokeWidth={2.2} />
      </button>
      {open && (
        <MenuPanel className="max-h-80 min-w-[200px] overflow-y-auto">
          {children(() => setOpen(false))}
        </MenuPanel>
      )}
    </div>
  );
}

// ── Topbar ─────────────────────────────────────────────────────────────
interface TopbarProps {
  title:          string;
  filterLabel?:   string;
  /** Содержимое меню фильтра; получает функцию закрытия. */
  filterMenu?:    (close: () => void) => React.ReactNode;
  periodItems?:   string[];
  period?:        string;
  onPeriod?:      (v: string) => void;
  periodLabel?:   string;
  onPrev?:        () => void;
  onNext?:        () => void;
  nextDisabled?:  boolean;
  onRefresh?:     () => void;
  refreshing?:    boolean;
  extra?:         React.ReactNode;
}

export function Topbar({
  title, filterLabel, filterMenu,
  periodItems, period, onPeriod,
  periodLabel, onPrev, onNext, nextDisabled,
  onRefresh, refreshing, extra,
}: TopbarProps) {
  return (
    <PageHeader title={title}>
      {filterLabel && filterMenu && (
        <FilterButton label={filterLabel}>{filterMenu}</FilterButton>
      )}

      <HeaderControls>
        {extra}

        {periodItems && period && onPeriod && (
          <PeriodPill items={periodItems} active={period} onChange={onPeriod} />
        )}

        {periodLabel && (
          <>
            <HeaderDivider />
            <DateNav label={periodLabel} onPrev={onPrev} onNext={onNext} nextDisabled={nextDisabled} />
          </>
        )}

        {onRefresh && (
          <>
            <HeaderDivider />
            <RefreshButton onClick={onRefresh} refreshing={refreshing} />
          </>
        )}
      </HeaderControls>
    </PageHeader>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-card shadow-card", className)} />;
}

export function SkeletonCards({ cols = 4, count }: { cols?: number; count?: number }) {
  const n = count ?? cols;
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  );
}

// ── Empty ────────────────────────────────────────────────────────────────
export function Empty({ text = "Нет данных за выбранный период" }: { text?: string }) {
  return (
    <div className="card-surface flex flex-col items-center justify-center py-14 text-center">
      <Inbox className="mb-3 h-8 w-8 text-text-3/50" strokeWidth={1.5} />
      <p className="text-[13px] text-text-3">{text}</p>
    </div>
  );
}

// ── Error banner ────────────────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] font-medium text-red-600 dark:text-red-400">
      {message}
    </div>
  );
}
