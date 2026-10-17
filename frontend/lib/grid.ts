// ─── Сетка главной: 12 колонок, строки фиксированной высоты ──────
//
// Каждый виджет занимает w колонок × h строк. Ширина колонки считается
// по ширине контейнера, высота строки фиксирована (ROW_H), поэтому
// цифры и графики не растягиваются на широких экранах.
// Раскладка хранится на сервере у сотрудника (lib/home-layout.ts) как массив PlacedWidget.

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
  | "view:calls" | "view:appointments" | "view:patients" | "view:revenue"
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
    id: "patients_noshows", group: "Пациенты", permission: "view:patients", data: ["noshows"],
    name: "Неявки по дням недели",
    description: "Доля неявок за период и в какие дни недели пациенты не приходят чаще всего.",
    defaultW: 4, defaultH: 3, minW: 3, minH: 3, maxW: 8, maxH: 5,
  },
  {
    id: "patients_returns", group: "Пациенты", permission: "view:patients", data: ["returns"],
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

// ─── Размещённый виджет ──────────────────────────────────────────────

export interface PlacedWidget {
  id:   string;
  type: WidgetTypeId;
  x:    number; // колонка (0-based)
  y:    number; // строка  (0-based)
  w:    number; // ширина в колонках
  h:    number; // высота в строках
  config?: Record<string, string>; // произвольные настройки виджета
}

// ─── Раскладка по умолчанию — все виджеты, какие есть ────────
//
// Сверху сводка, дальше по разделам в порядке меню. Виджеты с выбором метрики
// стоят в каждом варианте (все «Одна метрика», все тепловые карты).
// Без прав на раздел виджеты отфильтровываются, а сетка подтягивается вверх
// (compactGrid), поэтому дыр не остаётся.

type Row = [WidgetTypeId, number, number, number, number, string?];

const DEFAULT_ROWS: Row[] = [
  // сводка: главные цифры, воронка, план
  ["calls_single",        0,  0,  3, 2, "incoming"],
  ["calls_single",        3,  0,  3, 2, "lost"],
  ["appt_single",         6,  0,  3, 2, "visits"],
  ["revenue_single",      9,  0,  3, 2, "total_paid"],
  ["funnel_steps",        0,  2, 12, 2],
  ["calls_chart",         0,  4,  8, 4, "incoming"],
  ["plans_progress",      8,  4,  4, 4],
  // звонки
  ["calls_single",        0,  8,  3, 2, "received"],
  ["calls_single",        3,  8,  3, 2, "outgoing"],
  ["calls_single",        6,  8,  3, 2, "missed"],
  ["calls_single",        9,  8,  3, 2, "missed_pct"],
  ["calls_single",        0, 10,  3, 2, "lost_pct"],
  ["calls_single",        3, 10,  3, 2, "reaction"],
  ["calls_single",        6, 10,  3, 2, "callback_count"],
  ["calls_single",        9, 10,  3, 2, "callback_pct"],
  ["calls_single",        0, 12,  3, 2, "avg_duration"],
  ["calls_single",        3, 12,  3, 2, "conversion"],
  ["calls_trio",          6, 12,  6, 2],
  ["calls_funnel",        0, 14,  6, 6],
  ["calls_plan",          6, 14,  6, 3],
  ["calls_conversion",    6, 17,  6, 3],
  ["calls_heatmap",       0, 20, 12, 4, "total"],
  ["calls_heatmap",       0, 24,  6, 4, "incoming"],
  ["calls_heatmap",       6, 24,  6, 4, "missed"],
  ["calls_operators",     0, 28, 12, 4],
  // записи
  ["appt_single",         0, 32,  3, 2, "total"],
  ["appt_single",         3, 32,  3, 2, "noshow"],
  ["appt_sources",        6, 32,  6, 2],
  ["appt_single",         0, 34,  4, 2, "new_patients"],
  ["appt_single",         4, 34,  4, 2, "visit_pct"],
  ["appt_single",         8, 34,  4, 2, "noshow_pct"],
  ["appt_chart",          0, 36,  8, 3],
  ["appt_summary",        8, 36,  4, 3],
  ["appt_admins",         0, 39, 12, 4],
  // пациенты
  ["patients_noshows",    0, 43,  6, 3],
  ["patients_returns",    6, 43,  6, 3],
  // выручка
  ["revenue_single",      0, 46,  6, 2, "count"],
  ["revenue_single",      6, 46,  6, 2, "avg_check"],
  ["revenue_chart",       0, 48,  8, 3],
  ["revenue_methods",     8, 48,  4, 3],
  ["revenue_services",    0, 51,  6, 4],
  ["revenue_categories",  6, 51,  6, 4],
  // врачи, воронка, отчёты
  ["doctors_top",         0, 55, 12, 4],
  ["funnel_trend",        0, 59, 12, 3],
  ["reports_months",      0, 62,  6, 3, "calls"],
  ["reports_months",      6, 62,  6, 3, "appts"],
];

export const DEFAULT_LAYOUT: PlacedWidget[] = DEFAULT_ROWS.map(([type, x, y, w, h, metric]) => ({
  id: metric ? `d-${type}-${metric}` : `d-${type}`,
  type, x, y, w, h,
  ...(metric ? { config: { metric } } : {}),
}));

/** Раскладка по умолчанию для сотрудника: только виджеты, на которые у него есть права. */
export function defaultLayout(allowed: (pw: PlacedWidget) => boolean): PlacedWidget[] {
  return compactGrid(DEFAULT_LAYOUT.filter(allowed));
}

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
