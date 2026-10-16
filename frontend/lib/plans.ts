/**
 * Планы: загрузка и сохранение плана месяца, раскладка по дням, прогноз.
 *
 * Человек задаёт цифру на месяц, рабочие дни недели и выходные; отдельные дни
 * можно поправить вручную. Раскладка по дням считается здесь же (для мгновенного
 * предпросмотра) и тем же способом на сервере при сохранении.
 */
import { authFetch } from "@/lib/auth";
import { toDateStr } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const url = (path: string) =>
  new URL(BASE + path, typeof window !== "undefined" ? window.location.origin : "http://localhost").toString();

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await authFetch(url(path), {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    try { const j = await res.json(); if (typeof j.detail === "string") msg = j.detail; } catch { /* не JSON */ }
    throw new Error(msg);
  }
  return res.json();
}

// ─── Типы ─────────────────────────────────────────────────────────────

export type PlanUnit = "count" | "rub" | "pct";

export interface PlanMetric {
  key: string;
  label: string;
  unit: PlanUnit;
  group: "calls" | "appointments" | "revenue";
  hint: string;
  /** sum — складывается по дням; pct — целевой процент на месяц */
  kind: "sum" | "pct";
  target: number | null;
  plan_days: Record<string, number>;
  overrides: Record<string, number>;
  fact_days: Record<string, number>;
  fact_total: number | null;
}

export interface PlanOverview {
  year: number;
  month: number;
  today: string;
  saved: boolean;
  workdays: number[];
  days_off: string[];
  working_days: string[];
  can_edit: boolean;
  metrics: PlanMetric[];
}

export interface PlanDraft {
  workdays: number[];
  days_off: string[];
  targets: Record<string, number | null>;
  overrides: Record<string, Record<string, number>>;
}

export const fetchPlanOverview = (year: number, month: number) =>
  send<PlanOverview>(`/api/plans/overview?year=${year}&month=${month}`, "GET");

export const savePlanOverview = (year: number, month: number, d: PlanDraft) =>
  send<PlanOverview>("/api/plans/overview", "PUT", { year, month, ...d });

// ─── Черновик и раскладка ────────────────────────────────────────────

export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** День недели с понедельника: 0 = пн … 6 = вс. */
export function weekdayOf(iso: string): number {
  return (new Date(`${iso}T00:00:00`).getDay() + 6) % 7;
}

export function monthDays(year: number, month: number): string[] {
  const out: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) { out.push(toDateStr(d)); d.setDate(d.getDate() + 1); }
  return out;
}

export function draftFrom(ov: PlanOverview): PlanDraft {
  return {
    workdays: [...ov.workdays],
    days_off: [...ov.days_off],
    targets: Object.fromEntries(ov.metrics.map(m => [m.key, m.target])),
    overrides: Object.fromEntries(ov.metrics.filter(m => m.kind === "sum").map(m => [m.key, { ...m.overrides }])),
  };
}

export function isWorking(iso: string, d: PlanDraft): boolean {
  return d.workdays.includes(weekdayOf(iso)) && !d.days_off.includes(iso);
}

/** Цифра на месяц → план по дням (так же, как на сервере). */
export function distribute(year: number, month: number, d: PlanDraft, key: string): Record<string, number> {
  const days = monthDays(year, month);
  const out: Record<string, number> = Object.fromEntries(days.map(x => [x, 0]));
  const target = d.targets[key];
  if (target == null) return out;
  const over = d.overrides[key] ?? {};
  Object.assign(out, over);
  const free = days.filter(x => isWorking(x, d) && !(x in over));
  const rest = Math.max(0, target - Object.values(over).reduce((s, v) => s + v, 0));
  if (free.length && rest > 0) {
    const whole = Math.round(rest);
    const base = Math.floor(whole / free.length);
    const extra = whole - base * free.length;
    free.forEach((x, i) => { out[x] = base + (i < extra ? 1 : 0); });
  }
  return out;
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${[...v].map(stable).sort().join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort()
      .filter(k => (v as Record<string, unknown>)[k] != null)
      .map(k => `${k}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}
export const sameDraft = (a: PlanDraft, b: PlanDraft) => stable(a) === stable(b);

// ─── Прогресс ─────────────────────────────────────────────────────────

export type Verdict = "good" | "warn" | "bad";
export const verdictOf = (pct: number): Verdict => (pct >= 100 ? "good" : pct >= 90 ? "warn" : "bad");

export interface SumProgress {
  state: "no-plan" | "upcoming" | "in-progress" | "finished";
  plan: number;
  fact: number;
  /** план на уже прошедшие дни (без сегодняшнего) */
  planToDate: number;
  factPct: number | null;
  forecast: number | null;
  forecastPct: number | null;
  verdict: Verdict | null;
}

/**
 * Прогноз по плану, а не по календарю: темп = факт ÷ план за завершённые дни,
 * прогноз = темп × план на месяц. Сегодняшний день в темп не входит.
 */
export function sumProgress(days: string[], plan: Record<string, number>, fact: Record<string, number>, today: string): SumProgress {
  const total = days.reduce((s, d) => s + (plan[d] ?? 0), 0);
  const factTotal = days.reduce((s, d) => s + (fact[d] ?? 0), 0);
  const done = days.filter(d => d < today);
  const planToDate = done.reduce((s, d) => s + (plan[d] ?? 0), 0);
  const base = { plan: total, fact: factTotal, planToDate, factPct: null, forecast: null, forecastPct: null, verdict: null };
  if (total <= 0) return { ...base, state: "no-plan" };
  const factPct = factTotal / total * 100;
  if (days[days.length - 1] < today) return { ...base, state: "finished", factPct, verdict: verdictOf(factPct) };
  if (days[0] > today) return { ...base, state: "upcoming", factPct: null };
  if (planToDate <= 0) return { ...base, state: "in-progress", factPct };
  const doneFact = done.reduce((s, d) => s + (fact[d] ?? 0), 0);
  const pace = doneFact / planToDate;
  return {
    ...base, state: "in-progress", factPct,
    forecast: Math.round(pace * total), forecastPct: pace * 100, verdict: verdictOf(pace * 100),
  };
}

// ─── Форматирование ──────────────────────────────────────────────────

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function fmtPlan(v: number | null | undefined, unit: PlanUnit): string {
  if (v == null) return "—";
  if (unit === "rub") return `${nf.format(v)} ₽`;
  if (unit === "pct") return `${v.toFixed(1).replace(".", ",").replace(",0", "")}%`;
  return nf.format(v);
}

/** Коротко для клеток календаря: 12,3 тыс / 1,2 млн. */
export function fmtShort(v: number, unit: PlanUnit): string {
  if (unit === "pct") return `${Math.round(v)}%`;
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} млн`;
  if (a >= 10_000) return `${Math.round(v / 1000)} тыс`;
  return nf.format(v);
}

export function monthTitle(year: number, month: number): string {
  const s = new Date(year, month - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(" г.", "");
}

export function dayTitle(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
};
export const VERDICT_BAR: Record<Verdict, string> = {
  good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500",
};
