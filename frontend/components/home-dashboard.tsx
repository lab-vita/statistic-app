"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable,
  type DragStartEvent, type DragMoveEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, X, Settings2, Plus, RotateCcw, Check, LayoutGrid } from "lucide-react";
import {
  COLS, GAP, ROW_H, WIDGET_TYPES,
  defaultLayout, sanitizeGrid, findFreeSlot, placeWidget, moveWidget, compactGrid, newId, widgetDef,
  type PlacedWidget, type WidgetTypeId, type WidgetPermission,
} from "@/lib/grid";
import type { HomeData } from "@/lib/home-data";
import { cachedHomeLayout, fetchHomeLayout, saveHomeLayout } from "@/lib/home-layout";
import { Skeleton } from "@/components/ui/primitives";
import { WidgetContent, WIDGET_OPTIONS, widgetCaption } from "@/components/widgets/registry";
import { WidgetCatalog, WidgetSettingsDialog } from "@/components/widget-catalog";
import { cn } from "@/lib/utils";

/**
 * Ширина области виджетов → раскладка:
 *  ≥ 900 px — сетка 12 колонок, как настроил пользователь (можно двигать и тянуть);
 *  560–900  — две колонки: узкие виджеты попарно, широкие во всю ширину;
 *  < 560    — одна колонка (телефон, узкое окно Битрикс24); виджеты с одной
 *             цифрой (ширина 3 и меньше) — по два в ряд.
 * Порядок в колонках — как на сетке: сверху вниз, слева направо.
 */
const GRID_FROM = 900;
const TWO_COLS_FROM = 560;
/** на телефоне по два в ряд встают только самые маленькие виджеты (одна цифра) */
const PAIR_SMALL_FROM = 340;

const px = {
  left:   (x: number, col: number) => x * (col + GAP),
  top:    (y: number) => y * (ROW_H + GAP),
  width:  (w: number, col: number) => w * col + (w - 1) * GAP,
  height: (h: number) => h * ROW_H + (h - 1) * GAP,
};

// ─── Виджет на сетке ────────────────────────────────────────────────────────────────────

