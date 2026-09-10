const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type DeltaDir = "up" | "down" | "flat" | null;

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
  role?: string;
  // Дельты vs предыдущий период
  incoming_delta_pct:     number | null;
  incoming_delta_dir:     DeltaDir;
  outgoing_delta_pct:     number | null;
  outgoing_delta_dir:     DeltaDir;
  missed_delta_pct:       number | null;
  missed_delta_dir:       DeltaDir;
  total_delta_pct:        number | null;
  total_delta_dir:        DeltaDir;
  avg_duration_delta_pct: number | null;
  avg_duration_delta_dir: DeltaDir;
  callback_pct_delta_pct: number | null;
  callback_pct_delta_dir: DeltaDir;
}

export interface StatsResponse {
  date_from: string;
  date_to:   string;
  prev_from: string;
  prev_to:   string;
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
  date_to:   string;
  interval:  number;
  slots:     SlotItem[];
}

export interface DailyItem {
  date:     string;
  incoming: number;
  outgoing: number;
  missed:   number;
  total:    number;
}

export interface DailyResponse {
  date_from: string;
  date_to:   string;
  days:      DailyItem[];
}

export interface Operator {
  id:   string;
  name: string;
}

export interface Admin {
  surname: string;
  group:   "callcenter" | "admin" | "other";
  label:   string;
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

export function fetchAdmins(): Promise<{ admins: Admin[] }> {
  return apiFetch("/api/appointments/admins");
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

export interface HeatmapCell {
  weekday:      number;
  weekday_name: string;
  hour:         number;
  incoming:     number;
  outgoing:     number;
  missed:       number;
  total:        number;
}

export interface HeatmapResponse {
  date_from: string;
  date_to:   string;
  cells:     HeatmapCell[];
}

export interface ComparisonSeries {
  operator_id: string;
  name:        string;
  values:      { date: string; value: number }[];
}

export interface ComparisonResponse {
  date_from: string;
  date_to:   string;
  metric:    string;
  dates:     string[];
  series:    ComparisonSeries[];
}

export type ComparisonMetric = "total" | "incoming" | "outgoing" | "missed";

export function fetchHeatmap(dateFrom: string, dateTo: string, operatorId?: string): Promise<HeatmapResponse> {
  return apiFetch(`/api/calls/heatmap?date_from=${dateFrom}&date_to=${dateTo}${opParam(operatorId)}`);
}

export function fetchComparison(dateFrom: string, dateTo: string, metric: ComparisonMetric): Promise<ComparisonResponse> {
  return apiFetch(`/api/calls/comparison?date_from=${dateFrom}&date_to=${dateTo}&metric=${metric}`);
}

// ─── МедОДС ──────────────────────────────────────────────────

export interface AdminAppointmentStats {
  name:             string;
  group:            "callcenter" | "admin" | "other";
  group_label:      string;
  is_callcenter:    boolean;
  total:            number;
  visits:           number;
  noshow:           number;
  cancels:          number;
  pending:          number;
  new_patients:     number;
  callcenter_total: number;
  visit_pct:        number;
  noshow_pct:       number;
}

export interface AppointmentStatsResponse {
  date_from: string;
  date_to:   string;
  total:     AdminAppointmentStats;
  by_admin:  Record<string, AdminAppointmentStats>;
}

export interface AppointmentDailyItem {
  date:         string;
  total:        number;
  visits:       number;
  noshow:       number;
  new_patients: number;
}

export interface AppointmentDailyResponse {
  date_from: string;
  date_to:   string;
  days:      AppointmentDailyItem[];
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

export async function collectAppointments(dateFrom: string, dateTo: string) {
  const res = await fetch(
    `${API_URL}/api/appointments/collect?date_from=${dateFrom}&date_to=${dateTo}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Ошибка сбора данных МедОДС");
  return res.json();
}
