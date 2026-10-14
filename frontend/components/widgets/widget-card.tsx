"use client";

// Общая оболочка виджетов главной: карточка «Пульса», заголовок, скелетон,
// пустое состояние и бейдж изменения к прошлому периоду.

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { deltaIsGood, noDeltaLabel } from "@/lib/call-metrics";
import { cn } from "@/lib/utils";

export function WidgetCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("@container card-surface flex h-full min-h-0 flex-col overflow-hidden px-5 py-[18px]", className)}>
      {children}
    </div>
  );
}

/** Заголовок карточки: «Судьба звонков · 762 поступило» и место под переключатель справа. */
export function WidgetHeader({ title, meta, right }: {
  title: string; meta?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 flex shrink-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="section-title truncate">{title}</h3>
        {meta && <p className="mt-0.5 truncate text-[11px] font-medium text-text-3">{meta}</p>}
      </div>
      {right}
    </div>
  );
}

export function WidgetLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("metric-label truncate", className)}>{children}</p>;
}

export function WidgetSkeleton() {
  return <div className="h-full animate-pulse rounded-lg bg-card shadow-card" />;
}

export function WidgetEmpty({ icon: Icon, text, hint }: {
  icon: React.ElementType; text: string; hint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
      <Icon className="mb-1 h-7 w-7 text-text-3/40" strokeWidth={1.5} />
      <p className="text-[12px] font-medium text-text-2">{text}</p>
      {hint && <p className="text-[11px] text-text-3">{hint}</p>}
    </div>
  );
}

/** Бейдж «+8%» / «−3%»; без сравнения — тихая подпись. invert: рост — это плохо. */
export function DeltaBadge({ pct, dir, invert = false }: {
  pct: number | null | undefined; dir: string | null | undefined; invert?: boolean;
}) {
  if (pct == null || !dir || dir === "flat") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-text-3">
        <Minus className="h-3 w-3" strokeWidth={2} />
        {noDeltaLabel(pct ?? null, dir)}
      </span>
    );
  }
  const good = deltaIsGood(dir, invert);
  return (
    <span className={cn(
      "inline-flex items-center gap-[3px] rounded-[5px] px-[7px] py-[3px] text-[11px] font-bold tabular-nums",
      good
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-red-500/10 text-red-600 dark:text-red-400",
    )}>
      {dir === "up"
        ? <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
        : <TrendingDown className="h-2.5 w-2.5" strokeWidth={2.5} />}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

/** Сегментная полоса: доли частей от целого. */
export function SegmentBar({ segments, total, height = 6 }: {
  segments: { key: string; value: number; color: string }[];
  total: number;
  height?: number;
}) {
  return (
    <div className="flex w-full gap-px overflow-hidden rounded-full bg-border" style={{ height }}>
      {segments.filter(s => s.value > 0).map(s => (
        <div
          key={s.key}
          className="h-full transition-all duration-500"
          style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%`, background: s.color }}
        />
      ))}
    </div>
  );
}

/** Строка легенды: цветная точка, подпись, число и доля. */
export function LegendRow({ color, label, value, share }: {
  color: string; label: string; value: string; share?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[11px]">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate text-text-2">{label}</span>
      <span className="ml-auto shrink-0 font-bold tabular-nums text-foreground">{value}</span>
      {share && <span className="w-11 shrink-0 text-right tabular-nums text-text-3">{share}</span>}
    </div>
  );
}

/** Цвета серий в палитре «Пульса» (SVG и inline-стили не понимают классы Tailwind). */
export const C = {
  green:  "#1a9e6e",
  blue:   "#328fcd",
  red:    "#e03a5a",
  amber:  "#e09020",
  violet: "#8b5cf6",
  slate:  "#94b3c9",
} as const;
