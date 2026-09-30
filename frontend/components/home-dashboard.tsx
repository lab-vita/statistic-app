"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadGrid, saveGrid, findFreeSlot, moveWidget, resizeWidget,
  WIDGET_TYPES, COLS, ROW_H, GAP,
  PlacedWidget, WidgetTypeDef, newId,
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

// ─── Рендер виджета по типу ──────────────────────────────────

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
    case "calls_single":
      return <CallsSingleWidget stats={total} loading={loading} />;
    case "calls_trio":
      return <CallsTrioWidget stats={total} loading={loading} />;
    case "calls_chart":
      return <CallsChartWidget stats={total} daily={dailyData?.days ?? []} loading={loading} />;
    case "calls_full":
      return <CallsFullWidget stats={total} daily={dailyData?.days ?? []} loading={loading} />;
    case "calls_operators":
      return <CallsOperatorsWidget operators={statsData?.operators ?? null} loading={loading} />;
    default:
      return <div className="h-full rounded-2xl bg-white/5 flex items-center justify-center text-xs text-white/30">неизвестный виджет</div>;
  }
}

// ─── Сетка ───────────────────────────────────────────────────

function GridCanvas({
  widgets, editMode, onDelete, onDrag, onResize,
  statsData, dailyData, loading,
}: {
  widgets:   PlacedWidget[];
  editMode:  boolean;
  onDelete:  (id: string) => void;
  onDrag:    (id: string, dx: number, dy: number) => void;
  onResize:  (id: string, dw: number, dh: number) => void;
  statsData: StatsResponse | null;
  dailyData: DailyResponse | null;
  loading:   boolean;
}) {
  // Вычисляем высоту канваса
  const maxRow = Math.max(0, ...widgets.map(w => w.y + w.h));
  const canvasH = Math.max(maxRow * (ROW_H + GAP) + GAP, 320);

  // Ширина одной колонки в %
  const colW = `calc((100% - ${(COLS - 1) * GAP}px) / ${COLS})`;

  // Ref на контейнер для вычисления px-ширины колонки
  const containerRef = useRef<HTMLDivElement>(null);

  function getColPx(): number {
    if (!containerRef.current) return 0;
    return (containerRef.current.clientWidth - (COLS - 1) * GAP) / COLS;
  }

  // ── Drag ────────────────────────────────────────────────────
  const dragState = useRef<{ id: string; startX: number; startY: number;
    origX: number; origY: number } | null>(null);

  function startDrag(e: React.MouseEvent, pw: PlacedWidget) {
    if (!editMode) return;
    e.preventDefault();
    dragState.current = { id: pw.id, startX: e.clientX, startY: e.clientY, origX: pw.x, origY: pw.y };

    const onMove = (me: MouseEvent) => {
      if (!dragState.current) return;
      const colPx = getColPx();
      if (!colPx) return;
      const dx = Math.round((me.clientX - dragState.current.startX) / (colPx + GAP));
      const dy = Math.round((me.clientY - dragState.current.startY) / (ROW_H + GAP));
      // Показываем призрак — здесь упрощённо через CSS transform
      // Реальное перемещение — onMouseUp
    };
    const onUp = (ue: MouseEvent) => {
      if (!dragState.current) return;
      const colPx = getColPx();
      if (colPx) {
        const dx = Math.round((ue.clientX - dragState.current.startX) / (colPx + GAP));
        const dy = Math.round((ue.clientY - dragState.current.startY) / (ROW_H + GAP));
        if (dx !== 0 || dy !== 0) onDrag(dragState.current.id, dx, dy);
      }
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── Resize ──────────────────────────────────────────────────
  const resizeState = useRef<{ id: string; startX: number; startY: number;
    origW: number; origH: number } | null>(null);

  function startResize(e: React.MouseEvent, pw: PlacedWidget) {
    e.preventDefault();
    e.stopPropagation();
    resizeState.current = { id: pw.id, startX: e.clientX, startY: e.clientY, origW: pw.w, origH: pw.h };

    const onMove = (me: MouseEvent) => {}; // placeholder
    const onUp = (ue: MouseEvent) => {
      if (!resizeState.current) return;
      const colPx = getColPx();
      if (colPx) {
        const dw = Math.round((ue.clientX - resizeState.current.startX) / (colPx + GAP));
        const dh = Math.round((ue.clientY - resizeState.current.startY) / (ROW_H + GAP));
        if (dw !== 0 || dh !== 0) onResize(resizeState.current.id, dw, dh);
      }
      resizeState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: canvasH }}
    >
      {widgets.map(pw => {
        const def = WIDGET_TYPES.find(t => t.id === pw.type);
        if (!def) return null;
        const colPx = `calc((100% - ${(COLS - 1) * GAP}px) / ${COLS})`;

        return (
          <div
            key={pw.id}
            className="absolute group"
            style={{
              left:   `calc(${pw.x} * (${colPx} + ${GAP}px))`,
              top:    pw.y * (ROW_H + GAP),
              width:  `calc(${pw.w} * (${colPx} + ${GAP}px) - ${GAP}px)`,
              height: pw.h * (ROW_H + GAP) - GAP,
            }}
          >
            {/* Контент */}
            <WidgetContent pw={pw} statsData={statsData} dailyData={dailyData} loading={loading} />

            {/* Оверлей редактирования */}
            {editMode && (
              <div className="absolute inset-0 rounded-2xl ring-2 ring-blue-500/40
                flex items-center justify-center opacity-0 group-hover:opacity-100
                transition-opacity duration-150 bg-black/30 backdrop-blur-[1px]">
                {/* Drag handle */}
                <div
                  onMouseDown={e => startDrag(e, pw)}
                  className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-sm
                    flex items-center justify-center cursor-grab active:cursor-grabbing
                    hover:bg-white/30 transition-colors"
                  title="Перетащить">
                  <GripVertical className="h-4 w-4 text-white" />
                </div>

                {/* Удалить */}
                <button
                  onClick={() => onDelete(pw.id)}
                  className="absolute top-2 right-2 h-7 w-7 rounded-xl
                    bg-red-500/80 flex items-center justify-center
                    hover:bg-red-500 transition-colors"
                  title="Удалить">
                  <Trash2 className="h-3.5 w-3.5 text-white" />
                </button>

                {/* Resize handle */}
                <div
                  onMouseDown={e => startResize(e, pw)}
                  className="absolute bottom-2 right-2 h-6 w-6 rounded-lg
                    bg-white/20 flex items-center justify-center
                    cursor-se-resize hover:bg-white/30 transition-colors"
                  title="Изменить размер">
                  <Maximize2 className="h-3 w-3 text-white" />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Пустая сетка (когда нет виджетов) */}
      {widgets.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="text-white/20 text-sm">Сетка пуста</div>
          <div className="text-white/10 text-xs">Добавьте виджеты через кнопку выше</div>
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
  const [widgets,    setWidgets]    = useState<PlacedWidget[]>([]);
  const [editMode,   setEditMode]   = useState(false);
  const [showCatalog,setShowCatalog]= useState(false);

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [offset,     setOffset]     = useState(0);
  const { from: dateFrom, to: dateTo, label } = getPeriod(periodType, offset);

  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [dailyData, setDailyData] = useState<DailyResponse | null>(null);
  const [loading,   setLoading]   = useState(true);

  // Загрузка сетки из localStorage
  useEffect(() => { setWidgets(loadGrid()); }, []);

  // Загрузка данных
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

  function handleAdd(typeId: string) {
    const def = WIDGET_TYPES.find(t => t.id === typeId)!;
    const { x, y } = findFreeSlot(widgets, def.defaultW, def.defaultH);
    save([...widgets, { id: newId(), type: typeId as any, x, y, w: def.defaultW, h: def.defaultH }]);
    setShowCatalog(false);
  }

  function handleDelete(id: string) {
    save(widgets.filter(w => w.id !== id));
  }

  function handleDrag(id: string, dx: number, dy: number) {
    const w = widgets.find(p => p.id === id)!;
    const nx = Math.min(Math.max(w.x + dx, 0), COLS - w.w);
    const ny = Math.max(w.y + dy, 0);
    save(moveWidget(widgets, id, nx, ny));
  }

  function handleResize(id: string, dw: number, dh: number) {
    const w   = widgets.find(p => p.id === id)!;
    const def = WIDGET_TYPES.find(t => t.id === w.type)!;
    save(resizeWidget(widgets, id, w.w + dw, w.h + dh, def));
  }

  return (
    <div className="min-h-screen bg-[#080d14]">
      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-5">

        {/* Шапка */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Сводка</h1>
            <p className="text-xs text-white/40 mt-0.5">{label}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Период */}
            <div className="flex gap-1 rounded-xl bg-white/5 p-1">
              {(["day","week","month"] as PeriodType[]).map(t => (
                <button key={t} onClick={() => { setPeriodType(t); setOffset(0); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    periodType === t
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/40 hover:text-white/70"
                  }`}>
                  {t === "day" ? "День" : t === "week" ? "Неделя" : "Месяц"}
                </button>
              ))}
            </div>

            {/* Навигация */}
            <div className="flex gap-1">
              <button onClick={() => setOffset(o => o - 1)}
                className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                <ChevronLeft className="h-4 w-4 text-white/50" />
              </button>
              <button onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}
                className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-25">
                <ChevronRight className="h-4 w-4 text-white/50" />
              </button>
            </div>

            {/* Добавить */}
            <button onClick={() => setShowCatalog(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400
                text-white text-xs font-semibold transition-colors shadow-lg shadow-blue-500/20">
              <Plus className="h-3.5 w-3.5" /> Добавить
            </button>

            {/* Настроить */}
            <button onClick={() => setEditMode(e => !e)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                transition-all border ${
                editMode
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-transparent border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
              }`}>
              <Settings2 className="h-3.5 w-3.5" />
              {editMode ? "Готово" : "Настроить"}
            </button>
          </div>
        </div>

        {/* Подсказка в режиме редактирования */}
        {editMode && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/40">
            Наведите на виджет чтобы переместить <span className="text-white/20 mx-1">·</span>
            Тяните за <span className="text-white/60">✥</span> чтобы переместить <span className="text-white/20 mx-1">·</span>
            Тяните за <span className="text-white/60">⤡</span> в углу чтобы изменить размер
          </div>
        )}

        {/* Сетка */}
        <GridCanvas
          widgets={widgets}
          editMode={editMode}
          onDelete={handleDelete}
          onDrag={handleDrag}
          onResize={handleResize}
          statsData={statsData}
          dailyData={dailyData}
          loading={loading}
        />
      </div>

      {/* Каталог виджетов */}
      {showCatalog && (
        <WidgetCatalog
          onAdd={handleAdd}
          onClose={() => setShowCatalog(false)}
        />
      )}
    </div>
  );
}
