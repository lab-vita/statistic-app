// ─── Сетка главной: 12 колонок, строки фиксированной высоты ──────
//
// Каждый виджет занимает w колонок × h строк. Ширина колонки считается
// по ширине контейнера, высота строки фиксирована (ROW_H), поэтому
// цифры и графики не растягиваются на широких экранах.
// Раскладка хранится в localStorage как массив PlacedWidget.

import type { DataKey } from "@/lib/home-data";

export const COLS  = 12;
export const GAP   = 14;  // px между ячейками
export const ROW_H = 76;  // px, высота одной строки

// ─── Тип виджета ─────────────────────────────────────────────

export type WidgetTypeId =
  | "calls_single"      // одна метрика звонков (с мини-графиком)
  | "calls_trio"        // три показателя в строку
  | "calls_chart"       // динамика по дням
  | "calls_funnel"      // судьба звонков
  | "calls_plan"        // план и прогноз
  | "calls_operators"   // операторы: качество
  | "calls_conversion"  // конверсия звонок → запись по операторам
  | "calls_heatmap"     // нагрузка по дням недели и часам
  | "appt_single"       // одна метрика записей
  | "appt_summary"      // записи за период
  | "appt_chart"        // записи по дням
  | "appt_sources"      // источники записей
  | "appt_admins"       // записи по сотрудникам
  | "patients_noshows"  // неявки по дням недели
  | "patients_returns"  // повторные визиты
  | "revenue_categories" // выручка по направлениям
  | "revenue_single"    // одна метрика выручки
  | "revenue_chart"     // выручка по дням
  | "revenue_methods"   // способы оплаты
  | "revenue_services"  // топ услуг
  | "doctors_top"       // топ врачей по выручке
  | "funnel_steps"      // звонки → записи → визиты → выручка
  | "funnel_trend"      // звонки, записи и конверсия по дням
  | "plans_progress"    // выполнение планов
  | "reports_months";   // помесячная сводка за полгода

export type WidgetGroup = "Звонки" | "Записи" | "Пациенты" | "Выручка" | "Врачи" | "Воронка" | "Планы" | "Отчёты";

/** Право, без которого виджет не показывается (как у разделов в сайдбаре). */
export type WidgetPermission =
  | "view:calls" | "view:appointments" | "view:revenue"
  | "view:funnel" | "view:plans" | "view:reports";

// ─── Определение типа (метаданные для каталога) ──────────────

export interface WidgetTypeDef {
  id:          WidgetTypeId;
  group:       WidgetGroup;
  name:        string;
  description: string;
  permission:  WidgetPermission;
  /** какие данные запрашивать, когда виджет стоит на экране */
  data:        DataKey[];
  /** у виджета есть настройка (выбор метрики) — каталог покажет шаг выбора */
  configurable?: boolean;
  defaultW: number; defaultH: number;
  minW: number; minH: number;
  maxW: number; maxH: number;
  /** высота в строках на узком экране (виджеты идут колонкой), если нужна больше обычной */
  narrowH?: number;
}

export const WIDGET_GROUPS: WidgetGroup[] = ["Звонки", "Записи", "Пациенты", "Выручка", "Врачи", "Воронка", "Планы", "Отчёты"];

