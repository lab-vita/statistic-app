// ─── Типы виджетов ────────────────────────────────────────────

export type WidgetSize = "small" | "medium" | "large";
export type WidgetMode = "number" | "card" | "chart";
export type ChartType = "line" | "bar" | "area";
export type FormulaOp = "divide" | "subtract" | "add" | "multiply";
export type FormulaFormat = "percent" | "money" | "number";

// Источники данных
export type DataSource = "calls" | "appointments" | "revenue" | "sales";

// Все доступные метрики по источнику
export const SOURCE_METRICS: Record<DataSource, { key: string; label: string; format: FormulaFormat }[]> = {
  calls: [
    { key: "incoming",        label: "Входящие звонки",    format: "number" },
    { key: "outgoing",        label: "Исходящие звонки",   format: "number" },
    { key: "missed",          label: "Пропущенные",         format: "number" },
    { key: "total",           label: "Всего звонков",       format: "number" },
    { key: "avg_duration",    label: "Ср. длительность (с)",format: "number" },
    { key: "callback_count",  label: "Перезвонили",         format: "number" },
    { key: "callback_pct",    label: "% перезвонили",       format: "percent" },
  ],
  appointments: [
    { key: "total",           label: "Всего записей",       format: "number" },
    { key: "visits",          label: "Явки",                format: "number" },
    { key: "noshow",          label: "Неявки",              format: "number" },
    { key: "cancels",         label: "Отмены",              format: "number" },
    { key: "new_patients",    label: "Новые пациенты",      format: "number" },
    { key: "visit_pct",       label: "% явки",              format: "percent" },
    { key: "noshow_pct",      label: "% неявок",            format: "percent" },
  ],
  revenue: [
    { key: "total_paid",      label: "Выручка",             format: "money" },
    { key: "count",           label: "Платежей",            format: "number" },
    { key: "by_cash",         label: "Наличные",            format: "money" },
    { key: "by_card",         label: "Карта",               format: "money" },
    { key: "by_cashless",     label: "Безнал",              format: "money" },
  ],
  sales: [
    { key: "final_sum",       label: "Выручка по услугам",  format: "money" },
  ],
};

// Готовые составные метрики
export interface CompositePreset {
  id:          string;
  label:       string;
  description: string;
  available:   boolean; // можно ли вычислить из текущих данных
  formula: {
    a:      { source: DataSource; metric: string };
    b:      { source: DataSource; metric: string } | { value: number };
    op:     FormulaOp;
    format: FormulaFormat;
  };
}

export const COMPOSITE_PRESETS: CompositePreset[] = [
  {
    id:          "conversion",
    label:       "Конверсия звонок → запись",
    description: "Входящие звонки / Записи × 100%",
    available:   true,
    formula: {
      a:      { source: "appointments", metric: "total" },
      b:      { source: "calls",        metric: "incoming" },
      op:     "divide",
      format: "percent",
    },
  },
  {
    id:          "visit_rate",
    label:       "Явка",
    description: "Явки / Записей × 100%",
    available:   true,
    formula: {
      a:      { source: "appointments", metric: "visits" },
      b:      { source: "appointments", metric: "total" },
      op:     "divide",
      format: "percent",
    },
  },
  {
    id:          "avg_revenue_per_visit",
    label:       "Средний чек за визит",
    description: "Выручка / Явки",
    available:   true,
    formula: {
      a:      { source: "revenue",      metric: "total_paid" },
      b:      { source: "appointments", metric: "visits" },
      op:     "divide",
      format: "money",
    },
  },
  {
    id:          "missed_rate",
    label:       "% пропущенных",
    description: "Пропущенные / Входящие × 100%",
    available:   true,
    formula: {
      a:      { source: "calls", metric: "missed" },
      b:      { source: "calls", metric: "incoming" },
      op:     "divide",
      format: "percent",
    },
  },
  {
    id:          "callback_rate",
    label:       "% перезвонов",
    description: "Перезвонили / Пропущенные × 100%",
    available:   true,
    formula: {
      a:      { source: "calls", metric: "callback_count" },
      b:      { source: "calls", metric: "missed" },
      op:     "divide",
      format: "percent",
    },
  },
  {
    id:          "revenue_per_call",
    label:       "Выручка на входящий",
    description: "Выручка / Входящие звонки",
    available:   true,
    formula: {
      a:      { source: "revenue", metric: "total_paid" },
      b:      { source: "calls",   metric: "incoming" },
      op:     "divide",
      format: "money",
    },
  },
  {
    id:          "new_patient_rate",
    label:       "% новых пациентов",
    description: "Новые пациенты / Всего записей × 100%",
    available:   true,
    formula: {
      a:      { source: "appointments", metric: "new_patients" },
      b:      { source: "appointments", metric: "total" },
      op:     "divide",
      format: "percent",
    },
  },
];

