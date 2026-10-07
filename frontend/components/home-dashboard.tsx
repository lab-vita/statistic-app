"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext, DragOverlay, pointerWithin,
  PointerSensor, useSensor, useSensors,
  DragStartEvent, DragMoveEvent, DragEndEvent, useDraggable,
} from "@dnd-kit/core";
import {
  loadGrid, saveGrid, findFreeSlot, resizeWidget,
  WIDGET_TYPES, COLS, GAP, PlacedWidget, newId,
} from "@/lib/grid";
import { WidgetCatalog } from "@/components/widget-catalog";
import { CallsSingleWidget    } from "@/components/widgets/calls-single";
import { CallsTrioWidget      } from "@/components/widgets/calls-trio";
import { CallsChartWidget     } from "@/components/widgets/calls-chart";
import { CallsFunnelWidget    } from "@/components/widgets/calls-funnel";
import { CallsOperatorsWidget } from "@/components/widgets/calls-operators";
import { CallsPlanWidget      } from "@/components/widgets/calls-plan";
import {
  fetchStats, fetchDaily, fetchConversion, fetchPlanRange, toDateStr, addDays,
} from "@/lib/api";
import { loadHomeData, emptyHomeData, type HomeData } from "@/lib/home-data";
import type { ChartMetric } from "@/components/widgets/calls-chart";
import type { PlanMetric } from "@/lib/plan-forecast";
import { Plus, Settings2, ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { Section } from "@/components/sidebar";
import { CallsSingleMetric } from "@/components/widgets/calls-single";

// ─ Period ───────────────────────────────────────────────────────
type PeriodType = "day" | "week" | "month";
const MONTH_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function getPeriod(type: PeriodType, offset: number) {
  const now = new Date();
  if (type === "day") {
    const d = addDays(now, offset);
    return { from: toDateStr(d), to: toDateStr(d),
      label: d.toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"}) };
  }
  if (type === "week") {
    const dow = now.getDay()===0 ? 6 : now.getDay()-1;
    const mon = addDays(now,-dow+offset*7), sun = addDays(mon,6);
    return { from: toDateStr(mon), to: toDateStr(sun),
      label: `${mon.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — ${sun.toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})}` };
  }
  const d = new Date(now.getFullYear(), now.getMonth()+offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0);
  return { from: toDateStr(d), to: toDateStr(last),
    label: `${MONTH_RU[d.getMonth()]} ${d.getFullYear()}` };
}

// ─ Widget content ────────────────────────────────────────────────
function WidgetContent({ pw, data, loading }: {
  pw: PlacedWidget; data: HomeData; loading: boolean;
}) {
  const total = data.stats?.operators["total"] ?? null;
  switch (pw.type) {
    case "calls_single":
      return <CallsSingleWidget
        stats={total} loading={loading}
        metric={(pw.config?.metric as CallsSingleMetric) ?? "incoming"}
        conversion={data.conversion}
      />;
    case "calls_trio":
      return <CallsTrioWidget stats={total} loading={loading} />;
    case "calls_chart":
      return <CallsChartWidget
        daily={data.daily?.days ?? []} prevDaily={data.prevDaily?.days ?? null} loading={loading}
        metric={(pw.config?.metric as ChartMetric) ?? "incoming"}
      />;
    case "calls_funnel":
      return <CallsFunnelWidget stats={total} loading={loading} />;
    case "calls_plan":
      return <CallsPlanWidget
        days={data.daily?.days ?? []} plan={data.plan} dateFrom={data.dateFrom} dateTo={data.dateTo} loading={loading}
        metric={(pw.config?.metric as PlanMetric) ?? "calls_incoming"}
      />;
    case "calls_operators":
      return <CallsOperatorsWidget operators={data.stats?.operators ?? null} conversion={data.conversionData} loading={loading} />;
    default:
      return null;
  }
}

// ─ Grid helpers ──────────────────────────────────────────────────
function colPxOf(el: HTMLElement|null) {
  if (!el) return 0;
  return (el.clientWidth - (COLS-1)*GAP) / COLS;
}
function pxW(colPx: number, w: number) { return w*colPx + (w-1)*GAP; }
function pxH(rowH: number, h: number)  { return h*rowH  + (h-1)*GAP; }

// ─ Grid background — пунктирные линии ───────────────────────────
function GridBackground({ rows, rowH }: { rows: number; rowH: number }) {
  if (!rowH) return null;
  const totalRows = Math.max(rows + 3, 5);
  const colExpr = `calc((100% - ${(COLS - 1) * GAP}px) / ${COLS})`;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ height: totalRows * (rowH + GAP) }}
    >
      {Array.from({ length: totalRows }).map((_, row) =>
        Array.from({ length: COLS }).map((_, col) => (
          <div
            key={`${row}-${col}`}
            className="absolute rounded-2xl"
            style={{
              left:   `calc(${col} * (${colExpr} + ${GAP}px))`,
              top:    row * (rowH + GAP),
              width:  colExpr,
              height: rowH,
              border: "1.5px dashed color-mix(in srgb, var(--foreground) 13%, transparent)",
            }}
          />
        ))
      )}
    </div>
  );
}

