"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  useDraggable,
} from "@dnd-kit/core";
import {
  loadGrid, saveGrid, findFreeSlot, resizeWidget,
  WIDGET_TYPES, COLS, ROW_H, GAP,
  PlacedWidget, newId,
} from "@/lib/grid";
import { WidgetCatalog } from "@/components/widget-catalog";
import { CallsSingleWidget    } from "@/components/widgets/calls-single";
import { CallsTrioWidget      } from "@/components/widgets/calls-trio";
import { CallsChartWidget     } from "@/components/widgets/calls-chart";
import { CallsFullWidget      } from "@/components/widgets/calls-full";
import { CallsOperatorsWidget } from "@/components/widgets/calls-operators";
import {
  fetchStats, fetchDaily,
  toDateStr, addDays,
  StatsResponse, DailyResponse,
} from "@/lib/api";
import {
  Plus, Settings2, ChevronLeft, ChevronRight, Trash2, GripVertical,
} from "lucide-react";
import { Section } from "@/components/sidebar";

// ─── Период ─────────────────────────────────────────────

type PeriodType = "day" | "week" | "month";
const MONTH_NAMES = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];
function getPeriod(type: PeriodType, offset: number) {
  const now = new Date();
  if (type === "day") {
    const d = addDays(now, offset);
    return { from: toDateStr(d), to: toDateStr(d),
      label: d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) };
  }
  if (type === "week") {
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const mon = addDays(now, -dow + offset * 7);
    const sun = addDays(mon, 6);
    return { from: toDateStr(mon), to: toDateStr(sun),
      label: `${mon.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — ${sun.toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})}` };
  }
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toDateStr(d), to: toDateStr(last),
    label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
}

// ─── Контент виджета ─────────────────────────────────────────

function WidgetContent({ pw, statsData, dailyData, loading }: {
  pw: PlacedWidget; statsData: StatsResponse | null;
  dailyData: DailyResponse | null; loading: boolean;
}) {
  const total = statsData?.operators["total"] ?? null;
  switch (pw.type) {
    case "calls_single":    return <CallsSingleWidget    stats={total} loading={loading} />;
    case "calls_trio":      return <CallsTrioWidget      stats={total} loading={loading} />;
    case "calls_chart":     return <CallsChartWidget     stats={total} daily={dailyData?.days ?? []} loading={loading} />;
    case "calls_full":      return <CallsFullWidget      stats={total} daily={dailyData?.days ?? []} loading={loading} />;
    case "calls_operators": return <CallsOperatorsWidget operators={statsData?.operators ?? null} loading={loading} />;
    default: return <div className="h-full rounded-2xl bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">неизвестный виджет</div>;
  }
}

// ─── Вспомогатель: px-ширина колонки и размеры виджета ─────────────

function getColPx(el: HTMLElement | null): number {
  if (!el) return 0;
  return (el.clientWidth - (COLS - 1) * GAP) / COLS;
}
function widgetPxW(colPx: number, w: number) { return w * colPx + (w - 1) * GAP; }
function widgetPxH(h: number)                 { return h * ROW_H + (h - 1) * GAP; }

// ─── Красивая сетка (точки + строки) ──────────────────────────

