import { authFetch } from "@/lib/auth";

// ─── Базовые типы ────────────────────────────────────────────────────

export type DeltaDir = "up" | "down" | "flat" | null;

export interface Delta {
  delta_pct: number | null;
  delta_dir: DeltaDir;
}

// ─── Утилиты ─────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(BASE + path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const res = await authFetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await authFetch(url.toString(), {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json();
}

export function toDateStr(d: Date): string {
  // Локальная дата, а не UTC: toISOString() у полуночи по Кемерово (UTC+7)
  // давал предыдущий день — периоды съезжали на день назад.
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function formatDuration(sec: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m > 0 ? `${m}м ${s}с` : `${s}с`;
}

export function formatMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)} тыс`;
  return String(n);
}

export function fmtRub(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
}

// ─── Авторизация ─────────────────────────────────────────────────────

export interface AuthUser {
  id:          string;
  name:        string;
  role:        string;
  permissions: string[];
}

export const fetchMe = () => get<AuthUser>("/api/auth/me");

// ─── Операторы / Администраторы ──────────────────────────────────────

export interface Operator { id: string; name: string; }
export interface Admin    { surname: string; group: string; label: string; }

export const fetchOperators = () => get<{ operators: Operator[] }>("/api/calls/operators");
export const fetchAdmins    = () => get<{ admins: Admin[] }>("/api/appointments/admins");

// ─── Звонки: статистика оператора ────────────────────────────────────

export interface OperatorStats {
  name:                string;
  incoming:            number;
  outgoing:            number;
  missed:              number;
  received:            number;
  missed_pct:          number;
  total:               number;
  avg_duration:        number;
  avg_wait_time:       number;
  missed_total:        number;
  callback_count:      number;
  callback_pct:        number;
  avg_reaction_sec:    number;
  outcome_reached:     number;
  outcome_self:        number;
  outcome_failed:      number;
  outcome_none:        number;
  lost:                number;
  lost_pct:            number;
  // Дельты
  incoming_delta_pct:        number | null;
  incoming_delta_dir:        DeltaDir;
  outgoing_delta_pct:        number | null;
  outgoing_delta_dir:        DeltaDir;
  missed_delta_pct:          number | null;
  missed_delta_dir:          DeltaDir;
  missed_pct_delta_pct:      number | null;
  missed_pct_delta_dir:      DeltaDir;
  lost_delta_pct:            number | null;
  lost_delta_dir:            DeltaDir;
  lost_pct_delta_pct:        number | null;
  lost_pct_delta_dir:        DeltaDir;
  avg_duration_delta_pct:    number | null;
  avg_duration_delta_dir:    DeltaDir;
  callback_count_delta_pct:  number | null;
  callback_count_delta_dir:  DeltaDir;
  callback_pct_delta_pct:    number | null;
  callback_pct_delta_dir:    DeltaDir;
  avg_reaction_sec_delta_pct: number | null;
  avg_reaction_sec_delta_dir: DeltaDir;
  total_delta_pct:           number | null;
  total_delta_dir:           DeltaDir;
  received_delta_pct:        number | null;
  received_delta_dir:        DeltaDir;
}

export interface StatsResponse {
  date_from:   string;
  date_to:     string;
  prev_from:   string;
  prev_to:     string;
  operators:   Record<string, OperatorStats>;
}

export const fetchStats = (dateFrom: string, dateTo: string, operatorId?: string) =>
  get<StatsResponse>("/api/calls/stats", { date_from: dateFrom, date_to: dateTo, operator_id: operatorId });

// ─── Звонки: по дням ─────────────────────────────────────────────────

export interface DailyItem {
  date:        string;
  incoming:    number;
  outgoing:    number;
  missed:      number;
  received:    number;
  missed_pct:  number;
  lost:        number;
  total:       number;
}

export interface DailyResponse {
  date_from: string;
  date_to:   string;
  days:      DailyItem[];
}

export const fetchDaily = (dateFrom: string, dateTo: string, operatorId?: string) =>
  get<DailyResponse>("/api/calls/daily", { date_from: dateFrom, date_to: dateTo, operator_id: operatorId });

// ─── Звонки: по слотам времени ────────────────────────────────────────

export interface SlotItem {
  time:     string;
  incoming: number;
  outgoing: number;
  missed:   number;
}

export interface HourlyResponse {
  date_from: string;
  date_to:   string;
  interval:  number;
  slots:     SlotItem[];
}

export const fetchHourly = (dateFrom: string, dateTo: string, interval: number, operatorId?: string) =>
  get<HourlyResponse>("/api/calls/hourly", { date_from: dateFrom, date_to: dateTo, interval, operator_id: operatorId });

// ─── Звонки: тепловая карта ───────────────────────────────────────────

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

export const fetchHeatmap = (dateFrom: string, dateTo: string, operatorId?: string) =>
  get<HeatmapResponse>("/api/calls/heatmap", { date_from: dateFrom, date_to: dateTo, operator_id: operatorId });

// ─── Звонки: сравнение операторов ────────────────────────────────────

export type ComparisonMetric = "total" | "incoming" | "outgoing" | "missed";

export interface ComparisonSeries {
  operator_id: string;
  name:        string;
  values:      { date: string; value: number }[];
}

export interface ComparisonResponse {
  metric:  string;
  dates:   string[];
  series:  ComparisonSeries[];
}

export const fetchComparison = (dateFrom: string, dateTo: string, metric: ComparisonMetric) =>
  get<ComparisonResponse>("/api/calls/comparison", { date_from: dateFrom, date_to: dateTo, metric });

// ─── Конверсия ───────────────────────────────────────────────────────

export interface ConversionOperator {
  operator_id:    string;
  name:           string;
  surname:        string;
  incoming:       number;
  appointments:   number;
  conversion_pct: number;
  /** сколько из записанных пациентов пришли (нет у старой версии сервера) */
  visits?:        number;
}

export interface ConversionDay {
  date:           string;
  incoming:       number;
  appointments:   number;
  conversion_pct: number;
}

/**
 * Конверсия операторов колл-центра. Записи — по дню СОЗДАНИЯ, пациент у оператора
 * в один день считается один раз. `days` — то же по дням (сервер до этой правки
 * его не отдавал, поэтому поле необязательное).
 */
export interface ConversionResponse {
  operators: ConversionOperator[];
  total: {
    incoming:       number;
    appointments:   number;
    conversion_pct: number;
    /** чем закончились записи этих пациентов; нет у старой версии сервера */
    visited?:       number;
    waiting?:       number;
    noshow?:        number;
    cancelled?:     number;
    /** пришли ÷ (пришли + не пришли + отменили), ждущих не считаем */
    visit_pct?:     number;
  };
  days?: ConversionDay[];
}

export const fetchConversion = (dateFrom: string, dateTo: string) =>
  get<ConversionResponse>("/api/calls/conversion", { date_from: dateFrom, date_to: dateTo });

// ─── Сбор данных ──────────────────────────────────────────────────────

export const collectCalls        = (dateFrom: string, dateTo: string) =>
  post("/api/calls/collect", undefined, { date_from: dateFrom, date_to: dateTo });
export const collectAppointments = (dateFrom: string, dateTo: string) =>
  post("/api/appointments/collect", undefined, { date_from: dateFrom, date_to: dateTo });

// ─── Записи: статистика ───────────────────────────────────────────────

export interface AdminAppointmentStats {
  name:            string;
  group:           string;
  group_label:     string;
  is_callcenter:   boolean;
  total:           number;
  visits:          number;
  noshow:          number;
  cancels:         number;
  pending:         number;
  new_patients:    number;
  callcenter_total: number;
  visit_pct:       number;
  noshow_pct:      number;
  new_pct:         number;
  cancel_pct:      number;
  total_delta_pct:       number | null;
  total_delta_dir:       DeltaDir;
  visits_delta_pct:      number | null;
  visits_delta_dir:      DeltaDir;
  noshow_delta_pct:      number | null;
  noshow_delta_dir:      DeltaDir;
  new_patients_delta_pct: number | null;
  new_patients_delta_dir: DeltaDir;
}

export interface GroupBreakdownItem {
  count: number;
  pct:   number;
  label: string;
}

export interface AppointmentStatsResponse {
  date_from: string;
  date_to:   string;
  total:     AdminAppointmentStats;
  by_group:  Record<string, GroupBreakdownItem>;
  by_admin:  Record<string, AdminAppointmentStats>;
}

export const fetchAppointmentStats = (dateFrom: string, dateTo: string, adminSurname?: string) =>
  get<AppointmentStatsResponse>("/api/appointments/stats", { date_from: dateFrom, date_to: dateTo, admin_surname: adminSurname });

// ─── Записи: по дням ──────────────────────────────────────────────────

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

export const fetchAppointmentDaily = (dateFrom: string, dateTo: string, adminSurname?: string) =>
  get<AppointmentDailyResponse>("/api/appointments/daily", { date_from: dateFrom, date_to: dateTo, admin_surname: adminSurname });

// ─── Платежи ──────────────────────────────────────────────────────────────

export interface PaymentStatsResponse {
  count:        number;
  total_paid:   number;
  by_cash:      number;
  by_card:      number;
  by_cashless:  number;
  by_credit:    number;
  by_balance:   number;
  count_delta_pct:      number | null;
  count_delta_dir:      DeltaDir;
  total_paid_delta_pct: number | null;
  total_paid_delta_dir: DeltaDir;
  by_cash_delta_pct:    number | null;
  by_cash_delta_dir:    DeltaDir;
  by_card_delta_pct:    number | null;
  by_card_delta_dir:    DeltaDir;
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
  days: PaymentDailyItem[];
}

export interface PaymentByTypeSeries {
  key:    string;
  label:  string;
  values: number[];
}

export interface PaymentByTypeResponse {
  days:   string[];
  series: PaymentByTypeSeries[];
}

export interface PaymentDoctor {
  doctor_id:      number;
  doctor_name:    string;
  doctor_surname: string;
  count:          number;
  total_paid:     number;
  pct:            number;
  /** средний чек = выручка / число оплат; изменение — к прошлому такому же периоду */
  avg_check?:           number;
  prev_avg_check?:      number;
  avg_check_delta_pct?: number | null;
  avg_check_delta_dir?: DeltaDir;
}

export interface PaymentDoctorResponse {
  doctors: PaymentDoctor[];
}

export const fetchPaymentStats    = (dateFrom: string, dateTo: string) =>
  get<PaymentStatsResponse>("/api/payments/stats", { date_from: dateFrom, date_to: dateTo, kind: 6 });
export const fetchPaymentDaily    = (dateFrom: string, dateTo: string) =>
  get<PaymentDailyResponse>("/api/payments/daily", { date_from: dateFrom, date_to: dateTo, kind: 6 });
export const fetchPaymentByType   = (dateFrom: string, dateTo: string) =>
  get<PaymentByTypeResponse>("/api/payments/daily-by-type", { date_from: dateFrom, date_to: dateTo });
export const fetchPaymentByDoctor = (dateFrom: string, dateTo: string, limit = 15) =>
  get<PaymentDoctorResponse>("/api/payments/by-doctor", { date_from: dateFrom, date_to: dateTo, kind: 6, limit });

// ─── Продажи по услугам ──────────────────────────────────────────────

export interface SaleService {
  service_title: string;
  service_id:    number | null;
  unit:          string;
  amount:        number;
  final_sum:     number;
  pct_of_total:  number;
  delta_pct:     number | null;
  delta_dir:     DeltaDir;
}

export interface SalesStatsResponse {
  total: { final_sum: number; delta_pct: number | null; delta_dir: DeltaDir };
  services: SaleService[];
}

export const fetchSalesStats = (dateFrom: string, dateTo: string, limit = 15) =>
  get<SalesStatsResponse>("/api/sales/stats", { date_from: dateFrom, date_to: dateTo, limit });

// ─── Планы ────────────────────────────────────────────────────────────────

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
  by_day:  Record<string, Record<string, number>>;
  totals:  { calls_incoming: number; calls_outgoing: number; appt_count: number };
  fixed:   { calls_missed_pct: number };
}

export const fetchPlanMonth = (year: number, month: number) =>
  get<PlanMonthResponse>("/api/plans/month", { year, month });
export const fetchPlanRange = (dateFrom: string, dateTo: string) =>
  get<PlanRangeResponse>("/api/plans/range", { date_from: dateFrom, date_to: dateTo });

export const savePlanItems = (items: { date: string; metric: string; value: number }[]) =>
  post("/api/plans/upsert", { items });
export const fillPlan = (body: { date_from: string; date_to: string; metric: string; value: number; skip_weekends: boolean }) =>
  post("/api/plans/fill", body);

// ─── Отчёты: помесячная сводка ───────────────────────────────────────

export interface CallsReportRow { period: string; incoming: number; outgoing: number; missed: number; total: number }
export interface ApptReportRow  { period: string; total: number; visits: number; noshow: number; cancels: number; new_patients: number; visit_pct: number }

export interface CallsReportResponse { granularity: string; rows: CallsReportRow[] }
export interface ApptReportResponse  { granularity: string; rows: ApptReportRow[] }

export type ReportGranularity = "day" | "week" | "month";

export const fetchCallsReport = (dateFrom: string, dateTo: string, granularity: ReportGranularity = "month") =>
  get<CallsReportResponse>("/api/reports/calls", { date_from: dateFrom, date_to: dateTo, granularity });
export const fetchApptReport = (dateFrom: string, dateTo: string, granularity: ReportGranularity = "month") =>
  get<ApptReportResponse>("/api/reports/appointments", { date_from: dateFrom, date_to: dateTo, granularity });

// ── Compatibility aliases ─────────────────────────────────────────────
// Старые компоненты используют эти имена

export type Me = AuthUser;

export const OPERATOR_COLORS = [
  { text: "#16a34a", bg: "#f0fdf4" },
  { text: "#2563eb", bg: "#eff6ff" },
  { text: "#d97706", bg: "#fffbeb" },
  { text: "#7c3aed", bg: "#f5f3ff" },
];

export const fetchPaymentDailyByType = fetchPaymentByType;
export type PaymentDailyByTypeResponse = PaymentByTypeResponse;

export const upsertPlans = savePlanItems;
export const fillPlans = (dateFrom: string, dateTo: string, metric: string, value: number, skipWeekends: boolean) =>
  fillPlan({ date_from: dateFrom, date_to: dateTo, metric, value, skip_weekends: skipWeekends });

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";


// ─── Выручка по направлениям ─────────────────────────────────────────

export interface CategoryRow {
  id: number | null;
  title: string;
  total: number;
  share: number;
  prev_total: number;
  delta_pct: number | null;
  delta_dir: DeltaDir;
  series: number[];
}

export interface ServiceTrendRow {
  title: string;
  category: string;
  total: number;
  share: number;
  delta_pct: number | null;
  delta_dir: DeltaDir;
  series: number[];
}

export interface SalesByCategoryResponse {
  granularity: "day" | "week" | "month";
  periods: string[];
  total: { sum: number; prev_sum: number; delta_pct: number | null; delta_dir: DeltaDir };
  categories: CategoryRow[];
  services: ServiceTrendRow[];
}

export const fetchSalesByCategory = (dateFrom: string, dateTo: string, servicesLimit = 15) =>
  get<SalesByCategoryResponse>("/api/sales/by-category", { date_from: dateFrom, date_to: dateTo, services_limit: servicesLimit });

// ─── Пациенты: неявки и повторные визиты ─────────────────────────────

export interface NoshowCounts {
  visits: number;
  noshow: number;
  cancels: number;
  appointments: number;
  noshow_pct: number;
  cancel_pct: number;
}

export interface NoshowsResponse {
  date_from: string;
  date_to: string;
  total: NoshowCounts & {
    pending: number;
    prev_noshow_pct: number;
    noshow_pct_delta_dir: DeltaDir;
    noshow_pct_delta_pct: number | null;
  };
  by_weekday: (NoshowCounts & { weekday: number; label: string })[];
  by_hour: (NoshowCounts & { hour: number })[];
  by_patient: { new: NoshowCounts; repeat: NoshowCounts };
  by_doctor: (NoshowCounts & { doctor_id: number; doctor_name: string })[];
  min_doctor_appts: number;
}

export interface ReturnsResponse {
  date_from: string;
  date_to: string;
  data_since: string | null;
  patients: number;
  new: number;
  returning: number;
  returning_pct: number;
  came_back: { days: number; count: number; eligible: number; pct: number }[];
  median_gap_days: number | null;
  gap_buckets: { label: string; count: number }[];
  monthly: { month: string; new: number; returning: number; reliable: boolean }[];
  by_doctor: {
    doctor_id: number; doctor_name: string; patients: number;
    came_back: number; same_doctor: number; came_back_pct: number; same_doctor_pct: number;
  }[];
  min_doctor_patients: number;
}

export const fetchNoshows = (dateFrom: string, dateTo: string) =>
  get<NoshowsResponse>("/api/patients/noshows", { date_from: dateFrom, date_to: dateTo });
export const fetchReturns = (dateFrom: string, dateTo: string) =>
  get<ReturnsResponse>("/api/patients/returns", { date_from: dateFrom, date_to: dateTo });