// ─── Конфиг виджета ───────────────────────────────────────────

export interface SimpleWidgetConfig {
  kind:    "simple";
  source:  DataSource;
  metric:  string;
}

export interface CompositeWidgetConfig {
  kind:        "composite";
  presetId?:   string; // если выбран готовый пресет
  label?:      string; // пользовательский заголовок для custom
  formula: {
    a:      { source: DataSource; metric: string };
    b:      { source: DataSource; metric: string } | { value: number };
    op:     FormulaOp;
    format: FormulaFormat;
  };
}

export interface Widget {
  id:         string;
  title:      string;
  size:       WidgetSize;
  mode:       WidgetMode;
  chartType?: ChartType;
  config:     SimpleWidgetConfig | CompositeWidgetConfig;
}

// ─── Конфиг дашборда ─────────────────────────────────────────

export interface DashboardConfig {
  version:  number;
  widgets:  Widget[];
}

// ─── Дефолтный дашборд ────────────────────────────────────────

export const DEFAULT_DASHBOARD: DashboardConfig = {
  version: 1,
  widgets: [
    {
      id:    "w-calls-incoming",
      title: "Входящие звонки",
      size:  "small",
      mode:  "card",
      config: { kind: "simple", source: "calls", metric: "incoming" },
    },
    {
      id:    "w-calls-missed",
      title: "Пропущенные",
      size:  "small",
      mode:  "card",
      config: { kind: "simple", source: "calls", metric: "missed" },
    },
    {
      id:    "w-appt-total",
      title: "Записи",
      size:  "small",
      mode:  "card",
      config: { kind: "simple", source: "appointments", metric: "total" },
    },
    {
      id:    "w-revenue",
      title: "Выручка",
      size:  "small",
      mode:  "card",
      config: { kind: "simple", source: "revenue", metric: "total_paid" },
    },
    {
      id:    "w-conversion",
      title: "Конверсия звонок → запись",
      size:  "medium",
      mode:  "card",
      config: {
        kind:     "composite",
        presetId: "conversion",
        formula: {
          a:      { source: "appointments", metric: "total" },
          b:      { source: "calls",        metric: "incoming" },
          op:     "divide",
          format: "percent",
        },
      },
    },
    {
      id:    "w-visit-rate",
      title: "Явка пациентов",
      size:  "medium",
      mode:  "card",
      config: {
        kind:     "composite",
        presetId: "visit_rate",
        formula: {
          a:      { source: "appointments", metric: "visits" },
          b:      { source: "appointments", metric: "total" },
          op:     "divide",
          format: "percent",
        },
      },
    },
    {
      id:        "w-calls-chart",
      title:     "Динамика звонков",
      size:      "large",
      mode:      "chart",
      chartType: "bar",
      config: { kind: "simple", source: "calls", metric: "incoming" },
    },
  ],
};

// ─── localStorage ─────────────────────────────────────────────

const LS_KEY = "dashboard_config_v1";

export function loadDashboard(): DashboardConfig {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_DASHBOARD;
    const parsed = JSON.parse(raw) as DashboardConfig;
    if (parsed.version !== DEFAULT_DASHBOARD.version) return DEFAULT_DASHBOARD;
    return parsed;
  } catch {
    return DEFAULT_DASHBOARD;
  }
}

export function saveDashboard(config: DashboardConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(config));
}

// ─── Вычисление составной метрики ────────────────────────────

type DataBag = Record<string, Record<string, number>>;

export function computeComposite(
  formula: CompositeWidgetConfig["formula"],
  data: DataBag,
): number | null {
  const getVal = (ref: { source: DataSource; metric: string } | { value: number }): number | null => {
    if ("value" in ref) return ref.value;
    return data[ref.source]?.[ref.metric] ?? null;
  };

  const a = getVal(formula.a);
  const b = getVal(formula.b);
  if (a === null || b === null) return null;

  switch (formula.op) {
    case "divide":   return b === 0 ? null : a / b;
    case "subtract": return a - b;
    case "add":      return a + b;
    case "multiply": return a * b;
  }
}

export function formatValue(value: number, format: FormulaFormat): string {
  switch (format) {
    case "percent": return `${(value * 100).toFixed(1)}%`;
    case "money":   return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value) + " ₽";
    case "number":  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
  }
}

export function getMetricFormat(source: DataSource, metric: string): FormulaFormat {
  return SOURCE_METRICS[source]?.find(m => m.key === metric)?.format ?? "number";
}

export function getMetricLabel(source: DataSource, metric: string): string {
  return SOURCE_METRICS[source]?.find(m => m.key === metric)?.label ?? metric;
}

export function newWidgetId(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
