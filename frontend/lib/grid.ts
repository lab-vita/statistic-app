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
  | "calls_full"        // 4: полная сводка
  | "calls_operators";  // 5: операторы

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
    description: "Крупная цифра: входящие, пропущенные или конверсия. Минимум информации — максимум читаемости.",
    defaultW: 3, defaultH: 1, minW: 3, minH: 1, maxW: 6,  maxH: 2,
  },
  {
    id:          "calls_trio",
    group:       "Звонки",
    name:        "Три показателя",
    description: "Входящие · Пропущенные · Конверсия в одной строке с дельтами к предыдущему периоду.",
    defaultW: 6, defaultH: 1, minW: 6, minH: 1, maxW: 12, maxH: 2,
  },
  {
    id:          "calls_chart",
    group:       "Звонки",
    name:        "Динамика",
    description: "Входящие звонки за период с мини-графиком по дням. Сразу виден тренд.",
    defaultW: 6, defaultH: 2, minW: 4, minH: 2, maxW: 12, maxH: 3,
  },
  {
    id:          "calls_full",
    group:       "Звонки",
    name:        "Полная сводка",
    description: "Все 4 метрики + график динамики. Для тех кто работает со звонками каждый день.",
    defaultW: 12, defaultH: 2, minW: 8, minH: 2, maxW: 12, maxH: 3,
  },
  {
    id:          "calls_operators",
    group:       "Звонки",
    name:        "Операторы",
    description: "Рейтинг операторов по количеству звонков с долей и баром.",
    defaultW: 6, defaultH: 3, minW: 4, minH: 2, maxW: 12, maxH: 4,
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
}

// ─── localStorage ────────────────────────────────────────────

const LS_KEY = "grid_layout_v1";

export function loadGrid(): PlacedWidget[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PlacedWidget[]) : [];
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
