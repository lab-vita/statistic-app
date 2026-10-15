/**
 * Конструктор отчётов: типы, запросы к API, периоды и форматирование.
 * Сервер считает отчёт и делает выгрузки (xlsx, pdf); интерфейс хранит
 * настройки конструктора (BuilderState) — они же сохраняются в шаблоны.
 */
import { authFetch } from "@/lib/auth";
import { toDateStr, type DeltaDir } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const url = (path: string) =>
  new URL(BASE + path, typeof window !== "undefined" ? window.location.origin : "http://localhost").toString();

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await authFetch(url(path), {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (typeof j.detail === "string") return j.detail;
  } catch { /* не JSON */ }
  return `Ошибка ${res.status}`;
}

// ─── Схема ───────────────────────────────────────────────────────────

export type Unit = "count" | "rub" | "pct" | "sec" | "min";
export type Better = "up" | "down" | null;

export interface MetricInfo { key: string; label: string; unit: Unit; better: Better; hint?: string }
export interface DimInfo { key: string; label: string }
export interface SourceOption {
  key: string; label: string; default: string;
  values: { value: string; label: string }[];
}
export interface SourceInfo {
  key: string; label: string; hint: string;
  metrics: MetricInfo[]; dimensions: DimInfo[]; options: SourceOption[];
}

export const fetchSchema = () => send<{ sources: SourceInfo[] }>("/api/reports/builder/schema", "GET");

// ─── Настройки конструктора ──────────────────────────────────────────

export type Granularity = "auto" | "day" | "week" | "month";
export type PresetKey =
  | "yesterday" | "last7" | "last30" | "this_month" | "prev_month"
  | "this_quarter" | "prev_quarter" | "this_year" | "prev_year" | "custom";

export interface BuilderState {
  /** пусто — название придумывается по настройкам */
  title: string;
  source: string;
  metrics: string[];
  groupBy: string[];
  granularity: Granularity;
  period: { preset: PresetKey; from?: string; to?: string };
  compare: boolean;
  filters: Record<string, string[]>;
  /** подписи выбранных значений фильтров, чтобы показать их без запроса */
  filterLabels: Record<string, Record<string, string>>;
  options: Record<string, string>;
}

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "yesterday",    label: "Вчера" },
  { key: "last7",        label: "7 дней" },
  { key: "last30",       label: "30 дней" },
  { key: "this_month",   label: "Этот месяц" },
  { key: "prev_month",   label: "Прошлый месяц" },
  { key: "this_quarter", label: "Этот квартал" },
  { key: "prev_quarter", label: "Прошлый квартал" },
  { key: "this_year",    label: "С начала года" },
  { key: "prev_year",    label: "Прошлый год" },
  { key: "custom",       label: "Свои даты" },
];

