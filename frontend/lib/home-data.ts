/**
 * Загрузка данных для виджетов главной одним вызовом.
 * Каждый виджет объявляет, какие данные ему нужны (`data` в WIDGET_TYPES),
 * и запрашивается только то, что стоит на экране. Запросы независимы:
 * если один не удался (например, нет права на раздел), остальные виджеты работают.
 */
import type {
  AppointmentDailyResponse, AppointmentStatsResponse, ApptReportResponse, CallsReportResponse,
  ConversionResponse, DailyResponse, HeatmapResponse, PaymentDailyResponse, PaymentDoctorResponse,
  PaymentStatsResponse, PlanRangeResponse, SalesStatsResponse, StatsResponse,
  NoshowsResponse, ReturnsResponse, SalesByCategoryResponse,
} from "@/lib/api";
import { conversionValue, type ConversionValue } from "@/lib/call-metrics";

export interface HomeData {
  dateFrom:       string;
  dateTo:         string;
  stats:          StatsResponse | null;
  daily:          DailyResponse | null;
  /** те же дни за предыдущий период — для линии «прошлый период» на графике */
  prevDaily:      DailyResponse | null;
  plan:           PlanRangeResponse | null;
  /** значение для плитки «Конверсия → запись» (с изменением к прошлому периоду) */
  conversion:     ConversionValue | null;
  /** конверсия по операторам — для таблицы качества */
  conversionData: ConversionResponse | null;
  heatmap:        HeatmapResponse | null;
  appointments:   AppointmentStatsResponse | null;
  apptDaily:      AppointmentDailyResponse | null;
  payments:       PaymentStatsResponse | null;
  paymentDaily:   PaymentDailyResponse | null;
  doctors:        PaymentDoctorResponse | null;
  sales:          SalesStatsResponse | null;
  /** неявки по дням недели и врачам */
  noshows:        NoshowsResponse | null;
  /** повторные визиты */
  returns:        ReturnsResponse | null;
  /** выручка по направлениям */
  categories:     SalesByCategoryResponse | null;
  /** помесячная сводка за последние полгода — не зависит от выбранного периода */
  reports:        { calls: CallsReportResponse | null; appts: ApptReportResponse | null; from: string; to: string } | null;
}

/** Группы данных, которые может запросить виджет. */
export type DataKey =
  | "stats" | "daily" | "prevDaily" | "conversion" | "plan" | "heatmap"
  | "appointments" | "apptDaily" | "payments" | "paymentDaily" | "doctors" | "sales" | "reports"
  | "noshows" | "returns" | "categories";

export type HomeNeeds = Partial<Record<DataKey, boolean>>;

export const ALL_NEEDS: HomeNeeds = {
  stats: true, daily: true, prevDaily: true, conversion: true, plan: true, heatmap: true,
  appointments: true, apptDaily: true, payments: true, paymentDaily: true, doctors: true, sales: true, reports: true,
  noshows: true, returns: true, categories: true,
};

/** Ключ для сравнения наборов: одинаковые потребности → тот же ключ. */
export const needsKey = (n: HomeNeeds) => (Object.keys(n) as DataKey[]).filter(k => n[k]).sort().join(",");

type Fn<T> = (from: string, to: string) => Promise<T>;

export interface HomeApi {
  fetchStats:             Fn<StatsResponse>;
  fetchDaily:             Fn<DailyResponse>;
  fetchConversion:        Fn<ConversionResponse>;
  fetchPlanRange:         Fn<PlanRangeResponse>;
  fetchHeatmap?:          Fn<HeatmapResponse>;
  fetchAppointmentStats?: Fn<AppointmentStatsResponse>;
  fetchAppointmentDaily?: Fn<AppointmentDailyResponse>;
  fetchPaymentStats?:     Fn<PaymentStatsResponse>;
  fetchPaymentDaily?:     Fn<PaymentDailyResponse>;
  fetchPaymentByDoctor?:  Fn<PaymentDoctorResponse>;
  fetchSalesStats?:       Fn<SalesStatsResponse>;
  fetchCallsReport?:      Fn<CallsReportResponse>;
  fetchApptReport?:       Fn<ApptReportResponse>;
  fetchNoshows?:          Fn<NoshowsResponse>;
  fetchReturns?:          Fn<ReturnsResponse>;
  fetchSalesByCategory?:  Fn<SalesByCategoryResponse>;
}

