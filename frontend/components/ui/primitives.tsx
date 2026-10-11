"use client";

// Переиспользуемые примитивы дизайн-системы
// Используются во всех страницах

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { DeltaDir } from "@/lib/api";

// ── Delta badge ────────────────────────────────────────────────────────
interface DeltaProps {
  dir?:    DeltaDir;
  pct?:    number | null;
  invert?: boolean;
  size?:   "sm" | "md";
}

export function Delta({ dir, pct, invert, size = "sm" }: DeltaProps) {
  const px = size === "md" ? "px-2 py-1 text-[12px]" : "px-1.5 py-0.5 text-[11px]";
  if (!dir || dir === "flat" || pct == null) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted font-medium text-muted-foreground", px)}>
        <Minus className="h-2.5 w-2.5" />
        без изменений
      </span>
    );
  }
  const good = invert ? dir === "down" : dir === "up";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-medium",
      px,
      good
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : "bg-red-500/10 text-red-700 dark:text-red-400"
    )}>
      {dir === "up"
        ? <TrendingUp className="h-2.5 w-2.5" />
        : <TrendingDown className="h-2.5 w-2.5" />}
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
  green:  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  red:    "bg-red-500/10 text-red-700 dark:text-red-400",
  amber:  "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  blue:   "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  muted:  "bg-muted text-muted-foreground",
};

interface StatusPillProps {
  color?:    PillColor;
  children:  React.ReactNode;
  className?: string;
}

export function StatusPill({ color = "muted", children, className }: StatusPillProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
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
  children?:    React.ReactNode;
}

export function MetricCard({
  label, value, sub, valueClass,
  deltaDir, deltaPct, invert,
  planPct, planLabel, planInvert,
  children,
}: MetricCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col">
      <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-3">
        {label}
      </p>
      <p className={cn(
        "text-[26px] font-bold leading-none tracking-tight tabular-nums mb-1",
        valueClass ?? "text-foreground"
      )}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">{sub}</p>
      )}
      {planPct != null && (
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between">
            {planLabel && <span className="text-[11px] text-muted-foreground/60">{planLabel}</span>}
            <span className={cn(
              "text-[11px] font-bold tabular-nums ml-auto",
              planInvert
                ? planPct <= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                : planPct >= 80  ? "text-emerald-600 dark:text-emerald-400"
                : planPct >= 50  ? "text-amber-600  dark:text-amber-400"
                :                  "text-red-600    dark:text-red-400"
            )}>
              {planPct}%
            </span>
          </div>
          <ProgressBar pct={planPct} invert={planInvert} />
        </div>
      )}
      {deltaDir !== undefined && (
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
    <div className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {right && <div className="text-[11px] text-muted-foreground/60">{right}</div>}
      </div>
      <div className={cn(noPad ? "" : "p-4")}>{children}</div>
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
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[.07em]" style={{ color: nameColor }}>
          {name}
        </span>
        <span className="text-[12px] font-semibold tabular-nums" style={{ color: nameColor }}>
          {count} · {pct}%
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

// ── Tab group ──────────────────────────────────────────────────────────
interface TabGroupProps {
  items:    string[];
  active:   string;
  onChange: (v: string) => void;
  small?:   boolean;
}

export function TabGroup({ items, active, onChange, small }: TabGroupProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 gap-0.5">
      {items.map(item => (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={cn(
            "rounded-md font-medium transition-all duration-150",
            small ? "px-2.5 py-1 text-[11px]" : "px-3 py-1 text-[12px]",
            active === item
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
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
      "px-4 py-2.5 text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 bg-muted/30 border-b border-border whitespace-nowrap",
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
      "px-4 py-2.5 border-b border-border text-[13px] tabular-nums",
      right   ? "text-right"          : "text-left",
      bold    ? "font-bold"           : "font-normal",
      muted   ? "text-muted-foreground/60" : "",
      className
    )} style={color ? { color } : undefined}>
      {children}
    </td>
  );
}

// ── Spark line ─────────────────────────────────────────────────────────
export function SparkLine({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 64, h = 32, pad = 2;
  const xs = values.map((_, i) => pad + (i / (values.length - 1)) * (w - pad * 2));
  const ys = values.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const area = `${pts} ${xs[xs.length-1]},${h} ${xs[0]},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polygon points={area} fill={color} fillOpacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ── Page wrapper ───────────────────────────────────────────────────────
export function PageContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1400px] px-4 lg:px-5 py-5 space-y-4">
        {children}
      </div>
    </main>
  );
}

// ── Topbar ─────────────────────────────────────────────────────────────
interface TopbarProps {
  title:          string;
  filterLabel?:   string;
  onFilterClick?: () => void;
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
  title, filterLabel, onFilterClick,
  periodItems, period, onPeriod,
  periodLabel, onPrev, onNext, nextDisabled,
  onRefresh, refreshing, extra,
}: TopbarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-card px-4 lg:px-5">
      <span className="text-[13px] font-bold whitespace-nowrap">{title}</span>

      {filterLabel && (
        <button
          onClick={onFilterClick}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-colors"
        >
          {filterLabel}
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      <div className="flex-1" />

      {extra}

      {periodItems && period && onPeriod && (
        <TabGroup items={periodItems} active={period} onChange={onPeriod} />
      )}

      {periodLabel && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={onPrev}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-base"
          >
            ‹
          </button>
          <span className="text-[12px] font-medium tabular-nums min-w-[120px] text-center">
            {periodLabel}
          </span>
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-base disabled:opacity-40 disabled:pointer-events-none"
          >
            ›
          </button>
        </div>
      )}

      <div className="h-4 w-px bg-border" />

      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40"
      >
        <svg className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </button>
    </header>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-lg bg-muted/60 animate-pulse", className)} />;
}

export function SkeletonCards({ cols = 4, count }: { cols?: number; count?: number }) {
  const n = count ?? cols;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

// ── Empty ──────────────────────────────────────────────────────────────
export function Empty({ text = "Нет данных за выбранный период" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-14">
      <p className="text-[13px] text-muted-foreground/50">{text}</p>
    </div>
  );
}

// ── Error banner ───────────────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] text-red-600 dark:text-red-400">
      {message}
    </div>
  );
}