function GridDots({ rows }: { rows: number }) {
  const totalRows = Math.max(rows + 3, 5);
  return (
    <svg
      className="absolute inset-0 w-full pointer-events-none"
      style={{ height: totalRows * (ROW_H + GAP) }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="grid-dots"
          x="0" y="0"
          width={`calc((100% + ${GAP}px) / ${COLS})`}
          height={ROW_H + GAP}
          patternUnits="userSpaceOnUse"
        >
          {/* Точка на пересечении */}
          <circle cx="0" cy="0" r="1.5" fill="currentColor" opacity="0.2" />
        </pattern>
        {/* Горизонтальные линии строк */}
        <pattern
          id="grid-rows"
          x="0" y="0"
          width="100%"
          height={ROW_H + GAP}
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0" y1={ROW_H + GAP} x2="100%" y2={ROW_H + GAP}
            stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"
            strokeDasharray="4 4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-rows)" className="text-foreground" />
      <rect width="100%" height="100%" fill="url(#grid-dots)" className="text-foreground" />
    </svg>
  );
}

// ─── Drop-зона (подсветка куда встанет виджет) ──────────────────

function DropZone({ colPx, x, y, w, h, canFit }: {
  colPx: number; x: number; y: number; w: number; h: number; canFit: boolean;
}) {
  if (!colPx) return null;
  return (
    <div
      className="absolute pointer-events-none rounded-2xl transition-all duration-100"
      style={{
        left:    x * (colPx + GAP),
        top:     y * (ROW_H + GAP),
        width:   widgetPxW(colPx, w),
        height:  widgetPxH(h),
        background: canFit
          ? "color-mix(in srgb, #22c55e 12%, transparent)"
          : "color-mix(in srgb, #ef4444 12%, transparent)",
        border: `2px dashed ${ canFit ? "#22c55e" : "#ef4444" }`,
        zIndex: 10,
      }}
    >
      <div
        className="absolute top-2 left-3 text-[10px] font-semibold"
        style={{ color: canFit ? "#22c55e" : "#ef4444" }}
      >
        {canFit ? `${w}×${h}` : "нельзя"}
      </div>
    </div>
  );
}

// ─── Resize preview ────────────────────────────────────────────────

function ResizePreview({ colPx, x, y, w, h }: {
  colPx: number; x: number; y: number; w: number; h: number;
}) {
  if (!colPx) return null;
  return (
    <div
      className="absolute pointer-events-none rounded-2xl z-20"
      style={{
        left:    x * (colPx + GAP),
        top:     y * (ROW_H + GAP),
        width:   widgetPxW(colPx, w),
        height:  widgetPxH(h),
        background: "color-mix(in srgb, var(--primary) 8%, transparent)",
        border: "2px solid hsl(var(--primary) / 0.5)",
      }}
    >
      {/* Размер в углу */}
      <div className="absolute bottom-2 right-3 text-[11px] font-bold text-primary/80">
        {w} кол × {h} стр
      </div>
      {/* Пиксельный размер */}
      <div className="absolute top-2 left-3 text-[10px] text-primary/50">
        {Math.round(widgetPxW(colPx, w))} × {widgetPxH(h)} px
      </div>
    </div>
  );
}

// ─── Один виджет ───────────────────────────────────────────────

function DraggableWidget({ pw, editMode, onDelete, onResizeStart, isDragging,
  statsData, dailyData, loading, colPx,
}: {
  pw: PlacedWidget; editMode: boolean;
  onDelete: (id: string) => void;
  onResizeStart: (e: React.MouseEvent, pw: PlacedWidget) => void;
  isDragging: boolean;
  statsData: StatsResponse | null; dailyData: DailyResponse | null; loading: boolean;
  colPx: number;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id:       pw.id,
    disabled: !editMode,
  });

  const pxW = widgetPxW(colPx, pw.w);
  const pxH = widgetPxH(pw.h);

  return (
    <div
      ref={setNodeRef}
      className="absolute group"
      style={{
        left:    pw.x * (colPx + GAP),
        top:     pw.y * (ROW_H + GAP),
        width:   pxW,
        height:  pxH,
        opacity: isDragging ? 0 : 1,   // полностью скрываем исходнику во время drag
        zIndex:  isDragging ? 0 : 1,
      }}
    >
      <WidgetContent pw={pw} statsData={statsData} dailyData={dailyData} loading={loading} />

      {editMode && (
        <div className="
          absolute inset-0 rounded-2xl z-10
          ring-2 ring-primary/30
          bg-background/50 backdrop-blur-[2px]
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
        ">
          {/* Drag — dnd-kit */}
          <div
            {...listeners} {...attributes}
            className="
              h-10 w-10 rounded-xl shadow-lg cursor-grab active:cursor-grabbing
              bg-background border border-border
              flex items-center justify-center
              hover:bg-muted transition-colors
            "
          >
            <GripVertical className="h-5 w-5 text-foreground/60" />
          </div>

          {/* Удалить */}
          <button
            onClick={() => onDelete(pw.id)}
            className="absolute top-2 right-2 h-7 w-7 rounded-xl bg-destructive shadow flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive-foreground" />
          </button>

          {/* Resize handle */}
          <div
            onMouseDown={e => onResizeStart(e, pw)}
            className="
              absolute bottom-0 right-0 w-8 h-8 cursor-se-resize
              flex items-end justify-end pb-2 pr-2
            "
          >
            {/* SVG-ручка ресайза */}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 10L10 2M6 10L10 6M10 10V10" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" className="text-foreground/40" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Главный компонент ───────────────────────────────────────

interface HomeDashboardProps {
  onNavigate: (s: Section) => void;
}

export function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const [widgets,     setWidgets]     = useState<PlacedWidget[]>([]);
  const [editMode,    setEditMode]    = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  // Drag state
  const [activeId,   setActiveId]   = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ x: number; y: number; canFit: boolean } | null>(null);

  // Resize state
  const [resizePreview, setResizePreview] = useState<{
    id: string; x: number; y: number; w: number; h: number;
  } | null>(null);

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [offset,     setOffset]     = useState(0);
  const { from: dateFrom, to: dateTo, label } = getPeriod(periodType, offset);

  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [dailyData, setDailyData] = useState<DailyResponse | null>(null);
  const [loading,   setLoading]   = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setWidgets(loadGrid()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, d] = await Promise.allSettled([
      fetchStats(dateFrom, dateTo),
      fetchDaily(dateFrom, dateTo),
    ]);
    setStatsData(s.status === "fulfilled" ? s.value : null);
    setDailyData(d.status === "fulfilled" ? d.value : null);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  function save(next: PlacedWidget[]) { setWidgets(next); saveGrid(next); }

  // ── dnd-kit ───────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function colPxNow() { return getColPx(containerRef.current); }

  // Вычисляем предполагаемую позицию drop по delta перемещения
  function calcDrop(id: string, deltaX: number, deltaY: number): { x: number; y: number; canFit: boolean } {
    const cp  = colPxNow();
    const pw  = widgets.find(w => w.id === id);
    if (!pw || !cp) return { x: 0, y: 0, canFit: false };

    const dx = Math.round(deltaX / (cp + GAP));
    const dy = Math.round(deltaY / (ROW_H + GAP));
    const nx = Math.min(Math.max(pw.x + dx, 0), COLS - pw.w);
    const ny = Math.max(pw.y + dy, 0);

    // Проверяем пересечения с другими виджетами
    const ghost = { ...pw, x: nx, y: ny };
    const canFit = !widgets.some(w => {
      if (w.id === id) return false;
      return (
        ghost.x < w.x + w.w && ghost.x + ghost.w > w.x &&
        ghost.y < w.y + w.h && ghost.y + ghost.h > w.y
      );
    });
    return { x: nx, y: ny, canFit };
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDropTarget(null);
  }

  function handleDragMove({ active, delta }: DragMoveEvent) {
    const drop = calcDrop(String(active.id), delta.x, delta.y);
    setDropTarget(drop);
  }

  function handleDragEnd({ active, delta }: DragEndEvent) {
    const id = String(active.id);
    const cp = colPxNow();
    if (cp && (delta.x || delta.y)) {
      const pw = widgets.find(w => w.id === id);
      if (pw) {
        const dx = Math.round(delta.x / (cp + GAP));
        const dy = Math.round(delta.y / (ROW_H + GAP));
        const nx = Math.min(Math.max(pw.x + dx, 0), COLS - pw.w);
        const ny = Math.max(pw.y + dy, 0);
        if (nx !== pw.x || ny !== pw.y) {
          save(widgets.map(w => w.id === id ? { ...w, x: nx, y: ny } : w));
        }
      }
    }
    setActiveId(null);
    setDropTarget(null);
  }

  // ── Resize (live preview) ─────────────────────────────────────

  const resizeRef = useRef<{
    id: string; startX: number; startY: number; origW: number; origH: number;
  } | null>(null);

  function startResize(e: React.MouseEvent, pw: PlacedWidget) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { id: pw.id, startX: e.clientX, startY: e.clientY, origW: pw.w, origH: pw.h };
    setResizePreview({ id: pw.id, x: pw.x, y: pw.y, w: pw.w, h: pw.h });

    const def = WIDGET_TYPES.find(t => t.id === pw.type)!;

    const onMove = (me: MouseEvent) => {
      if (!resizeRef.current) return;
      const cp = colPxNow();
      if (!cp) return;
      const dw = Math.round((me.clientX - resizeRef.current.startX) / (cp + GAP));
      const dh = Math.round((me.clientY - resizeRef.current.startY) / (ROW_H + GAP));
      const nw = Math.min(Math.max(resizeRef.current.origW + dw, def.minW), def.maxW);
      const nh = Math.min(Math.max(resizeRef.current.origH + dh, def.minH), def.maxH);
      setResizePreview({ id: pw.id, x: pw.x, y: pw.y, w: nw, h: nh });
    };

    const onUp = (ue: MouseEvent) => {
      if (!resizeRef.current) return;
      const cp = colPxNow();
      if (cp) {
        const dw = Math.round((ue.clientX - resizeRef.current.startX) / (cp + GAP));
        const dh = Math.round((ue.clientY - resizeRef.current.startY) / (ROW_H + GAP));
        if (dw || dh) {
          const target = widgets.find(w => w.id === resizeRef.current!.id)!;
          save(resizeWidget(widgets, target.id, target.w + dw, target.h + dh, def));
        }
      }
      resizeRef.current = null;
      setResizePreview(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }

  // ── Helpers ──────────────────────────────────────────────

  function handleAdd(typeId: string) {
    const def = WIDGET_TYPES.find(t => t.id === typeId)!;
    const { x, y } = findFreeSlot(widgets, def.defaultW, def.defaultH);
    save([...widgets, { id: newId(), type: typeId as any, x, y, w: def.defaultW, h: def.defaultH }]);
    setShowCatalog(false);
  }

  const activeWidget = activeId ? widgets.find(w => w.id === activeId) ?? null : null;
  const maxRow   = Math.max(0, ...widgets.map(w => w.y + w.h));
  const canvasH  = Math.max((maxRow + (editMode ? 3 : 0)) * (ROW_H + GAP), 320);
  const colPx    = colPxNow();  // 0 на SSR, пересчитается через CSS
  const colPxCSS = `calc((100% - ${(COLS - 1) * GAP}px) / ${COLS})`;

  return (
    <div className="min-h-full">
      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-5">

        {/* Шапка */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">Сводка</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
              {(["day","week","month"] as PeriodType[]).map(t => (
                <button key={t} onClick={() => { setPeriodType(t); setOffset(0); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    periodType === t ? "bg-background border border-border shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {t === "day" ? "День" : t === "week" ? "Неделя" : "Месяц"}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setOffset(o => o - 1)}
                className="h-8 w-8 rounded-xl border border-border hover:bg-muted/40 flex items-center justify-center">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}
                className="h-8 w-8 rounded-xl border border-border hover:bg-muted/40 flex items-center justify-center disabled:opacity-30">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <button onClick={() => setShowCatalog(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" /> Добавить
            </button>
            <button onClick={() => setEditMode(e => !e)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                editMode ? "bg-muted border-border" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}>
              <Settings2 className="h-3.5 w-3.5" />
              {editMode ? "Готово" : "Настроить"}
            </button>
          </div>
        </div>

        {/* Хинт режима */}
        {editMode && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-2.5">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Тяните виджет для перемещения · Зелёная зона — можно поставить, красная — нет · Угол право вниз — изменить размер
            </p>
          </div>
        )}

        {/* Канвас */}
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={containerRef}
            className="relative w-full select-none"
            style={{ minHeight: canvasH }}
          >
            {/* Точечная сетка */}
            {editMode && <GridDots rows={maxRow} />}

            {/* Drop-зона */}
            {editMode && activeId && dropTarget && activeWidget && (
              <DropZone
                colPx={colPxNow()}
                x={dropTarget.x} y={dropTarget.y}
                w={activeWidget.w} h={activeWidget.h}
                canFit={dropTarget.canFit}
              />
            )}

            {/* Resize preview */}
            {editMode && resizePreview && (
              <ResizePreview
                colPx={colPxNow()}
                x={resizePreview.x} y={resizePreview.y}
                w={resizePreview.w} h={resizePreview.h}
              />
            )}

            {/* Виджеты */}
            {widgets.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 min-h-[320px]">
                <div className="h-14 w-14 rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
                  <Plus className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground/50">Нет виджетов</p>
                  <p className="text-xs text-muted-foreground mt-1">Нажмите «Добавить» чтобы начать</p>
                </div>
              </div>
            ) : widgets.map(pw => (
              <DraggableWidget
                key={pw.id}
                pw={pw}
                editMode={editMode}
                onDelete={id => save(widgets.filter(w => w.id !== id))}
                onResizeStart={startResize}
                isDragging={pw.id === activeId}
                statsData={statsData} dailyData={dailyData} loading={loading}
                colPx={colPxNow()}
              />
            ))}

            {/* DragOverlay: реальный размер виджета, полная непрозрачность */}
            <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
              {activeWidget ? (
                <div
                  style={{
                    width:        widgetPxW(colPxNow(), activeWidget.w),
                    height:       widgetPxH(activeWidget.h),
                    borderRadius: 16,
                    overflow:     "hidden",
                    boxShadow:    "0 24px 64px rgba(0,0,0,0.25)",
                    opacity:      0.95,
                  }}
                >
                  <WidgetContent
                    pw={activeWidget}
                    statsData={statsData} dailyData={dailyData} loading={loading}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </div>
        </DndContext>
      </div>

      {showCatalog && (
        <WidgetCatalog onAdd={handleAdd} onClose={() => setShowCatalog(false)} />
      )}
    </div>
  );
}
