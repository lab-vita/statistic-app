"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { useDraggable } from "@dnd-kit/core";
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
  Plus, Settings2, ChevronLeft, ChevronRight,
  Trash2, GripVertical, Maximize2,
} from "lucide-react";
import { Section } from "@/components/sidebar";

// ─── Период ──────────────────────────────────────────────────

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
    const dow    = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = addDays(now, -dow + offset * 7);
    const sunday = addDays(monday, 6);
    return { from: toDateStr(monday), to: toDateStr(sunday),
      label: `${monday.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — ${sunday.toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})}` };
  }
  const d    = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toDateStr(d), to: toDateStr(last),
    label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
}

// ─── Контент виджета ─────────────────────────────────────────

function WidgetContent({
  pw, statsData, dailyData, loading,
}: {
  pw:        PlacedWidget;
  statsData: StatsResponse | null;
  dailyData: DailyResponse | null;
  loading:   boolean;
}) {
  const total = statsData?.operators["total"] ?? null;
  switch (pw.type) {
    case "calls_single":    return <CallsSingleWidget    stats={total} loading={loading} />;
    case "calls_trio":      return <CallsTrioWidget      stats={total} loading={loading} />;
    case "calls_chart":     return <CallsChartWidget     stats={total} daily={dailyData?.days ?? []} loading={loading} />;
    case "calls_full":      return <CallsFullWidget      stats={total} daily={dailyData?.days ?? []} loading={loading} />;
    case "calls_operators": return <CallsOperatorsWidget operators={statsData?.operators ?? null} loading={loading} />;
    default: return (
      <div className="h-full rounded-2xl bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
        неизвестный виджет
      </div>
    );
  }
}

// ─── Один перетаскиваемый виджет ─────────────────────────────