/** Даты пресета. Текущие периоды заканчиваются вчерашним днём — сегодня ещё не закончилось. */
export function resolvePeriod(p: BuilderState["period"], today = new Date()): { from: string; to: string } {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const y = new Date(t); y.setDate(t.getDate() - 1);
  const d = (yy: number, mm: number, dd: number) => new Date(yy, mm, dd);
  const r = (a: Date, b: Date) => ({ from: toDateStr(a), to: toDateStr(b) });
  const qStart = (dt: Date) => d(dt.getFullYear(), Math.floor(dt.getMonth() / 3) * 3, 1);
  switch (p.preset) {
    case "yesterday": return r(y, y);
    case "last7":  { const a = new Date(y); a.setDate(y.getDate() - 6); return r(a, y); }
    case "last30": { const a = new Date(y); a.setDate(y.getDate() - 29); return r(a, y); }
    case "this_month":   return r(d(y.getFullYear(), y.getMonth(), 1), y);
    case "prev_month": {
      const a = d(t.getFullYear(), t.getMonth() - 1, 1);
      return r(a, d(a.getFullYear(), a.getMonth() + 1, 0));
    }
    case "this_quarter": return r(qStart(y), y);
    case "prev_quarter": {
      const a = qStart(t); a.setMonth(a.getMonth() - 3);
      return r(a, d(a.getFullYear(), a.getMonth() + 3, 0));
    }
    case "this_year": return r(d(y.getFullYear(), 0, 1), y);
    case "prev_year": return r(d(t.getFullYear() - 1, 0, 1), d(t.getFullYear() - 1, 11, 31));
    default: {
      const from = p.from ?? toDateStr(d(y.getFullYear(), y.getMonth(), 1));
      const to = p.to ?? toDateStr(y);
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

export function effectiveGranularity(g: Granularity, from: string, to: string): Exclude<Granularity, "auto"> {
  if (g !== "auto") return g;
  const span = (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000 + 1;
  return span <= 31 ? "day" : span <= 120 ? "week" : "month";
}

// Как назвать группировку в автоматическом названии: «Звонки по операторам»
const DIM_PHRASE: Record<string, string> = {
  weekday: "дням недели", hour: "часам", operator: "операторам", doctor: "врачам",
  admin: "сотрудникам", admin_group: "группам сотрудников", source: "источникам",
  patient_type: "новым и повторным", status: "статусам", payer: "плательщикам",
  direction: "направлениям", service: "услугам",
};
const GRAN_PHRASE = { day: "дням", week: "неделям", month: "месяцам" } as const;

export function autoTitle(s: BuilderState, src: SourceInfo | undefined): string {
  if (!src) return "Отчёт";
  if (!s.groupBy.length) return `${src.label} за период`;
  const { from, to } = resolvePeriod(s.period);
  const parts = s.groupBy.map(k => k === "period"
    ? GRAN_PHRASE[effectiveGranularity(s.granularity, from, to)]
    : DIM_PHRASE[k] ?? (src.dimensions.find(d => d.key === k)?.label.toLowerCase() ?? k));
  return `${src.label} по ${parts.join(" и ")}`;
}

export function defaultState(src: SourceInfo): BuilderState {
  return {
    title: "",
    source: src.key,
    metrics: src.metrics.slice(0, 3).map(m => m.key),
    groupBy: ["period"],
    granularity: "auto",
    period: { preset: "this_month" },
    compare: true,
    filters: {},
    filterLabels: {},
    options: Object.fromEntries(src.options.map(o => [o.key, o.default])),
  };
}

/** Привести сохранённые настройки к текущей схеме: убрать то, чего больше нет или недоступно. */
export function sanitizeState(raw: Partial<BuilderState> | null | undefined, sources: SourceInfo[]): BuilderState | null {
  if (!raw || !sources.length) return null;
  const src = sources.find(s => s.key === raw.source);
  if (!src) return null;
  const base = defaultState(src);
  const metrics = (raw.metrics ?? []).filter(k => src.metrics.some(m => m.key === k));
  const groupBy = (raw.groupBy ?? []).filter(k => src.dimensions.some(d => d.key === k)).slice(0, 2);
  const filters = Object.fromEntries(Object.entries(raw.filters ?? {})
    .filter(([k, v]) => k !== "period" && src.dimensions.some(d => d.key === k) && v?.length));
  return {
    ...base,
    title: typeof raw.title === "string" ? raw.title : "",
    metrics: metrics.length ? metrics : base.metrics,
    groupBy,
    granularity: raw.granularity ?? "auto",
    period: raw.period?.preset ? raw.period : base.period,
    compare: raw.compare ?? true,
    filters,
    filterLabels: raw.filterLabels ?? {},
    options: { ...base.options, ...(raw.options ?? {}) },
  };
}

export function toRequest(s: BuilderState) {
  const { from, to } = resolvePeriod(s.period);
  return {
    source: s.source,
    metrics: s.metrics,
    group_by: s.groupBy,
    granularity: s.granularity,
    date_from: from,
    date_to: to,
    compare: s.compare,
    filters: s.filters,
    options: s.options,
  };
}

// ─── Результат ───────────────────────────────────────────────────────

export interface DeltaInfo { pct: number | null; dir: DeltaDir }
export interface ReportRow {
  keys: string[];
  labels: string[];
  values: Record<string, number>;
  prev: Record<string, number> | null;
  delta: Record<string, DeltaInfo>;
}
export interface ReportResult {
  source: { key: string; label: string };
  date_from: string; date_to: string;
  prev_from: string | null; prev_to: string | null;
  granularity: Exclude<Granularity, "auto">;
  metrics: MetricInfo[];
  dimensions: DimInfo[];
  row_compare: "bucket" | "period" | null;
  filters: { key: string; label: string; values: string[] }[];
  rows: ReportRow[];
  truncated: boolean;
  prev_series: Record<string, number>[] | null;
  totals: { values: Record<string, number>; prev: Record<string, number> | null; delta: Record<string, DeltaInfo> };
}

export const runReport = (s: BuilderState) => send<ReportResult>("/api/reports/builder/run", "POST", toRequest(s));

export interface DimValue { value: string; label: string; count: number }
export function fetchDimValues(s: BuilderState, dimension: string) {
  const { from, to } = resolvePeriod(s.period);
  const q = new URLSearchParams({ source: s.source, dimension, date_from: from, date_to: to });
  if (s.options.date_basis) q.set("date_basis", s.options.date_basis);
  return send<{ values: DimValue[] }>(`/api/reports/builder/values?${q}`, "GET");
}

/** Скачать отчёт файлом: сервер строит xlsx/pdf, браузер сохраняет. */
export async function downloadReport(s: BuilderState, format: "xlsx" | "pdf", title: string): Promise<void> {
  const res = await authFetch(url("/api/reports/builder/export"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: toRequest(s), format, title }),
  });
  if (!res.ok) throw new Error(await errorText(res));
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i);
  const name = m ? decodeURIComponent(m[1]) : `${title}.${format}`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

// ─── Шаблоны ─────────────────────────────────────────────────────────

export interface ReportTemplate {
  id: number;
  name: string;
  config: Partial<BuilderState>;
  created_by: string | null;
  updated_at: string | null;
  can_edit: boolean;
}

export const templatesApi = {
  list:   () => send<{ templates: ReportTemplate[] }>("/api/reports/templates", "GET"),
  create: (name: string, config: BuilderState) => send<ReportTemplate>("/api/reports/templates", "POST", { name, config }),
  update: (id: number, name: string, config: BuilderState) =>
    send<ReportTemplate>(`/api/reports/templates/${id}`, "PUT", { name, config }),
  remove: (id: number) => send<{ status: string }>(`/api/reports/templates/${id}`, "DELETE"),
};

// ─── Форматирование ──────────────────────────────────────────────────

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function fmtValue(v: number | null | undefined, unit: Unit): string {
  if (v == null) return "—";
  switch (unit) {
    case "rub": return `${nf.format(v)} ₽`;
    case "pct": return `${v.toFixed(1).replace(".", ",")}%`;
    case "sec": {
      const s = Math.round(v);
      return s >= 60 ? `${Math.floor(s / 60)} мин ${String(s % 60).padStart(2, "0")} с` : `${s} с`;
    }
    default: return nf.format(v);
  }
}

/** Короткая подпись для оси графика. */
export function fmtAxis(v: number, unit: Unit): string {
  const a = Math.abs(v);
  if (unit === "pct") return `${v}%`;
  if (unit === "sec") return `${Math.round(v / 60)} мин`;
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} млн`;
  if (a >= 10_000) return `${Math.round(v / 1000)} тыс`;
  return nf.format(v);
}

export function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function periodText(r: Pick<ReportResult, "date_from" | "date_to">): string {
  return r.date_from === r.date_to ? fmtDate(r.date_from) : `${fmtDate(r.date_from)} — ${fmtDate(r.date_to)}`;
}

export const ROW_COMPARE_LABEL = { day: "к пред. дню", week: "к пред. неделе", month: "к пред. месяцу" } as const;
