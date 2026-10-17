"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Phone, Calendar, TrendingUp, ArrowLeft, Check, Users, Filter, Clock, FileText, HeartPulse } from "lucide-react";
import {
  WIDGET_TYPES, WIDGET_GROUPS, COLS, GAP, ROW_H,
  type WidgetGroup, type WidgetTypeDef, type WidgetTypeId, type WidgetPermission,
} from "@/lib/grid";
import { sampleHomeData } from "@/lib/home-sample";
import { WidgetContent, WIDGET_OPTIONS } from "@/components/widgets/registry";
import { cn } from "@/lib/utils";

const GROUP_ICON: Record<WidgetGroup, React.ElementType> = {
  "Звонки":  Phone,
  "Записи":  Calendar,
  "Пациенты": HeartPulse,
  "Выручка": TrendingUp,
  "Врачи":   Users,
  "Воронка": Filter,
  "Планы":   Clock,
  "Отчёты":  FileText,
};

/** Ширина колонки, на которой рисуется превью (как на экране 1280px). */
const PREVIEW_COL = 86;

// ─── Превью: настоящий виджет на демо-данных, уменьшенный под карточку ──

export function ScaledPreview({ type, config, w, h, className }: {
  type: WidgetTypeId; config?: Record<string, string>; w: number; h: number; className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const data = useMemo(() => sampleHomeData(), []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const natW = w * PREVIEW_COL + (w - 1) * GAP;
  const natH = h * ROW_H + (h - 1) * GAP;
  const scale = box.w && box.h ? Math.min(box.w / natW, box.h / natH, 1) : 0;

  return (
    <div ref={boxRef} aria-hidden="true" className={cn("relative overflow-hidden", className)}>
      {scale > 0 && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 origin-center"
          style={{ width: natW, height: natH, transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          <WidgetContent pw={{ type, config }} data={data} loading={false} />
        </div>
      )}
    </div>
  );
}

// ─── Выбор настройки (метрики) ─────────────────────────────────────

export function WidgetOptionsPicker({ type, value, onChange }: {
  type: WidgetTypeId; value: string; onChange: (v: string) => void;
}) {
  const opt = WIDGET_OPTIONS[type];
  if (!opt) return null;
  return (
    <fieldset>
      <legend className="metric-label mb-2.5">{opt.title}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {opt.options.map(o => {
          const selected = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                selected ? "border-brand bg-brand-soft" : "border-border bg-card hover:border-brand/50",
              )}
            >
              <input
                type="radio" name={`opt-${type}`} value={o.value} checked={selected}
                onChange={() => onChange(o.value)} className="sr-only"
              />
              <span className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-brand bg-brand text-brand-foreground" : "border-border",
              )}>
                {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-foreground">{o.label}</span>
                {o.hint && <span className="block text-[11px] text-text-3">{o.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ─── Диалог ──────────────────────────────────────────────────────────────────────────────────

function Dialog({ title, subtitle, onClose, children, back }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; back?: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d2236]/40 p-4 backdrop-blur-[2px]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-pop outline-none"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
          {back && (
            <button type="button" onClick={back} aria-label="Назад"
              className="flex h-8 w-8 items-center justify-center rounded-[7px] text-text-3 transition-colors hover:bg-accent hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold tracking-[-0.02em]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-text-3">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть"
            className="flex h-8 w-8 items-center justify-center rounded-[7px] text-text-3 transition-colors hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Каталог виджетов ──────────────────────────────────────────────────────────────────────

interface WidgetCatalogProps {
  can:     (perm: WidgetPermission) => boolean;
  onAdd:   (type: WidgetTypeId, config?: Record<string, string>) => void;
  onClose: () => void;
}

export function WidgetCatalog({ can, onAdd, onClose }: WidgetCatalogProps) {
  const groups = WIDGET_GROUPS.filter(g => WIDGET_TYPES.some(d => d.group === g && can(d.permission)));
  const [group, setGroup] = useState<WidgetGroup>(groups[0] ?? "Звонки");
  const [configuring, setConfiguring] = useState<WidgetTypeDef | null>(null);
  const [value, setValue] = useState("");

  const items = WIDGET_TYPES.filter(d => d.group === group && can(d.permission));

  function pick(def: WidgetTypeDef) {
    const opt = WIDGET_OPTIONS[def.id];
    if (opt) {
      setConfiguring(def);
      setValue(opt.options[0].value);
    } else {
      onAdd(def.id);
    }
  }

  if (configuring) {
    const def = configuring;
    return (
      <Dialog title={def.name} subtitle="Выберите, что показывать в виджете" onClose={onClose} back={() => setConfiguring(null)}>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_300px]">
          <WidgetOptionsPicker type={def.id} value={value} onChange={setValue} />
          <div className="flex flex-col gap-3">
            <p className="metric-label">Как будет выглядеть</p>
            <ScaledPreview type={def.id} config={{ metric: value }} w={def.defaultW} h={def.defaultH}
              className="h-48 rounded-lg bg-background" />
            <button
              type="button"
              onClick={() => onAdd(def.id, { metric: value })}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[7px] bg-brand px-4 text-[13px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
            >
              <Plus className="h-4 w-4" /> Добавить на главную
            </button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Добавить виджет" onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-3 sm:w-48 sm:flex-col sm:border-b-0 sm:border-r" aria-label="Группы виджетов">
          {groups.map(g => {
            const Icon = GROUP_ICON[g];
            const active = g === group;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2.5 rounded-[7px] px-2.5 text-left text-[13px] font-medium transition-colors",
                  active ? "bg-brand text-brand-foreground" : "text-text-2 hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                {g}
                <span className={cn("ml-auto text-[11px] tabular-nums", active ? "text-brand-foreground/80" : "text-text-3")}>
                  {WIDGET_TYPES.filter(d => d.group === g && can(d.permission)).length}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map(def => (
              <div key={def.id} className="card-surface flex flex-col overflow-hidden">
                <ScaledPreview
                  type={def.id}
                  config={WIDGET_OPTIONS[def.id] ? { metric: WIDGET_OPTIONS[def.id]!.options[0].value } : undefined}
                  w={def.defaultW} h={def.defaultH}
                  className="h-44 border-b border-hairline bg-background"
                />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="section-title">{def.name}</h3>
                    <span className="shrink-0 text-[10px] font-semibold tabular-nums text-text-3">
                      {def.defaultW}/{COLS} ширины
                    </span>
                  </div>
                  <p className="mt-1 flex-1 text-[12px] leading-relaxed text-text-2">{def.description}</p>
                  <button
                    type="button"
                    onClick={() => pick(def)}
                    className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-[7px] bg-brand px-3.5 text-[12px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {WIDGET_OPTIONS[def.id] ? "Выбрать метрику" : "Добавить"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Настройки уже добавленного виджета ───────────────────────────

export function WidgetSettingsDialog({ type, name, value, onSave, onClose }: {
  type: WidgetTypeId; name: string; value: string;
  onSave: (v: string) => void; onClose: () => void;
}) {
  const [v, setV] = useState(value);
  const def = WIDGET_TYPES.find(d => d.id === type)!;
  return (
    <Dialog title={name} subtitle="Настройка виджета" onClose={onClose}>
      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_300px]">
        <WidgetOptionsPicker type={type} value={v} onChange={setV} />
        <div className="flex flex-col gap-3">
          <p className="metric-label">Как будет выглядеть</p>
          <ScaledPreview type={type} config={{ metric: v }} w={def.defaultW} h={def.defaultH}
            className="h-48 rounded-lg bg-background" />
          <button
            type="button"
            onClick={() => onSave(v)}
            className="inline-flex h-9 items-center justify-center rounded-[7px] bg-brand px-4 text-[13px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
          >
            Сохранить
          </button>
        </div>
      </div>
    </Dialog>
  );
}