export const WIDGET_TYPES: WidgetTypeDef[] = [
  // ── Звонки
  {
    id: "calls_single", group: "Звонки", permission: "view:calls", configurable: true,
    data: ["stats", "daily", "conversion"],
    name: "Одна метрика",
    description: "Крупная цифра на выбор: принятые, потеряно, время до перезвона, конверсия и другие — с изменением к прошлому периоду и мини-графиком.",
    defaultW: 3, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 3,
  },
  {
    id: "calls_trio", group: "Звонки", permission: "view:calls", data: ["stats"],
    name: "Три показателя",
    description: "Принято · Потеряно · До перезвона в одной строке с изменением к предыдущему периоду.",
    defaultW: 6, defaultH: 2, minW: 6, minH: 2, maxW: 12, maxH: 3,
  },
  {
    id: "calls_conversion", group: "Звонки", permission: "view:calls", data: ["stats", "conversion"],
    name: "Конверсия по операторам",
    description: "Сколько принятых звонков колл-центра закончились записью — в целом и по каждому оператору.",
    defaultW: 4, defaultH: 3, minW: 3, minH: 3, maxW: 8, maxH: 5,
  },
  {
    id: "calls_chart", group: "Звонки", permission: "view:calls", configurable: true, data: ["stats", "daily", "prevDaily"],
    name: "Динамика",
    description: "Принято, поступило или потеряно по дням: линия этого периода и пунктир прошлого. Сразу виден тренд.",
    defaultW: 8, defaultH: 3, minW: 4, minH: 3, maxW: 12, maxH: 5,
  },
  {
    id: "calls_heatmap", group: "Звонки", permission: "view:calls", configurable: true, data: ["heatmap"],
    name: "Нагрузка по часам",
    description: "Тепловая карта: в какие дни недели и часы больше всего звонков или пропущенных. Помогает планировать смены.",
    defaultW: 8, defaultH: 4, minW: 6, minH: 3, maxW: 12, maxH: 5,
  },
  {
    id: "calls_funnel", group: "Звонки", permission: "view:calls", data: ["stats"],
    name: "Судьба звонков",
    description: "Сколько поступило и пропущено и что стало с пропущенными. Главная цифра — сколько клиентов потеряно.",
    defaultW: 6, defaultH: 5, minW: 4, minH: 4, maxW: 12, maxH: 6,
  },
  {
    id: "calls_plan", group: "Звонки", permission: "view:calls", data: ["daily", "plan"],
    name: "План и прогноз",
    description: "Сколько плана по звонкам выполнено и чем закончится период при текущем темпе. План задаётся в разделе «Планы».",
    defaultW: 6, defaultH: 3, minW: 4, minH: 3, maxW: 12, maxH: 4,
  },
  {
    id: "calls_operators", group: "Звонки", permission: "view:calls", data: ["stats", "conversion"],
    name: "Операторы: качество",
    description: "Принято, пропущено, потеряно, время до перезвона и конверсия по каждому оператору, с цветной оценкой.",
    defaultW: 12, defaultH: 4, minW: 7, minH: 3, maxW: 12, maxH: 7,
  },
  // ── Записи
  {
    id: "appt_single", group: "Записи", permission: "view:appointments", configurable: true, data: ["appointments", "apptDaily"],
    name: "Одна метрика",
    description: "Всего записей, явки, неявки, новые пациенты или доля явок — крупной цифрой с изменением к прошлому периоду.",
    defaultW: 3, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 3,
  },
  {
    id: "appt_summary", group: "Записи", permission: "view:appointments", data: ["appointments"],
    name: "Записи за период",
    description: "Явки, неявки, новые пациенты и ожидающие подтверждения — четыре плитки с долями от всех записей.",
    defaultW: 6, defaultH: 3, minW: 4, minH: 3, maxW: 12, maxH: 4,
  },
  {
    id: "appt_chart", group: "Записи", permission: "view:appointments", data: ["apptDaily"],
    name: "Записи по дням",
    description: "Сколько записей было на каждый день и сколько из них пришли: столбики явок и неявок.",
    defaultW: 8, defaultH: 3, minW: 4, minH: 3, maxW: 12, maxH: 5,
  },
  {
    id: "appt_sources", group: "Записи", permission: "view:appointments", data: ["appointments"],
    name: "Источники записей",
    description: "Кто создал записи: колл-центр, администраторы или другие сотрудники.",
    defaultW: 6, defaultH: 2, minW: 4, minH: 2, maxW: 12, maxH: 4,
  },
  {
    id: "appt_admins", group: "Записи", permission: "view:appointments", data: ["appointments"],
    name: "Сотрудники",
    description: "Кто сколько записал, доля явок и неявок, новые пациенты — по каждому администратору и оператору.",
    defaultW: 6, defaultH: 4, minW: 4, minH: 3, maxW: 12, maxH: 7,
  },
  // ── Пациенты
  {
    id: "patients_noshows", group: "Пациенты", permission: "view:appointments", data: ["noshows"],
    name: "Неявки по дням недели",
    description: "Доля неявок за период и в какие дни недели пациенты не приходят чаще всего.",
    defaultW: 4, defaultH: 3, minW: 3, minH: 3, maxW: 8, maxH: 5,
  },
  {
    id: "patients_returns", group: "Пациенты", permission: "view:appointments", data: ["returns"],
    name: "Повторные визиты",
    description: "Сколько пациентов уже бывали в клинике, сколько вернулись за 30 дней и через сколько дней обычно приходят снова.",
    defaultW: 4, defaultH: 3, minW: 3, minH: 3, maxW: 8, maxH: 4,
  },
  // ── Выручка
  {
    id: "revenue_single", group: "Выручка", permission: "view:revenue", configurable: true, data: ["payments"],
    name: "Одна метрика",
    description: "Выручка, число платежей или средний чек за период — с изменением к прошлому периоду.",
    defaultW: 3, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 3,
  },
  {
    id: "revenue_chart", group: "Выручка", permission: "view:revenue", data: ["paymentDaily"],
    name: "Выручка по дням",
    description: "Сколько оплачено в каждый день периода, с отметкой лучшего дня и средним за день.",
    defaultW: 8, defaultH: 3, minW: 4, minH: 3, maxW: 12, maxH: 5,
  },
  {
    id: "revenue_methods", group: "Выручка", permission: "view:revenue", data: ["payments"],
    name: "Способы оплаты",
    description: "Доли наличных, карт, безналичных и кредита в выручке за период.",
    defaultW: 4, defaultH: 3, minW: 3, minH: 2, maxW: 12, maxH: 4,
  },
  {
    id: "revenue_services", group: "Выручка", permission: "view:revenue", data: ["sales"],
    name: "Топ услуг",
    description: "Услуги, которые принесли больше всего денег: сумма, доля в продажах и изменение к прошлому периоду.",
    defaultW: 6, defaultH: 4, minW: 4, minH: 3, maxW: 12, maxH: 7,
  },
  {
    id: "revenue_categories", group: "Выручка", permission: "view:revenue", data: ["categories"],
    name: "Направления",
    description: "Выручка по направлениям — УЗИ, анализы, приёмы врачей и другим: доля и изменение к прошлому периоду.",
    defaultW: 4, defaultH: 3, minW: 3, minH: 3, maxW: 12, maxH: 5,
  },
  // ── Врачи
  {
    id: "doctors_top", group: "Врачи", permission: "view:revenue", data: ["doctors"],
    name: "Топ врачей",
    description: "Врачи с наибольшей выручкой за период: сумма, число оплат и доля в общей выручке.",
    defaultW: 6, defaultH: 4, minW: 4, minH: 3, maxW: 12, maxH: 7,
  },
  // ── Воронка
  {
    id: "funnel_steps", group: "Воронка", permission: "view:funnel", data: ["conversion", "appointments", "payments"],
    name: "Воронка",
    description: "Колл-центр: звонки → записи → сколько пришли. Рядом — явки и выручка всей клиники, включая записи администраторов.",
    defaultW: 12, defaultH: 2, minW: 6, minH: 2, maxW: 12, maxH: 3, narrowH: 3,
  },
  {
    id: "funnel_trend", group: "Воронка", permission: "view:funnel", data: ["conversion"],
    name: "Конверсия по дням",
    description: "Принятые звонки и записи колл-центра по дням и линия конверсии — видно, в какие дни звонки хуже превращаются в записи.",
    defaultW: 8, defaultH: 3, minW: 5, minH: 3, maxW: 12, maxH: 5,
  },
  // ── Планы
  {
    id: "plans_progress", group: "Планы", permission: "view:plans", data: ["plan", "stats", "appointments", "payments", "conversion"],
    name: "Выполнение планов",
    description: "Звонки, записи и выручка против плана на выбранный период, конверсия и явки — против цели. План задаётся в разделе «Планы».",
    defaultW: 4, defaultH: 4, minW: 3, minH: 3, maxW: 12, maxH: 5,
  },
  // ── Отчёты
  {
    id: "reports_months", group: "Отчёты", permission: "view:reports", configurable: true, data: ["reports"],
    name: "Последние полгода",
    description: "Звонки или записи по месяцам за шесть месяцев — не зависит от выбранного периода, удобно сравнивать сезонность.",
    defaultW: 6, defaultH: 3, minW: 4, minH: 3, maxW: 12, maxH: 5,
  },
];

