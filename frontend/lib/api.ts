const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface OperatorStats {
  name: string;
  incoming: number;
  outgoing: number;
  missed: number;
  total: number;
  avg_duration: number;
  avg_wait_time: number;
  missed_total: number;
  callback_count: number;
  callback_pct: number;
  avg_reaction_sec: number;
}

export interface StatsResponse {
  date_from: string;
  date_to: string;
  operator_id?: string;
  operators: Record<string, OperatorStats>;
}

export interface SlotItem {
  time: string;
  incoming: number;
  outgoing: number;
  missed: number;
}

export interface HourlyResponse {
  date_from: string;
  date_to: string;
  interval: number;
  slots: SlotItem[];
}

export interface DailyItem {
  date: string;
  incoming: number;
  outgoing: number;
  missed: number;
  total: number;
}

export interface DailyResponse {
  date_from: string;
  date_to: string;
  days: DailyItem[];
}

export interface Operator {
  id: string;
  name: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Ошибка загрузки данных");
  return res.json();
}

function opParam(operatorId?: string) {
  return operatorId ? `&operator_id=${operatorId}` : "";
}

export function fetchStats(dateFrom: string, dateTo: string, operatorId?: string): Promise<StatsResponse> {
  return apiFetch(`/api/calls/stats?date_from=${dateFrom}&date_to=${dateTo}${opParam(operatorId)}`);
}

export function fetchHourly(dateFrom: string, dateTo: string, interval = 60, operatorId?: string): Promise<HourlyResponse> {
  return apiFetch(`/api/calls/hourly?date_from=${dateFrom}&date_to=${dateTo}&interval=${interval}${opParam(operatorId)}`);
}

export function fetchDaily(dateFrom: string, dateTo: string, operatorId?: string): Promise<DailyResponse> {
  return apiFetch(`/api/calls/daily?date_from=${dateFrom}&date_to=${dateTo}${opParam(operatorId)}`);
}

export function fetchOperators(): Promise<{ operators: Operator[] }> {
  return apiFetch("/api/calls/operators");
}

export async function collectCalls(dateFrom: string, dateTo: string) {
  const res = await fetch(
    `${API_URL}/api/calls/collect?date_from=${dateFrom}&date_to=${dateTo}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Ошибка сбора данных");
  return res.json();
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}м ${s}с` : `${s}с`;
}

export function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("");
}

export const OPERATOR_COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: "rgba(34,197,94,.15)",  text: "#22c55e" },
  1: { bg: "rgba(59,130,246,.15)", text: "#3b82f6" },
  2: { bg: "rgba(168,85,247,.15)", text: "#a855f7" },
  3: { bg: "rgba(234,179,8,.15)",  text: "#eab308" },
};

export interface HeatmapCell {
  weekday: number;
  weekday_name: string;
  hour: number;
  incoming: number;
  outgoing: number;
  missed: number;
  total: number;
}

export interface HeatmapResponse {
  date_from: string;
  date_to: string;
  cells: HeatmapCell[];
}

export interface ComparisonSeries {
  operator_id: string;
  name: string;
  values: { date: string; value: number }[];
}

export interface ComparisonResponse {
  date_from: string;
  date_to: string;
  metric: string;
  dates: string[];
  series: ComparisonSeries[];
}

export type ComparisonMetric = "total" | "incoming" | "outgoing" | "missed";

export function fetchHeatmap(dateFrom: string, dateTo: string, operatorId?: string): Promise<HeatmapResponse> {
  return apiFetch(`/api/calls/heatmap?date_from=${dateFrom}&date_to=${dateTo}${opParam(operatorId)}`);
}

export function fetchComparison(dateFrom: string, dateTo: string, metric: ComparisonMetric): Promise<ComparisonResponse> {
  return apiFetch(`/api/calls/comparison?date_from=${dateFrom}&date_to=${dateTo}&metric=${metric}`);
}

// ─── МедОДС — Записи на приём ────────────────────────────────

export interface AdminAppointmentStats {
  name: string;
  total: number;
  visits: number;
  noshow: number;
  cancels: number;
  pending: number;
  new_patients: number;
  callcenter_total: number;
  visit_pct: number;
  noshow_pct: number;
  is_callcenter: boolean;
}

export interface AppointmentStatsResponse {
  date_from: string;
  date_to: string;
  total: AdminAppointmentStats;
  by_admin: Record<string, AdminAppointmentStats>;
}

export interface AppointmentDailyItem {
  date: string;
  total: number;
  visits: number;
  noshow: number;
  new_patients: number;
}

export interface AppointmentDailyResponse {
  date_from: string;
  date_to: string;
  days: AppointmentDailyItem[];
}

export interface SuspiciousItem {
  medods_id: number;
  date: string;
  time: string;
  client: string;
  admin: string;
  status: string;
  reasons: string[];
}

export interface SuspiciousResponse {
  date_from: string;
  date_to: string;
  items: SuspiciousItem[];
}

export function fetchAppointmentStats(
  dateFrom: string, dateTo: string, adminSurname?: string
): Promise<AppointmentStatsResponse> {
  const q = adminSurname ? `&admin_surname=${encodeURIComponent(adminSurname)}` : "";
  return apiFetch(`/api/appointments/stats?date_from=${dateFrom}&date_to=${dateTo}${q}`);
}

export function fetchAppointmentDaily(
  dateFrom: string, dateTo: string, adminSurname?: string
): Promise<AppointmentDailyResponse> {
  const q = adminSurname ? `&admin_surname=${encodeURIComponent(adminSurname)}` : "";
  return apiFetch(`/api/appointments/daily?date_from=${dateFrom}&date_to=${dateTo}${q}`);
}

export function fetchSuspicious(
  dateFrom: string, dateTo: string
): Promise<SuspiciousResponse> {
  return apiFetch(`/api/appointments/suspicious?date_from=${dateFrom}&date_to=${dateTo}`);
}

export async function collectAppointments(dateFrom: string, dateTo: string) {
  const res = await fetch(
    `${API_URL}/api/appointments/collect?date_from=${dateFrom}&date_to=${dateTo}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Ошибка сбора данных МедОДС");
  return res.json();
}