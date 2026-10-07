// ─── Система сетки 12 колонок ────────────────────────────────
//
// Каждый виджет занимает w колонок × h строк.
// Строка = ROW_H пикселей (задаётся в CSS).
// Сетка хранится в localStorage как массив PlacedWidget.

export const COLS    = 12;
export const GAP     = 12;  // px между ячейками

// ─── Тип виджета ─────────────────────────────────────────────

export type WidgetTypeId =
  | "calls_single"      // 1: одна цифра
  | "calls_trio"        // 2: три показателя
  | "calls_chart"       // 3: цифра + график
  | "calls_funnel"      // 4: судьба звонков (раньше «полная сводка»)
  | "calls_plan"        // 5: план и прогноз
  | "calls_operators";  // 6: операторы: качество

// ─── Определение типа (метаданные для каталога) ──────────────

export interface WidgetTypeDef {
  id:          WidgetTypeId;
  group:       string;
  name:        string;
  description: string;
  defaultW:    number; // колонок
  defaultH:    number; // строк
  minW:        number;
  minH:        number;
  maxW:        number;
  maxH:        number;
}

export const WIDGET_TYPES: WidgetTypeDef[] = [
  {
    id:          "calls_single",
    group:       "Звонки",
    name:        "Одна метрика",
    description: "Крупная цифра на выбор: принятые, потеряно, время до перезвона, конверсия и другие. Минимум информации — максимум читаемости.",
    defaultW: 3, defaultH: 1, minW: 3, minH: 1, maxW: 6,  maxH: 2,
  },
  {
    id:          "calls_trio",
    group:       "Звонки",
    name:        "Три показателя",
    description: "Принято · Потеряно · До перезвона в одной строке с изменением к предыдущему периоду.",
    defaultW: 6, defaultH: 1, minW: 6, minH: 1, maxW: 12, maxH: 2,
  },
  {
    id:          "calls_chart",
    group:       "Звонки",
    name:        "Динамика",
    description: "Принято, поступило или потеряно по дням: линия этого периода и пунктир прошлого. Сразу виден тренд.",
    defaultW: 6, defaultH: 2, minW: 4, minH: 2, maxW: 12, maxH: 3,
  },
  {
    id:          "calls_funnel",
    group:       "Звонки",
    name:        "Судьба звонков",
    description: "Сколько поступило и пропущено и что стало с пропущенными. Главная цифра — сколько клиентов потеряно.",
    defaultW: 6, defaultH: 3, minW: 5, minH: 3, maxW: 12, maxH: 4,
  },
  {
    id:          "calls_plan",
    group:       "Звонки",
    name:        "План и прогноз",
    description: "Сколько плана по звонкам выполнено и чем закончится период при текущем темпе. План задаётся в разделе «Планы».",
    defaultW: 6, defaultH: 2, minW: 4, minH: 2, maxW: 12, maxH: 3,
  },
  {
    id:          "calls_operators",
    group:       "Звонки",
    name:        "Операторы: качество",
    description: "Принято, пропущено, потеряно, время до перезвона и конверсия по каждому оператору, с цветной оценкой.",
    defaultW: 8, defaultH: 3, minW: 6, minH: 2, maxW: 12, maxH: 4,
  },
];

// ─── Размещённый виджет ──────────────────────────────────────

export interface PlacedWidget {
  id:   string;
  type: WidgetTypeId;
  x:    number; // колонка (0-based)
  y:    number; // строка  (0-based)
  w:    number; // ширина в колонках
  h:    number; // высота в строках
  config?: Record<string, string>; // произвольные настройки виджета
}

// ─── localStorage ────────────────────────────────────────────

const LS_KEY = "grid_layout_v1";

/**
 * Приводит сохранённую раскладку к актуальным типам виджетов:
 *  • «Полная сводка» (calls_full) заменена на «Судьба звонков» (calls_funnel) — виджет переезжает
 *    на свободное место с размером по умолчанию;
 *  • неизвестные типы отбрасываются, чтобы на главной не оставалось пустых карточек.
 */
export function migrateGrid(saved: unknown): { widgets: PlacedWidget[]; changed: boolean } {
  const list = Array.isArray(saved) ? (saved as PlacedWidget[]) : [];
  const known = new Set<string>(WIDGET_TYPES.map(d => d.id));
  const kept   = list.filter(w => known.has(w.type));
  const legacy = list.filter(w => (w.type as string) === "calls_full");

  let widgets = kept;
  const funnel = WIDGET_TYPES.find(d => d.id === "calls_funnel")!;
  for (const old of legacy) {
    const slot = findFreeSlot(widgets, funnel.defaultW, funnel.defaultH);
    widgets = [...widgets, { id: old.id, type: "calls_funnel", ...slot, w: funnel.defaultW, h: funnel.defaultH }];
  }
  return { widgets, changed: widgets.length !== list.length || legacy.length > 0 };
}

export function loadGrid(): PlacedWidget[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const { widgets, changed } = migrateGrid(JSON.parse(raw));
    if (changed) localStorage.setItem(LS_KEY, JSON.stringify(widgets));
    return widgets;
  } catch { return []; }
}

export function saveGrid(widgets: PlacedWidget[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(widgets));
}

// ─── Утилиты ─────────────────────────────────────────────────

export function newId(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Находит первое свободное место на сетке для виджета w×h */
export function findFreeSlot(
  placed: PlacedWidget[],
  w: number,
  h: number,
): { x: number; y: number } {
  // Строим карту занятых ячеек
  const occupied = new Set<string>();
  for (const pw of placed) {
    for (let row = pw.y; row < pw.y + pw.h; row++) {
      for (let col = pw.x; col < pw.x + pw.w; col++) {
        occupied.add(`${row},${col}`);
      }
    }
  }

  // Ищем первое место построчно
  const maxRow = Math.max(0, ...placed.map(p => p.y + p.h)) + h;
  for (let row = 0; row <= maxRow; row++) {
    for (let col = 0; col <= COLS - w; col++) {
      let fits = true;
      outer:
      for (let dr = 0; dr < h; dr++) {
        for (let dc = 0; dc < w; dc++) {
          if (occupied.has(`${row + dr},${col + dc}`)) { fits = false; break outer; }
        }
      }
      if (fits) return { x: col, y: row };
    }
  }
  return { x: 0, y: maxRow };
}

/** Перемещает виджет, сдвигая конфликты вниз */
export function moveWidget(
  placed: PlacedWidget[],
  id: string,
  x: number,
  y: number,
): PlacedWidget[] {
  const target = placed.find(p => p.id === id);
  if (!target) return placed;
  const updated = placed.map(p => p.id === id ? { ...p, x, y } : p);
  return resolveCollisions(updated, id);
}

/** Изменяет размер виджета */
export function resizeWidget(
  placed: PlacedWidget[],
  id: string,
  w: number,
  h: number,
  def: WidgetTypeDef,
): PlacedWidget[] {
  const nw = Math.min(Math.max(w, def.minW), def.maxW);
  const nh = Math.min(Math.max(h, def.minH), def.maxH);
  const updated = placed.map(p => p.id === id ? { ...p, w: nw, h: nh } : p);
  return resolveCollisions(updated, id);
}

function resolveCollisions(
  placed: PlacedWidget[],
  movedId: string,
): PlacedWidget[] {
  const result = [...placed];
  const moved  = result.find(p => p.id === movedId)!;

  for (const pw of result) {
    if (pw.id === movedId) continue;
    if (overlaps(moved, pw)) {
      pw.y = moved.y + moved.h;
    }
  }
  return result;
}

function overlaps(a: PlacedWidget, b: PlacedWidget): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y
  );
}