export const widgetDef = (type: WidgetTypeId) => WIDGET_TYPES.find(d => d.id === type);

// ─── Размещённый виджет ──────────────────────────────────────────

export interface PlacedWidget {
  id:   string;
  type: WidgetTypeId;
  x:    number; // колонка (0-based)
  y:    number; // строка  (0-based)
  w:    number; // ширина в колонках
  h:    number; // высота в строках
  config?: Record<string, string>; // произвольные настройки виджета
}

// ─── Раскладка по умолчанию — все виджеты, сверху сводка ─────
//
// Без прав на раздел виджеты отфильтровываются, а сетка подтягивается вверх
// (compactGrid), поэтому дыр не остаётся.

export const DEFAULT_LAYOUT: PlacedWidget[] = [
  // сводка: главные цифры и воронка
  { id: "d-incoming",     type: "calls_single",     x: 0, y: 0,  w: 3,  h: 2, config: { metric: "incoming" } },
  { id: "d-lost",         type: "calls_single",     x: 3, y: 0,  w: 3,  h: 2, config: { metric: "lost" } },
  { id: "d-visits",       type: "appt_single",      x: 6, y: 0,  w: 3,  h: 2, config: { metric: "visits" } },
  { id: "d-revenue",      type: "revenue_single",   x: 9, y: 0,  w: 3,  h: 2, config: { metric: "total_paid" } },
  { id: "d-funnel-steps", type: "funnel_steps",     x: 0, y: 2,  w: 12, h: 2 },
  { id: "d-chart",        type: "calls_chart",      x: 0, y: 4,  w: 8,  h: 3, config: { metric: "incoming" } },
  { id: "d-plans",        type: "plans_progress",   x: 8, y: 4,  w: 4,  h: 3 },
  // звонки
  { id: "d-trio",         type: "calls_trio",       x: 0, y: 7,  w: 6,  h: 2 },
  { id: "d-sources",      type: "appt_sources",     x: 6, y: 7,  w: 6,  h: 2 },
  { id: "d-funnel",       type: "calls_funnel",     x: 0, y: 9,  w: 6,  h: 6 },
  { id: "d-appts",        type: "appt_summary",     x: 6, y: 9,  w: 6,  h: 3 },
  { id: "d-plan",         type: "calls_plan",       x: 6, y: 12, w: 6,  h: 3 },
  { id: "d-heatmap",      type: "calls_heatmap",    x: 0, y: 15, w: 8,  h: 4, config: { metric: "total" } },
  { id: "d-conversion",   type: "calls_conversion", x: 8, y: 15, w: 4,  h: 4 },
  // воронка, записи, выручка по дням
  { id: "d-funnel-trend", type: "funnel_trend",     x: 0, y: 19, w: 8,  h: 3 },
  { id: "d-methods",      type: "revenue_methods",  x: 8, y: 19, w: 4,  h: 3 },
  { id: "d-revenue-day",  type: "revenue_chart",    x: 0, y: 22, w: 6,  h: 3 },
  { id: "d-appt-day",     type: "appt_chart",       x: 6, y: 22, w: 6,  h: 3 },
  // рейтинги
  { id: "d-doctors",      type: "doctors_top",      x: 0, y: 25, w: 4,  h: 4 },
  { id: "d-services",     type: "revenue_services", x: 4, y: 25, w: 4,  h: 4 },
  { id: "d-admins",       type: "appt_admins",      x: 8, y: 25, w: 4,  h: 4 },
  // полгода и операторы
  { id: "d-months-calls", type: "reports_months",   x: 0, y: 29, w: 6,  h: 3, config: { metric: "calls" } },
  { id: "d-months-appts", type: "reports_months",   x: 6, y: 29, w: 6,  h: 3, config: { metric: "appts" } },
  { id: "d-operators",    type: "calls_operators",  x: 0, y: 32, w: 12, h: 4 },
  // пациенты и направления
  { id: "d-noshows",      type: "patients_noshows",   x: 0, y: 36, w: 4,  h: 3 },
  { id: "d-returns",      type: "patients_returns",   x: 4, y: 36, w: 4,  h: 3 },
  { id: "d-categories",   type: "revenue_categories", x: 8, y: 36, w: 4,  h: 3 },
];