function GridItem({ pw, col, editMode, hidden, data, loading, onDelete, onSettings, onResizeStart }: {
  pw: PlacedWidget; col: number; editMode: boolean; hidden: boolean;
  data: HomeData; loading: boolean;
  onDelete: (id: string) => void;
  onSettings: (pw: PlacedWidget) => void;
  onResizeStart: (e: React.PointerEvent, pw: PlacedWidget) => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: pw.id, disabled: !editMode });
  const def = widgetDef(pw.type)!;
  const caption = widgetCaption(pw, def.name);

  return (
    <div
      ref={setNodeRef}
      className="absolute transition-[left,top,width,height] duration-150 ease-out"
      style={{
        left: px.left(pw.x, col), top: px.top(pw.y),
        width: px.width(pw.w, col), height: px.height(pw.h),
        opacity: hidden ? 0 : 1,
      }}
    >
      <div className={cn("h-full", editMode && "pointer-events-none select-none")} inert={editMode || undefined}>
        <WidgetContent pw={pw} data={data} loading={loading} />
      </div>

      {editMode && (
        <div className="absolute inset-0 rounded-lg outline-dashed outline-[1.5px] outline-offset-0 outline-brand/45">
          <div className="absolute inset-x-0 top-0 flex items-center gap-1 rounded-t-lg bg-card/95 px-1.5 py-1 shadow-card">
            <button
              type="button"
              {...listeners} {...attributes}
              aria-label={`Переместить: ${caption}`}
              className="flex h-7 min-w-0 flex-1 cursor-grab items-center gap-1.5 rounded-[5px] px-1.5 text-left text-[11px] font-semibold text-text-2 hover:bg-accent active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-text-3" />
              <span className="truncate">{caption}</span>
            </button>
            {WIDGET_OPTIONS[pw.type] && (
              <button type="button" onClick={() => onSettings(pw)} aria-label={`Настроить: ${caption}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] text-text-3 hover:bg-accent hover:text-foreground">
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={() => onDelete(pw.id)} aria-label={`Убрать: ${caption}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] text-text-3 hover:bg-red-500/10 hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div
            onPointerDown={e => onResizeStart(e, pw)}
            role="presentation"
            title="Потяните, чтобы изменить размер"
            className="absolute bottom-0 right-0 flex h-6 w-6 cursor-se-resize items-end justify-end rounded-br-lg p-1 text-brand"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <line x1="2" y1="9" x2="9" y2="2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="6" y1="9" x2="9" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

function GridGuides({ rows, col }: { rows: number; col: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: rows }).map((_, y) =>
        Array.from({ length: COLS }).map((_, x) => (
          <div
            key={`${y}-${x}`}
            className="absolute rounded-md border border-dashed border-brand/15"
            style={{ left: px.left(x, col), top: px.top(y), width: col, height: ROW_H }}
          />
        )),
      )}
    </div>
  );
}

function Ghost({ x, y, w, h, col, label }: { x: number; y: number; w: number; h: number; col: number; label?: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 rounded-lg border-2 border-dashed border-brand bg-brand/[0.06] transition-[left,top,width,height] duration-75"
      style={{ left: px.left(x, col), top: px.top(y), width: px.width(w, col), height: px.height(h) }}
    >
      {label && <span className="absolute bottom-2 right-3 text-[11px] font-bold tabular-nums text-brand">{label}</span>}
    </div>
  );
}

// ─── Дашборд ──────────────────────────────────────────────────────────────────────────────

interface Props {
  data:        HomeData;
  loading:     boolean;
  editMode:    boolean;
  onEditMode:  (v: boolean) => void;
  can:         (perm: WidgetPermission) => boolean;
  /** сообщает странице, какие данные нужны виджетам на экране */
  onLayout?:   (widgets: PlacedWidget[]) => void;
}

/**
 * Раскладка хранится на сервере у сотрудника — одна на все компьютеры и браузеры.
 * Пока она грузится, показываем заготовку сетки.
 */
export function HomeDashboard(props: Props) {
  const { can } = props;
  const allowed = useCallback((pw: PlacedWidget) => {
    const def = widgetDef(pw.type);
    return !!def && can(def.permission);
  }, [can]);

  // undefined — ещё не загрузили; null — сотрудник не настраивал главную
  const [saved, setSaved] = useState<PlacedWidget[] | null | undefined>(() => cachedHomeLayout());
  useEffect(() => {
    if (saved !== undefined) return;
    let alive = true;
    fetchHomeLayout()
      .then(l => { if (alive) setSaved(l); })
      .catch(() => { if (alive) setSaved(null); });   // нет связи — набор по умолчанию
    return () => { alive = false; };
  }, [saved]);

  if (saved === undefined) return <LayoutSkeleton />;
  return (
    <Dashboard
      {...props}
      allowed={allowed}
      initial={saved ? sanitizeGrid(saved).filter(allowed) : defaultLayout(allowed)}
      initialCustom={saved !== null}
    />
  );
}

function LayoutSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4" aria-busy="true" aria-label="Загружаем главную">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[166px]" />)}
      <Skeleton className="col-span-2 h-[166px] md:col-span-4" />
      <Skeleton className="col-span-2 h-[256px] md:col-span-3" />
      <Skeleton className="col-span-2 h-[256px] md:col-span-1" />
    </div>
  );
}

