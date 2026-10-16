// Журнал обмена с МедОДС и Битрикс24 и выгрузка базы (/api/system, см. backend/app/api/system.py)
import { API_URL } from "./api";
import { authFetch } from "./auth";

export type RunStatus = "running" | "ok" | "warning" | "error";

export interface SyncRun {
  id: number;
  job: string;
  title: string;
  source: string;
  source_label: string;
  trigger: string;
  trigger_label: string;
  user_name: string | null;
  period_from: string | null;
  period_to: string | null;
  status: RunStatus;
  summary: string;
  error: string | null;
  requests: number;
  failed: number;
  records: number;
  bytes: number;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  has_error: boolean;
}

export interface RunEvent { at: string; level: string; msg: string }

export interface SyncRunDetail extends SyncRun {
  events: RunEvent[];
  result: unknown;
}

export interface SyncRequest {
  id: number;
  run_id: number | null;
  at: string;
  source: string;
  source_label: string;
  method: string;
  endpoint: string;
  title: string;
  summary: string;
  status_code: number | null;
  ok: boolean;
  duration_ms: number;
  response_bytes: number;
  records: number | null;
  error: string | null;
  has_body: boolean;
}

export interface SyncRequestDetail extends SyncRequest {
  url: string;
  params: unknown;
  content_type: string;
  fields: string[] | null;
  body: string | null;
  body_pretty: boolean;
  body_truncated: boolean;
}

export interface JobState {
  job: string;
  title: string;
  source: string;
  source_label: string;
  last: SyncRun | null;
  last_ok_at: string | null;
}

export interface LogOverview {
  jobs: JobState[];
  day: { requests: number; failed: number; bytes: number };
  storage_bytes: number;
  oldest_at: string | null;
  keep_request_days: number;
  keep_run_days: number;
  max_body: number;
}

export interface RunFilters {
  source?: string;
  job?: string;
  status?: string;          // ok / warning / error / running / problems
  date?: string;            // один день, YYYY-MM-DD
}

export interface RequestFilters {
  run?: string;             // номер сеанса или none
  source?: string;
  only_errors?: boolean;
  q?: string;
  date?: string;
}

export interface DbTable { name: string; rows_estimate: number; bytes: number }
export interface ExportInfo {
  pg_dump: string | null;
  server_version: string;
  database_bytes: number;
  tables: DbTable[];
  log_tables: string[];
}

async function get<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== false) qs.set(k, String(v));
  }
  const res = await authFetch(`${API_URL}/api/system${path}${qs.size ? `?${qs}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (typeof j.detail === "string") return j.detail;
  } catch { /* не JSON */ }
  return res.status === 403 ? "Недостаточно прав" : `Ошибка сервера (${res.status})`;
}

export const systemApi = {
  overview: () => get<LogOverview>("/logs/overview"),
  runs: (f: RunFilters, before?: number) =>
    get<{ runs: SyncRun[]; more: boolean; jobs: { job: string; title: string }[] }>("/logs/runs", {
      source: f.source, job: f.job, status: f.status, date_from: f.date, date_to: f.date, before, limit: 50,
    }),
  run: (id: number) => get<{ run: SyncRunDetail; requests: SyncRequest[] }>(`/logs/runs/${id}`),
  requests: (f: RequestFilters, before?: number) =>
    get<{ requests: SyncRequest[]; more: boolean }>("/logs/requests", {
      run: f.run, source: f.source, only_errors: f.only_errors, q: f.q?.trim(),
      date_from: f.date, date_to: f.date, before, limit: 100,
    }),
  request: (id: number) => get<SyncRequestDetail>(`/logs/requests/${id}`),
  exportInfo: () => get<ExportInfo>("/export/info"),
};

/** Скачать файл с сервера (с токеном) и отдать браузеру. */
export async function downloadFrom(path: string, fallbackName: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/system${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await errorText(res));
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 ** 2) return `${(n / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} КБ`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
  return `${(n / 1024 ** 3).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ГБ`;
}

export function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} мс`;
  const s = ms / 1000;
  if (s < 60) return `${s.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} с`;
  return `${Math.floor(s / 60)} мин ${Math.round(s % 60)} с`;
}

export function formatTime(iso: string, withDate = true): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (!withDate || sameDay) return sameDay && withDate ? `сегодня ${time}` : time;
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} ${time}`;
}

export function formatPeriod(from: string | null, to: string | null): string {
  if (!from) return "";
  const f = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return !to || to === from ? f(from) : `${f(from)} — ${f(to)}`;
}