function DraggableWidget({
  pw, editMode, onDelete, onResizeStart,
  statsData, dailyData, loading, colPx, isDragging,
}: {
  pw:            PlacedWidget;
  editMode:      boolean;
  onDelete:      (id: string) => void;
  onResizeStart: (e: React.MouseEvent, pw: PlacedWidget) => void;
  statsData:     StatsResponse | null;
  dailyData:     DailyResponse | null;
  loading:       boolean;
  colPx:         string;
  isDragging:    boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id:       pw.id,
    disabled: !editMode,
  });

  const style: React.CSSProperties = {
    position: "absolute",
    left:     `calc(${pw.x} * (${colPx} + ${GAP}px))`,
    top:      pw.y * (ROW_H + GAP),
    width:    `calc(${pw.w} * (${colPx} + ${GAP}px) - ${GAP}px)`,
    height:   pw.h * (ROW_H + GAP) - GAP,
    opacity:  isDragging ? 0.35 : 1,
    transition: isDragging ? "none" : "top 0.15s, left 0.15s",
    zIndex:   isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <WidgetContent pw={pw} statsData={statsData} dailyData={dailyData} loading={loading} />

      {editMode && (
        <div className="
          absolute inset-0 rounded-2xl
          ring-2 ring-primary/40
          bg-background/40 backdrop-blur-[2px]
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
        ">
          {/* Drag handle — dnd-kit listeners */}
          <div
            {...listeners}
            {...attributes}
            className="
              h-10 w-10 rounded-xl
              bg-background/80 border border-border shadow-lg
              flex items-center justify-center
              cursor-grab active:cursor-grabbing
              hover:bg-muted transition-colors
            "
            title="Перетащить"
          >
            <GripVertical className="h-5 w-5 text-foreground/60" />
          </div>

          {/* Удалить */}
          <button
            onClick={() => onDelete(pw.id)}
            className="
              absolute top-2 right-2 h-7 w-7 rounded-xl
              bg-destructive flex items-center justify-center
              hover:bg-destructive/80 transition-colors shadow
            "
            title="Удалить"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive-foreground" />
          </button>

          {/* Resize */}
          <div
            onMouseDown={e => onResizeStart(e, pw)}
            className="
              absolute bottom-2 right-2 h-7 w-7 rounded-xl
              bg-background/80 border border-border shadow
              flex items-center justify-center
              cursor-se-resize hover:bg-muted transition-colors
            "
            title="Изменить размер"
          >
            <Maximize2 className="h-3.5 w-3.5 text-foreground/50" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Сетка ───────────────────────────────────────────────────

function GridBackground({ editMode, rows }: { editMode: boolean; rows: number }) {
  if (!editMode) return null;

  const totalRows = Math.max(rows + 2, 4);
  const colPx = `calc((100% - ${(COLS - 1) * GAP}px) / ${COLS})`;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ height: totalRows * (ROW_H + GAP) }}>
      {/* Колонки */}
      <div className="absolute inset-0 flex gap-[12px]">
        {Array.from({ length: COLS }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-xl"
            style={{
              background: "color-mix(in srgb, var(--primary) 4%, transparent)",
              outline: "1px dashed color-mix(in srgb, var(--primary) 18%, transparent)",
            }}
          />
        ))}
      </div>

      {/* Горизонтальные линии строк */}
      {Array.from({ length: totalRows }).map((_, row) => (
        <div
          key={row}
          className="absolute left-0 right-0 flex items-center"
          style={{ top: row * (ROW_H + GAP) + ROW_H - 1 }}
        >
          <div
            className="w-full"
            style={{
              height: 1,
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          />
        </div>
      ))}

      {/* Номера строк */}
      {Array.from({ length: totalRows }).map((_, row) => (
        <div
          key={`label-${row}`}
          className="absolute -left-5 text-[9px] font-mono"
          style={{
            top: row * (ROW_H + GAP) + ROW_H / 2 - 6,
            color: "color-mix(in srgb, var(--primary) 30%, transparent)",
          }}
        >
          {row + 1}
        </div>
      ))}
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
  const [activeId,    setActiveId]    = useState<string | null>(null);

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

  // ── dnd-kit ──────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function getColPx(): number {
    if (!containerRef.current) return 0;
    return (containerRef.current.clientWidth - (COLS - 1) * GAP) / COLS;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, delta } = event;
    if (!delta.x && !delta.y) return;

    const colPx = getColPx();
    if (!colPx) return;

    const id = String(active.id);
    const pw = widgets.find(w => w.id === id);
    if (!pw) return;

    const dx = Math.round(delta.x / (colPx + GAP));
    const dy = Math.round(delta.y / (ROW_H + GAP));
    if (!dx && !dy) return;

    const nx = Math.min(Math.max(pw.x + dx, 0), COLS - pw.w);
    const ny = Math.max(pw.y + dy, 0);

    save(widgets.map(w => w.id === id ? { ...w, x: nx, y: ny } : w));
  }

  // ── Resize (mouse-based, по шагам сетки) ────────────────
  const resizeRef = useRef<{
    id: string; startX: number; startY: number; origW: number; origH: number;
  } | null>(null);

  function startResize(e: React.MouseEvent, pw: PlacedWidget) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { id: pw.id, startX: e.clientX, startY: e.clientY, origW: pw.w, origH: pw.h };

    const onUp = (ue: MouseEvent) => {
      if (!resizeRef.current) return;
      const colPx = getColPx();
      if (colPx) {
        const dw = Math.round((ue.clientX - resizeRef.current.startX) / (colPx + GAP));
        const dh = Math.round((ue.clientY - resizeRef.current.startY) / (ROW_H + GAP));
        if (dw || dh) {
          const target = widgets.find(w => w.id === resizeRef.current!.id)!;
          const def    = WIDGET_TYPES.find(t => t.id === target.type)!;
          save(resizeWidget(widgets, target.id, target.w + dw, target.h + dh, def));
        }
      }
      resizeRef.current = null;
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mouseup", onUp);
  }

  // ── Helpers ──────────────────────────────────────────────
  function handleAdd(typeId: string) {
    const def = WIDGET_TYPES.find(t => t.id === typeId)!;
    const { x, y } = findFreeSlot(widgets, def.defaultW, def.defaultH);
    save([...widgets, { id: newId(), type: typeId as any, x, y, w: def.defaultW, h: def.defaultH }]);
    setShowCatalog(false);
  }

  const maxRow  = Math.max(0, ...widgets.map(w => w.y + w.h));
  const canvasH = Math.max((maxRow + (editMode ? 2 : 0)) * (ROW_H + GAP), 320);
  const colPx   = `calc((100% - ${(COLS - 1) * GAP}px) / ${COLS})`;
  const activeWidget = activeId ? widgets.find(w => w.id === activeId) : null;

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
            {/* Период */}
            <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
              {(["day","week","month"] as PeriodType[]).map(t => (
                <button key={t} onClick={() => { setPeriodType(t); setOffset(0); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    periodType === t
                      ? "bg-background border border-border shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {t === "day" ? "День" : t === "week" ? "Неделя" : "Месяц"}
                </button>
              ))}
            </div>

            {/* Навигация */}
            <div className="flex gap-1">
              <button onClick={() => setOffset(o => o - 1)}
                className="h-8 w-8 rounded-xl border border-border hover:bg-muted/40 flex items-center justify-center transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}
                className="h-8 w-8 rounded-xl border border-border hover:bg-muted/40 flex items-center justify-center transition-colors disabled:opacity-30">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Добавить */}
            <button onClick={() => setShowCatalog(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors">
              <Plus className="h-3.5 w-3.5" /> Добавить
            </button>

            {/* Настроить */}
            <button onClick={() => setEditMode(e => !e)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                editMode
                  ? "bg-muted border-border text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}>
              <Settings2 className="h-3.5 w-3.5" />
              {editMode ? "Готово" : "Настроить"}
            </button>
          </div>
        </div>

        {/* Подсказка */}
        {editMode && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-2.5">
            <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <GripVertical className="h-3 w-3 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              Наведите на виджет и тяните за <span className="text-foreground font-medium">⠿</span> для перемещения.
              Тяните за <span className="text-foreground font-medium">⤡</span> в углу для изменения размера.
            </p>
          </div>
        )}

        {/* Канвас */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={containerRef}
            className="relative w-full"
            style={{ minHeight: canvasH }}
          >
            {/* Красивая сетка */}
            <GridBackground editMode={editMode} rows={maxRow} />

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
            ) : (
              widgets.map(pw => (
                <DraggableWidget
                  key={pw.id}
                  pw={pw}
                  editMode={editMode}
                  onDelete={id => save(widgets.filter(w => w.id !== id))}
                  onResizeStart={startResize}
                  statsData={statsData}
                  dailyData={dailyData}
                  loading={loading}
                  colPx={colPx}
                  isDragging={pw.id === activeId}
                />
              ))
            )}

            {/* DragOverlay — полупрозрачный призрак */}
            <DragOverlay dropAnimation={null}>
              {activeWidget ? (
                <div
                  style={{
                    width:   `calc(${activeWidget.w} * (${colPx} + ${GAP}px) - ${GAP}px)`,
                    height:  activeWidget.h * (ROW_H + GAP) - GAP,
                    opacity: 0.85,
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                  }}
                >
                  <WidgetContent
                    pw={activeWidget}
                    statsData={statsData}
                    dailyData={dailyData}
                    loading={loading}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </div>
        </DndContext>
      </div>

      {showCatalog && (
        <WidgetCatalog
          onAdd={handleAdd}
          onClose={() => setShowCatalog(false)}
        />
      )}
    </div>
  );
}