// ─ Drop highlight ────────────────────────────────────────────────
function DropHighlight({ colPx, rowH, x, y, w, h, ok }: {
  colPx:number; rowH:number; x:number; y:number; w:number; h:number; ok:boolean;
}) {
  if (!colPx||!rowH) return null;
  const color = ok ? "#22c55e" : "#ef4444";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-2xl z-10 transition-[left,top] duration-75"
      style={{
        left:   x*(colPx+GAP),
        top:    y*(rowH+GAP),
        width:  pxW(colPx,w),
        height: pxH(rowH,h),
        background: `${color}18`,
        border: `2px dashed ${color}`,
      }}
    />
  );
}

// ─ Resize ghost ──────────────────────────────────────────────────
function ResizeGhost({ colPx, rowH, x, y, w, h }: {
  colPx:number; rowH:number; x:number; y:number; w:number; h:number;
}) {
  if (!colPx||!rowH) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-2xl z-20 ring-2 ring-primary/40"
      style={{
        left:       x*(colPx+GAP),
        top:        y*(rowH+GAP),
        width:      pxW(colPx,w),
        height:     pxH(rowH,h),
        background: "color-mix(in srgb, var(--primary) 6%, transparent)",
      }}
    >
      <span className="absolute bottom-2 right-3 text-[11px] font-semibold text-primary/60 tabular-nums">
        {w}×{h}
      </span>
    </div>
  );
}