// ─── localStorage ──────────────────────────────────────────────

// v2: строки стали фиксированной высоты, размеры виджетов пересчитаны.
// Старые раскладки (grid_layout_v1, квадратные ячейки) не переносим —
// пользователь начинает с раскладки по умолчанию.
const LS_KEY = "grid_layout_v2";

/**
 * Приводит сохранённую раскладку к актуальным типам: неизвестные типы
 * отбрасываются, размеры зажимаются в допустимые пределы.
 */
export function sanitizeGrid(saved: unknown): PlacedWidget[] {
  if (!Array.isArray(saved)) return [];
  const out: PlacedWidget[] = [];
  for (const raw of saved as PlacedWidget[]) {
    const def = raw && widgetDef(raw.type);
    if (!def) continue;
    const w = clamp(Number(raw.w) || def.defaultW, def.minW, def.maxW);
    const h = clamp(Number(raw.h) || def.defaultH, def.minH, def.maxH);
    const x = clamp(Number(raw.x) || 0, 0, COLS - w);
    const y = Math.max(0, Number(raw.y) || 0);
    out.push({ id: String(raw.id || newId()), type: def.id, x, y, w, h, config: raw.config });
  }
  return resolveOverlaps(out);
}

/** Сдвигает вниз виджеты, которые накладываются на уже стоящие (после зажатия размеров). */
function resolveOverlaps(items: PlacedWidget[]): PlacedWidget[] {
  const settled: PlacedWidget[] = [];
  for (const p of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const q = { ...p };
    while (settled.some(s => overlaps(s, q))) {
      q.y = settled.filter(s => overlaps(s, q)).reduce((m, s) => Math.max(m, s.y + s.h), q.y);
    }
    settled.push(q);
  }
  return items.map(p => settled.find(s => s.id === p.id)!);
}