function Dashboard({ data, loading, editMode, onEditMode, can, onLayout, allowed, initial, initialCustom }: Props & {
  allowed:       (pw: PlacedWidget) => boolean;
  initial:       PlacedWidget[];
  initialCustom: boolean;
}) {
  const [widgets, setWidgets] = useState<PlacedWidget[]>(initial);
  const [isCustom, setIsCustom] = useState(initialCustom);

  const [showCatalog, setShowCatalog] = useState(false);
  const [settingsFor, setSettingsFor] = useState<PlacedWidget | null>(null);

  // ширина контейнера → ширина колонки
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const col = width ? (width - (COLS - 1) * GAP) / COLS : 0;
  const stacked = width > 0 && width < GRID_FROM;
  const flowCols = width >= PAIR_SMALL_FROM ? 2 : 1;
  // начиная с какой ширины виджет занимает всю строку в режиме колонок
  const fullFromW = width >= TWO_COLS_FROM ? COLS / 2 : 4;

  useEffect(() => { onLayout?.(widgets); }, [widgets, onLayout]);

  function commit(next: PlacedWidget[]) {
    setWidgets(next);
    saveHomeLayout(next);
    setIsCustom(true);
  }

  function resetLayout() {
    saveHomeLayout(null);
    setIsCustom(false);
    setWidgets(defaultLayout(allowed));
  }

  function addWidget(type: WidgetTypeId, config?: Record<string, string>) {
    const def = widgetDef(type)!;
    const { x, y } = findFreeSlot(widgets, def.defaultW, def.defaultH);
    commit([...widgets, { id: newId(), type, x, y, w: def.defaultW, h: def.defaultH, config }]);
    setShowCatalog(false);
  }

  // ─── Перетаскивание ─────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ x: number; y: number } | null>(null);
  const raf = useRef(0);

  const snap = useCallback((id: string, dx: number, dy: number) => {
    const pw = widgets.find(w => w.id === id);
    if (!pw || !col) return null;
    return {
      x: Math.min(Math.max(pw.x + Math.round(dx / (col + GAP)), 0), COLS - pw.w),
      y: Math.max(pw.y + Math.round(dy / (ROW_H + GAP)), 0),
    };
  }, [widgets, col]);

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    const pw = widgets.find(w => w.id === active.id);
    if (pw) setDrop({ x: pw.x, y: pw.y });
  }
  function onDragMove({ active, delta }: DragMoveEvent) {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const s = snap(String(active.id), delta.x, delta.y);
      if (s) setDrop(prev => (prev && prev.x === s.x && prev.y === s.y ? prev : s));
    });
  }
  function onDragEnd({ active, delta }: DragEndEvent) {
    cancelAnimationFrame(raf.current);
    const id = String(active.id);
    const s = snap(id, delta.x, delta.y);
    const pw = widgets.find(w => w.id === id);
    if (s && pw && (s.x !== pw.x || s.y !== pw.y)) commit(moveWidget(widgets, id, s.x, s.y));
    setActiveId(null); setDrop(null);
  }

  // ─── Изменение размера ─────────────────────────────────
  const [resize, setResize] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);

  function onResizeStart(e: React.PointerEvent, pw: PlacedWidget) {
    e.preventDefault(); e.stopPropagation();
    const def = widgetDef(pw.type)!;
    const sx = e.clientX, sy = e.clientY;
    let last = { w: pw.w, h: pw.h };
    setResize({ id: pw.id, x: pw.x, y: pw.y, w: pw.w, h: pw.h });

    const size = (ev: PointerEvent) => ({
      w: Math.min(Math.max(pw.w + Math.round((ev.clientX - sx) / (col + GAP)), def.minW), Math.min(def.maxW, COLS - pw.x)),
      h: Math.min(Math.max(pw.h + Math.round((ev.clientY - sy) / (ROW_H + GAP)), def.minH), def.maxH),
    });
    const move = (ev: PointerEvent) => {
      const next = size(ev);
      if (next.w !== last.w || next.h !== last.h) {
        last = next;
        setResize(r => (r ? { ...r, ...next } : r));
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const next = size(ev);
      setResize(null);
      if (next.w !== pw.w || next.h !== pw.h) commit(compactGrid(placeWidget(widgets, pw.id, next)));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ─── Отрисовка ─────────────────────────────────────────
  const active = activeId ? widgets.find(w => w.id === activeId) ?? null : null;
  const rows = Math.max(0, ...widgets.map(w => w.y + w.h));
  const canvasRows = rows + (editMode ? 3 : 0);
  const ordered = useMemo(() => [...widgets].sort((a, b) => a.y - b.y || a.x - b.x), [widgets]);
  const permittedTypes = WIDGET_TYPES.filter(d => can(d.permission)).length;

  return (
    <div className="space-y-3">
      {editMode && (
        <div className="card-surface flex flex-wrap items-center gap-2 px-4 py-2.5">
          <LayoutGrid className="h-4 w-4 shrink-0 text-brand" />
          <p className="mr-auto text-[12px] text-text-2">
            {stacked
              ? "Перемещать и менять размер виджетов можно на широком экране. Здесь — добавить или убрать."
              : "Тяните виджет за заголовок, размер — за правый нижний угол. Изменения сохраняются сразу."}
          </p>
          {isCustom && (
            <button type="button" onClick={resetLayout}
              className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-border bg-card px-3 text-[12px] font-semibold text-text-2 transition-colors hover:bg-accent hover:text-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Как было по умолчанию
            </button>
          )}
          {permittedTypes > 0 && (
            <button type="button" onClick={() => setShowCatalog(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-brand bg-card px-3 text-[12px] font-semibold text-brand transition-colors hover:bg-brand-soft">
              <Plus className="h-3.5 w-3.5" /> Добавить виджет
            </button>
          )}
          <button type="button" onClick={() => onEditMode(false)}
            className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-brand px-3.5 text-[12px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong">
            <Check className="h-3.5 w-3.5" /> Готово
          </button>
        </div>
      )}

      <div ref={containerRef} className="w-full">
        {widgets.length === 0 ? (
          <div className="card-surface flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <LayoutGrid className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[14px] font-bold">Главная пока пустая</p>
              <p className="mt-1 text-[12px] text-text-3">Соберите её из виджетов: звонки, записи, выручка</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => { onEditMode(true); setShowCatalog(true); }}
                className="inline-flex h-9 items-center gap-1.5 rounded-[7px] bg-brand px-4 text-[13px] font-semibold text-brand-foreground hover:bg-brand-strong">
                <Plus className="h-4 w-4" /> Добавить виджет
              </button>
              <button type="button" onClick={resetLayout}
                className="inline-flex h-9 items-center gap-1.5 rounded-[7px] border border-border bg-card px-4 text-[13px] font-semibold text-text-2 hover:bg-accent">
                <RotateCcw className="h-4 w-4" /> Набор по умолчанию
              </button>
            </div>
          </div>
        ) : stacked ? (
          <div
            className="grid gap-3 [grid-auto-flow:row_dense]"
            style={{ gridTemplateColumns: `repeat(${flowCols}, minmax(0, 1fr))` }}
          >
            {ordered.map(pw => {
              const def = widgetDef(pw.type)!;
              // широкие виджеты занимают всю строку
              const wide = flowCols === 1 || pw.w >= fullFromW;
              const itemW = wide ? width : (width - 12) / 2;
              // узкому виджету (уже 640 px) может понадобиться больше строк — плитки идут в два ряда
              const h = Math.max(pw.h, def.minH, itemW < 640 ? def.narrowH ?? 0 : 0);
              return (
                <div
                  key={pw.id}
                  className="relative min-w-0"
                  style={{ height: px.height(h), gridColumn: wide ? "1 / -1" : undefined }}
                >
                  <WidgetContent pw={pw} data={data} loading={loading} />
                  {editMode && (
                    <button type="button" onClick={() => commit(compactGrid(widgets.filter(w => w.id !== pw.id)))}
                      aria-label={`Убрать: ${widgetCaption(pw, def.name)}`}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-[7px] border border-border bg-card text-text-3 shadow-card hover:text-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : col > 0 && (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}>
            <div className="relative" style={{ height: px.top(canvasRows) - (canvasRows ? GAP : 0) }}>
              {editMode && <GridGuides rows={canvasRows} col={col} />}
              {editMode && active && drop && <Ghost {...drop} w={active.w} h={active.h} col={col} />}
              {editMode && resize && <Ghost {...resize} col={col} label={`${resize.w}×${resize.h}`} />}

              {widgets.map(pw => (
                <GridItem
                  key={pw.id} pw={pw} col={col} editMode={editMode}
                  hidden={pw.id === activeId}
                  data={data} loading={loading}
                  onDelete={id => commit(compactGrid(widgets.filter(w => w.id !== id)))}
                  onSettings={setSettingsFor}
                  onResizeStart={onResizeStart}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 140, easing: "ease" }}>
              {active && (
                <div className="rounded-lg shadow-pop" style={{ width: px.width(active.w, col), height: px.height(active.h) }}>
                  <WidgetContent pw={active} data={data} loading={loading} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {showCatalog && (
        <WidgetCatalog can={can} onAdd={addWidget} onClose={() => setShowCatalog(false)} />
      )}
      {settingsFor && (
        <WidgetSettingsDialog
          type={settingsFor.type}
          name={widgetDef(settingsFor.type)!.name}
          value={settingsFor.config?.metric ?? WIDGET_OPTIONS[settingsFor.type]!.options[0].value}
          onClose={() => setSettingsFor(null)}
          onSave={v => {
            commit(widgets.map(w => (w.id === settingsFor.id ? { ...w, config: { ...w.config, metric: v } } : w)));
            setSettingsFor(null);
          }}
        />
      )}
    </div>
  );
}