// ─ Draggable widget ──────────────────────────────────────────────
function DraggableWidget({ pw, editMode, onDelete, onResizeStart,
  isDragging, data, loading, colPx, rowH }: {
  pw: PlacedWidget; editMode: boolean;
  onDelete: (id:string)=>void;
  onResizeStart: (e:React.MouseEvent, pw:PlacedWidget)=>void;
  isDragging: boolean;
  data: HomeData;
  loading: boolean; colPx: number; rowH: number;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: pw.id, disabled: !editMode,
  });

  return (
    <div
      ref={setNodeRef}
      className="absolute group"
      style={{
        left:    pw.x*(colPx+GAP),
        top:     pw.y*(rowH+GAP),
        width:   pxW(colPx,pw.w),
        height:  pxH(rowH,pw.h),
        opacity: isDragging ? 0 : 1,
        zIndex:  isDragging ? 0 : 1,
        willChange: "transform",
      }}
    >
      <WidgetContent pw={pw} data={data} loading={loading} />

      {editMode && (
        <div className="
          absolute inset-0 rounded-2xl z-10
          ring-2 ring-primary/20
          flex items-center justify-center
          bg-background/40 dark:bg-black/40 backdrop-blur-[2px]
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
        ">
          <div
            {...listeners} {...attributes}
            title="Переместить"
            className="h-10 w-10 rounded-xl bg-background border border-border shadow-sm
              flex items-center justify-center cursor-grab active:cursor-grabbing
              hover:bg-muted transition-colors"
          >
            <GripVertical className="h-5 w-5 text-foreground/50" />
          </div>

          <button
            onClick={() => onDelete(pw.id)}
            title="Удалить"
            className="
              absolute top-2 right-2 h-6 w-6 rounded-lg
              bg-background/90 border border-border shadow-sm
              flex items-center justify-center
              text-muted-foreground
              hover:bg-destructive hover:border-destructive
              hover:text-destructive-foreground
              transition-colors
            "
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div
            onMouseDown={e => onResizeStart(e,pw)}
            title="Изменить размер"
            className="absolute bottom-1.5 right-1.5 cursor-se-resize p-1.5
              text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="2" y1="9" x2="9" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="6" y1="9" x2="9" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// ─ Main ──────────────────────────────────────────────────────────
export function HomeDashboard({ onNavigate }: { onNavigate:(s:Section)=>void }) {
  const [widgets,     setWidgets]     = useState<PlacedWidget[]>([]);
  const [editMode,    setEditMode]    = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [activeId,    setActiveId]    = useState<string|null>(null);
  const [rowH,        setRowH]        = useState(120);

  const dropRef    = useRef<{x:number;y:number;ok:boolean}|null>(null);
  const [dropSnap, setDropSnap] = useState<{x:number;y:number;ok:boolean}|null>(null);
  const rafDrop    = useRef<number>(0);

  const [resizePrev, setResizePrev] = useState<{id:string;x:number;y:number;w:number;h:number}|null>(null);
  const resizeRef  = useRef<{id:string;sx:number;sy:number;ow:number;oh:number}|null>(null);
  const rafResize  = useRef<number>(0);

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [offset,     setOffset]     = useState(0);
  const { from:df, to:dt, label }   = getPeriod(periodType, offset);

  const [data, setData] = useState<HomeData>(() => emptyHomeData());
  const [loading,   setLoading]   = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Загрузка сетки
  useEffect(() => { setWidgets(loadGrid()); }, []);

  // ResizeObserver — квадратные ячейки
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      const colPx = (w - (COLS-1)*GAP) / COLS;
      setRowH(Math.round(colPx));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await loadHomeData(df, dt, { fetchStats, fetchDaily, fetchConversion, fetchPlanRange }));
    setLoading(false);
  }, [df,dt]);

  useEffect(() => { load(); }, [load]);

  function save(next: PlacedWidget[]) { setWidgets(next); saveGrid(next); }

  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint:{distance:6}}));

  function cpx() { return colPxOf(containerRef.current); }

  function snapDrop(id:string, dx:number, dy:number) {
    const cp=cpx(), pw=widgets.find(w=>w.id===id);
    if (!cp||!pw||!rowH) return null;
    const nx=Math.min(Math.max(pw.x+Math.round(dx/(cp+GAP)),0),COLS-pw.w);
    const ny=Math.max(pw.y+Math.round(dy/(rowH+GAP)),0);
    const ghost={...pw,x:nx,y:ny};
    const ok=!widgets.some(w=>w.id!==id&&
      ghost.x<w.x+w.w&&ghost.x+ghost.w>w.x&&
      ghost.y<w.y+w.h&&ghost.y+ghost.h>w.y);
    return {x:nx,y:ny,ok};
  }

  function handleDragStart({active}:DragStartEvent) {
    setActiveId(String(active.id));
    setDropSnap(null);
  }

  function handleDragMove({active,delta}:DragMoveEvent) {
    cancelAnimationFrame(rafDrop.current);
    const id=String(active.id), dx=delta.x, dy=delta.y;
    rafDrop.current = requestAnimationFrame(() => {
      const snap=snapDrop(id,dx,dy);
      if (!snap) return;
      const prev=dropRef.current;
      if (!prev||prev.x!==snap.x||prev.y!==snap.y||prev.ok!==snap.ok) {
        dropRef.current=snap;
        setDropSnap({...snap});
      }
    });
  }

  function handleDragEnd({active,delta}:DragEndEvent) {
  cancelAnimationFrame(rafDrop.current);
  const id=String(active.id), cp=cpx();

  if (cp&&rowH&&(delta.x||delta.y)) {
    const pw=widgets.find(w=>w.id===id);
    if (pw) {
      const nx=Math.min(Math.max(pw.x+Math.round(delta.x/(cp+GAP)),0),COLS-pw.w);
      const ny=Math.max(pw.y+Math.round(delta.y/(rowH+GAP)),0);

      if (nx!==pw.x||ny!==pw.y) {
        // Проверяем коллизии с другими виджетами
        const ghost={...pw,x:nx,y:ny};
        const hasCollision=widgets.some(w=>w.id!==id&&
          ghost.x<w.x+w.w&&ghost.x+ghost.w>w.x&&
          ghost.y<w.y+w.h&&ghost.y+ghost.h>w.y);

        if (!hasCollision) {
          save(widgets.map(w=>w.id===id?{...w,x:nx,y:ny}:w));
        }
        // Если коллизия — виджет просто возвращается на место (dnd-kit делает это автоматически)
      }
    }
  }

  setActiveId(null); setDropSnap(null); dropRef.current=null;
}

  function startResize(e:React.MouseEvent, pw:PlacedWidget) {
    e.preventDefault(); e.stopPropagation();
    const def=WIDGET_TYPES.find(t=>t.id===pw.type)!;
    resizeRef.current={id:pw.id,sx:e.clientX,sy:e.clientY,ow:pw.w,oh:pw.h};
    setResizePrev({id:pw.id,x:pw.x,y:pw.y,w:pw.w,h:pw.h});

    function onMove(me:MouseEvent) {
      cancelAnimationFrame(rafResize.current);
      const mx=me.clientX, my=me.clientY;
      rafResize.current=requestAnimationFrame(() => {
        const r=resizeRef.current; if (!r||!rowH) return;
        const cp=cpx(); if (!cp) return;
        const nw=Math.min(Math.max(r.ow+Math.round((mx-r.sx)/(cp+GAP)),def.minW),def.maxW);
        const nh=Math.min(Math.max(r.oh+Math.round((my-r.sy)/(rowH+GAP)),def.minH),def.maxH);
        setResizePrev(p=>p&&(p.w!==nw||p.h!==nh)?{...p,w:nw,h:nh}:p);
      });
    }
    function onUp(ue:MouseEvent) {
      cancelAnimationFrame(rafResize.current);
      const r=resizeRef.current; if (!r) return;
      const cp=cpx();
      if (cp&&rowH) {
        const dw=Math.round((ue.clientX-r.sx)/(cp+GAP));
        const dh=Math.round((ue.clientY-r.sy)/(rowH+GAP));
        if (dw||dh) {
          const t=widgets.find(w=>w.id===r.id)!;
          save(resizeWidget(widgets,t.id,t.w+dw,t.h+dh,def));
        }
      }
      resizeRef.current=null; setResizePrev(null);
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
    }
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
  }

  function handleAdd(typeId: string, config?: Record<string, string>) {
  const def = WIDGET_TYPES.find(t => t.id === typeId)!;
  const { x, y } = findFreeSlot(widgets, def.defaultW, def.defaultH);
  save([...widgets, { id: newId(), type: typeId as any, x, y, w: def.defaultW, h: def.defaultH, config }]);
  setShowCatalog(false);
}

  const activeWidget = activeId ? widgets.find(w=>w.id===activeId)??null : null;
  const maxRow  = Math.max(0,...widgets.map(w=>w.y+w.h));
  const canvasH = Math.max((maxRow+(editMode?3:0))*(rowH+GAP), rowH*4);
  const colPx   = cpx();

  return (
    <div className="min-h-full">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Сводка</h1>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex gap-0.5 rounded-xl border border-border bg-muted/30 p-1">
              {(["day","week","month"] as PeriodType[]).map(t=>(
                <button key={t} onClick={()=>{setPeriodType(t);setOffset(0);}}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    periodType===t
                      ?"bg-card text-foreground shadow-sm ring-1 ring-border"
                      :"text-muted-foreground hover:text-foreground"
                  }`}>
                  {t==="day"?"День":t==="week"?"Неделя":"Месяц"}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={()=>setOffset(o=>o-1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-accent">
                <ChevronLeft className="h-4 w-4 text-muted-foreground"/>
              </button>
              <button onClick={()=>setOffset(o=>o+1)} disabled={offset>=0}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-accent disabled:opacity-30">
                <ChevronRight className="h-4 w-4 text-muted-foreground"/>
              </button>
            </div>
            <button onClick={()=>setShowCatalog(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/90">
              <Plus className="h-3.5 w-3.5"/> Добавить
            </button>
            <button onClick={()=>setEditMode(e=>!e)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
                editMode
                  ?"bg-accent border-border text-foreground"
                  :"border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}>
              <Settings2 className="h-3.5 w-3.5"/> {editMode?"Готово":"Настроить"}
            </button>
          </div>
        </div>

        {/* Edit hint */}
        {editMode && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
            <p className="text-xs text-muted-foreground">
              Тяните виджет для перемещения
              <span className="mx-1.5 text-border">·</span>
              Зелёная зона — свободно, красная — занято
              <span className="mx-1.5 text-border">·</span>
              Угол справа внизу — изменить размер
            </p>
          </div>
        )}

        {/* Canvas */}
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
            style={{minHeight: canvasH}}
          >
            {editMode && <GridBackground rows={maxRow} rowH={rowH}/>}

            {editMode&&activeId&&dropSnap&&activeWidget&&(
              <DropHighlight
                colPx={colPx} rowH={rowH}
                x={dropSnap.x} y={dropSnap.y}
                w={activeWidget.w} h={activeWidget.h}
                ok={dropSnap.ok}
              />
            )}

            {editMode&&resizePrev&&(
              <ResizeGhost
                colPx={colPx} rowH={rowH}
                x={resizePrev.x} y={resizePrev.y}
                w={resizePrev.w} h={resizePrev.h}
              />
            )}

            {widgets.length===0 ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30">
                  <Plus className="h-7 w-7 text-muted-foreground/40"/>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground/60">Виджеты не добавлены</p>
                  <p className="mt-1 text-xs text-muted-foreground">Нажмите «Добавить» чтобы настроить дашборд</p>
                </div>
                <button onClick={()=>setShowCatalog(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <Plus className="h-3.5 w-3.5"/> Добавить виджет
                </button>
              </div>
            ) : widgets.map(pw=>(
              <DraggableWidget
                key={pw.id} pw={pw}
                editMode={editMode}
                onDelete={id=>save(widgets.filter(w=>w.id!==id))}
                onResizeStart={startResize}
                isDragging={pw.id===activeId}
                data={data} loading={loading}
                colPx={colPx} rowH={rowH}
              />
            ))}

            <DragOverlay dropAnimation={{duration:120,easing:"ease"}}>
              {activeWidget&&(
                <div style={{
                  width:   pxW(colPx,activeWidget.w),
                  height:  pxH(rowH,activeWidget.h),
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
                }}>
                  <WidgetContent
                    pw={activeWidget}
                    data={data} loading={loading}
                  />
                </div>
              )}
            </DragOverlay>
          </div>
        </DndContext>
      </div>

      {showCatalog && (
        <WidgetCatalog onAdd={handleAdd} onClose={()=>setShowCatalog(false)}/>
      )}
    </div>
  );
}