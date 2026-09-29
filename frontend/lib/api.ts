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

// ─── Конверсия ───────────────────────────────────────────────

export interface ConversionOperator {
  operator_id:     string;
  name:            string;
  surname:         string;
  incoming:        number;
  appointments:    number;
  conversion_pct:  number;
}

export interface ConversionResponse {
  date_from: string;
  date_to:   string;
  operators: ConversionOperator[];
  total: {
    incoming:       number;
    appointments:   number;
    conversion_pct: number;
  };
}

// ─── Выручка (payments) ──────────────────────────────────────

export interface PaymentStats {
  count:       number;
  total_paid:  number;
  by_cash:     number;
  by_card:     number;
  by_cashless: number;
  by_credit:   number;
  by_balance:  number;
  count_delta_pct:      number | null;
  count_delta_dir:      DeltaDir;
  total_paid_delta_pct: number | null;
  total_paid_delta_dir: DeltaDir;
  by_cash_delta_pct:    number | null;
  by_cash_delta_dir:    DeltaDir;
  by_card_delta_pct:    number | null;
  by_card_delta_dir:    DeltaDir;
}

export interface PaymentStatsResponse extends PaymentStats {
  date_from:  string;
  date_to:    string;
  prev_from:  string;
  prev_to:    string;
  kind:       number | null;
  kind_label: string;
}

export interface PaymentDailyItem {
  date:        string;
  count:       number;
  total_paid:  number;
  by_cash:     number;
  by_card:     number;
  by_cashless: number;
  by_credit:   number;
}

export interface PaymentDailyResponse {
  date_from: string;
  date_to:   string;
  days:      PaymentDailyItem[];
}

export interface PaymentDailyByTypeResponse {
  date_from: string;
  date_to:   string;
  days:      string[];
  series:    { key: string; label: string; values: number[] }[];
}

export interface PaymentDoctor {
  doctor_id:      number;
  doctor_name:    string;
  doctor_surname: string;
  count:          number;
  total_paid:     number;
  pct:            number;
}

export interface PaymentDoctorResponse {
  date_from: string;
  date_to:   string;
  doctors:   PaymentDoctor[];
}

// ─── Продажи по услугам ───────────────────────────────────────

export interface SaleService {
  service_title: string;
  service_id:    number | null;
  unit:          string | null;
  amount:        number;
  final_sum:     number;
  pct_of_total:  number;
  delta_pct:     number | null;
  delta_dir:     DeltaDir;
}

export interface SalesStatsResponse {
  date_from: string;
  date_to:   string;
  total: {
    final_sum:  number;
    delta_pct:  number | null;
    delta_dir:  DeltaDir;
  };
  services: SaleService[];
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

export function fetchConversion(dateFrom: string, dateTo: string): Promise<ConversionResponse> {
  return apiFetch(`/api/calls/conversion?date_from=${dateFrom}&date_to=${dateTo}`);
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

export function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} млн`;
  if (amount >= 1_000)     return `${(amount / 1_000).toFixed(0)} тыс`;
  return String(amount);
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

export interface GroupBreakdownItem {
  count: number;
  pct:   number;
  label: string;
}

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
  new_pct:          number;
  cancel_pct:       number;
  total_delta_pct:            number | null;
  total_delta_dir:            DeltaDir;
  visits_delta_pct:           number | null;
  visits_delta_dir:           DeltaDir;
  noshow_delta_pct:           number | null;
  noshow_delta_dir:           DeltaDir;
  new_patients_delta_pct:     number | null;
  new_patients_delta_dir:     DeltaDir;
  callcenter_total_delta_pct: number | null;
  callcenter_total_delta_dir: DeltaDir;
  visit_pct_delta_pct:        number | null;
  visit_pct_delta_dir:        DeltaDir;
  noshow_pct_delta_pct:       number | null;
  noshow_pct_delta_dir:       DeltaDir;
  cancel_pct_delta_pct:       number | null;
  cancel_pct_delta_dir:       DeltaDir;
}

export interface AppointmentStatsResponse {
  date_from: string;
  date_to:   string;
  total:     AdminAppointmentStats;
  by_group:  Record<string, GroupBreakdownItem>;
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

// ─── Выручка ─────────────────────────────────────────────────

export function fetchPaymentStats(
  dateFrom: string, dateTo: string, kind = 6
): Promise<PaymentStatsResponse> {
  return apiFetch(`/api/payments/stats?date_from=${dateFrom}&date_to=${dateTo}&kind=${kind}`);
}

export function fetchPaymentDaily(
  dateFrom: string, dateTo: string, kind = 6
): Promise<PaymentDailyResponse> {
  return apiFetch(`/api/payments/daily?date_from=${dateFrom}&date_to=${dateTo}&kind=${kind}`);
}

export function fetchPaymentDailyByType(
  dateFrom: string, dateTo: string
): Promise<PaymentDailyByTypeResponse> {
  return apiFetch(`/api/payments/daily-by-type?date_from=${dateFrom}&date_to=${dateTo}`);
}

export function fetchPaymentByDoctor(
  dateFrom: string, dateTo: string, limit = 20
): Promise<PaymentDoctorResponse> {
  return apiFetch(`/api/payments/by-doctor?date_from=${dateFrom}&date_to=${dateTo}&limit=${limit}`);
}

export function fetchSalesStats(
  dateFrom: string, dateTo: string, limit = 30
): Promise<SalesStatsResponse> {
  return apiFetch(`/api/sales/stats?date_from=${dateFrom}&date_to=${dateTo}&limit=${limit}`);
}

// ─── Планы ───────────────────────────────────────────────────

export interface PlanDay {
  date:           string;
  weekday:        number;
  is_weekend:     boolean;
  calls_incoming: number;
  calls_outgoing: number;
  appt_count:     number;
}

export interface PlanMonthResponse {
  year:   number;
  month:  number;
  days:   PlanDay[];
  totals: { calls_incoming: number; calls_outgoing: number; appt_count: number };
  fixed:  { calls_missed_pct: number };
}

export interface PlanRangeResponse {
  date_from: string;
  date_to:   string;
  by_day:    Record<string, Record<string, number>>;
  totals:    { calls_incoming: number; calls_outgoing: number; appt_count: number };
  fixed:     { calls_missed_pct: number };
}

export interface PlanUpsertItem {
  date:   string;
  metric: string;
  value:  number;
}

export function fetchPlanMonth(year: number, month: number): Promise<PlanMonthResponse> {
  return apiFetch(`/api/plans/month?year=${year}&month=${month}`);
}

export function fetchPlanRange(dateFrom: string, dateTo: string): Promise<PlanRangeResponse> {
  return apiFetch(`/api/plans/range?date_from=${dateFrom}&date_to=${dateTo}`);
}

export async function upsertPlans(items: PlanUpsertItem[]) {
  const res = await fetch(`${API_URL}/api/plans/upsert`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("Ошибка сохранения планов");
  return res.json();
}

export async function fillPlans(
  dateFrom: string, dateTo: string,
  metric: string, value: number,
  skipWeekends = true,
) {
  const res = await fetch(`${API_URL}/api/plans/fill`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      date_from: dateFrom, date_to: dateTo,
      metric, value, skip_weekends: skipWeekends,
    }),
  });
  if (!res.ok) throw new Error("Ошибка заполнения планов");
  return res.json();
}