/** null — пользователь ещё ничего не настраивал (показываем раскладку по умолчанию). */
export function loadGrid(): PlacedWidget[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === null) return null;
    return sanitizeGrid(JSON.parse(raw));
  } catch { return null; }
}

export function saveGrid(widgets: PlacedWidget[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(widgets)); } catch { /* хранилище недоступно */ }
}

export function resetGrid(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
}

// ─── Утилиты ─────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export function newId(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function overlaps(a: Pick<PlacedWidget, "x"|"y"|"w"|"h">, b: Pick<PlacedWidget, "x"|"y"|"w"|"h">): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Находит первое свободное место на сетке для виджета w×h */
export function findFreeSlot(placed: PlacedWidget[], w: number, h: number): { x: number; y: number } {
  const maxRow = Math.max(0, ...placed.map(p => p.y + p.h));
  for (let y = 0; y <= maxRow; y++) {
    for (let x = 0; x <= COLS - w; x++) {
      const ghost = { x, y, w, h };
      if (!placed.some(p => overlaps(ghost, p))) return { x, y };
    }
  }
  return { x: 0, y: maxRow };
}

/**
 * Ставит виджет на новое место/размер и сдвигает вниз всё, что с ним
 * пересеклось (каскадом), — ничего не накладывается друг на друга.
 */
export function placeWidget(
  placed: PlacedWidget[],
  id: string,
  next: Partial<Pick<PlacedWidget, "x"|"y"|"w"|"h">>,
): PlacedWidget[] {
  const items = placed.map(p => (p.id === id ? { ...p, ...next } : { ...p }));
  const moved = items.find(p => p.id === id);
  if (!moved) return placed;

  // Остальные — сверху вниз; каждый, кто пересёкся с уже поставленными, едет вниз.
  const settled: PlacedWidget[] = [moved];
  const rest = items.filter(p => p.id !== id).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of rest) {
    while (settled.some(s => overlaps(s, p))) {
      const blocker = settled.filter(s => overlaps(s, p)).reduce((m, s) => Math.max(m, s.y + s.h), 0);
      p.y = blocker;
    }
    settled.push(p);
  }
  return items.map(p => settled.find(s => s.id === p.id)!);
}

/**
 * Перенос виджета мышью. Если он лёг ровно на соседа того же размера —
 * они меняются местами; иначе соседи сдвигаются вниз. После — подтягиваем всё вверх.
 */
export function moveWidget(placed: PlacedWidget[], id: string, x: number, y: number): PlacedWidget[] {
  const moving = placed.find(p => p.id === id);
  if (!moving) return placed;
  const target = { x, y, w: moving.w, h: moving.h };
  const hit = placed.filter(p => p.id !== id && overlaps(target, p));
  if (hit.length === 1 && hit[0].w === moving.w && hit[0].h === moving.h) {
    const other = hit[0];
    return compactGrid(placed.map(p =>
      p.id === id ? { ...p, x: other.x, y: other.y }
      : p.id === other.id ? { ...p, x: moving.x, y: moving.y }
      : p,
    ));
  }
  return compactGrid(placeWidget(placed, id, { x, y }));
}

/** Поднимает виджеты вверх, убирая пустые строки между ними. */
export function compactGrid(placed: PlacedWidget[]): PlacedWidget[] {
  const sorted = [...placed].sort((a, b) => a.y - b.y || a.x - b.x).map(p => ({ ...p }));
  const done: PlacedWidget[] = [];
  for (const p of sorted) {
    while (p.y > 0 && !done.some(d => overlaps(d, { ...p, y: p.y - 1 }))) p.y -= 1;
    done.push(p);
  }
  return placed.map(p => done.find(d => d.id === p.id)!);
}