const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);
const skip = <T,>(): Promise<T> => Promise.reject(new Error("не нужно"));
const maybe = <T,>(need: boolean | undefined, fn: Fn<T> | undefined, from: string, to: string): Promise<T> =>
  need && fn ? fn(from, to) : skip<T>();

export const emptyHomeData = (dateFrom = "", dateTo = ""): HomeData => ({
  dateFrom, dateTo, stats: null, daily: null, prevDaily: null, plan: null,
  conversion: null, conversionData: null, heatmap: null,
  appointments: null, apptDaily: null, payments: null, paymentDaily: null,
  doctors: null, sales: null, reports: null, noshows: null, returns: null, categories: null,
});

/** Последние шесть месяцев, включая текущий, по вчерашний день. */
export function reportsRange(today: Date = new Date()): { from: string; to: string } {
  const y = new Date(today); y.setDate(y.getDate() - 1);
  const from = new Date(y.getFullYear(), y.getMonth() - 5, 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(y) };
}

export async function loadHomeData(
  dateFrom: string,
  dateTo: string,
  api: HomeApi,
  needs: HomeNeeds = ALL_NEEDS,
): Promise<HomeData> {
  // /stats нужен и сам по себе, и чтобы узнать границы прошлого периода
  const needStats = needs.stats || needs.prevDaily || needs.conversion;
  const rr = reportsRange();

  const [s, d, cv, pl, hm, ap, apd, pay, payd, doc, sal, rc, ra, ns, rt, cat] = await Promise.allSettled([
    maybe(needStats,          api.fetchStats,            dateFrom, dateTo),
    maybe(needs.daily,        api.fetchDaily,            dateFrom, dateTo),
    maybe(needs.conversion,   api.fetchConversion,       dateFrom, dateTo),
    maybe(needs.plan,         api.fetchPlanRange,        dateFrom, dateTo),
    maybe(needs.heatmap,      api.fetchHeatmap,          dateFrom, dateTo),
    maybe(needs.appointments, api.fetchAppointmentStats, dateFrom, dateTo),
    maybe(needs.apptDaily,    api.fetchAppointmentDaily, dateFrom, dateTo),
    maybe(needs.payments,     api.fetchPaymentStats,     dateFrom, dateTo),
    maybe(needs.paymentDaily, api.fetchPaymentDaily,     dateFrom, dateTo),
    maybe(needs.doctors,      api.fetchPaymentByDoctor,  dateFrom, dateTo),
    maybe(needs.sales,        api.fetchSalesStats,       dateFrom, dateTo),
    maybe(needs.reports,      api.fetchCallsReport,      rr.from, rr.to),
    maybe(needs.reports,      api.fetchApptReport,       rr.from, rr.to),
    maybe(needs.noshows,      api.fetchNoshows,          dateFrom, dateTo),
    maybe(needs.returns,      api.fetchReturns,          dateFrom, dateTo),
    maybe(needs.categories,   api.fetchSalesByCategory,  dateFrom, dateTo),
  ]);
  const stats = ok(s), conversionData = ok(cv);

  // Прошлый период известен из ответа /stats: берём за него дни и конверсию
  let prevDaily: DailyResponse | null = null;
  let prevConversionPct: number | null = null;
  if (stats && (needs.prevDaily || conversionData)) {
    const [pd, pc] = await Promise.allSettled([
      maybe(needs.prevDaily, api.fetchDaily, stats.prev_from, stats.prev_to),
      conversionData ? api.fetchConversion(stats.prev_from, stats.prev_to) : skip<ConversionResponse>(),
    ]);
    prevDaily = ok(pd);
    const prevConv = ok(pc);
    prevConversionPct = prevConv ? prevConv.total.conversion_pct : null;
  }

  const reportsCalls = ok(rc), reportsAppts = ok(ra);

  return {
    dateFrom, dateTo, stats, daily: ok(d), prevDaily, plan: ok(pl), conversionData,
    conversion: conversionData ? conversionValue(conversionData.total.conversion_pct, prevConversionPct) : null,
    heatmap:      ok(hm),
    appointments: ok(ap),
    apptDaily:    ok(apd),
    payments:     ok(pay),
    paymentDaily: ok(payd),
    doctors:      ok(doc),
    sales:        ok(sal),
    noshows:      ok(ns),
    returns:      ok(rt),
    categories:   ok(cat),
    reports:      needs.reports ? { calls: reportsCalls, appts: reportsAppts, ...rr } : null,
  };
}
