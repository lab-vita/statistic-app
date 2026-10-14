/**
 * Загрузка всех данных для виджетов главной одним вызовом.
 * Каждый запрос независим: если один не удался (например, нет права на раздел),
 * остальные виджеты всё равно работают.
 */
import type {
  AppointmentStatsResponse, ConversionResponse, DailyResponse,
  PaymentStatsResponse, PlanRangeResponse, StatsResponse,
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
  appointments:   AppointmentStatsResponse | null;
  payments:       PaymentStatsResponse | null;
}

export interface HomeApi {
  fetchStats:            (from: string, to: string) => Promise<StatsResponse>;
  fetchDaily:            (from: string, to: string) => Promise<DailyResponse>;
  fetchConversion:       (from: string, to: string) => Promise<ConversionResponse>;
  fetchPlanRange:        (from: string, to: string) => Promise<PlanRangeResponse>;
  fetchAppointmentStats?: (from: string, to: string) => Promise<AppointmentStatsResponse>;
  fetchPaymentStats?:     (from: string, to: string) => Promise<PaymentStatsResponse>;
}

/** Какие группы данных нужны виджетам на экране — лишнее не запрашиваем. */
export interface HomeNeeds {
  calls:        boolean;
  appointments: boolean;
  payments:     boolean;
}

const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);
const skip = <T,>(): Promise<T> => Promise.reject(new Error("не нужно"));

export const emptyHomeData = (dateFrom = "", dateTo = ""): HomeData => ({
  dateFrom, dateTo, stats: null, daily: null, prevDaily: null, plan: null,
  conversion: null, conversionData: null, appointments: null, payments: null,
});

export async function loadHomeData(
  dateFrom: string,
  dateTo: string,
  api: HomeApi,
  needs: HomeNeeds = { calls: true, appointments: true, payments: true },
): Promise<HomeData> {
  const [s, d, cv, pl, ap, pay] = await Promise.allSettled([
    needs.calls ? api.fetchStats(dateFrom, dateTo)      : skip<StatsResponse>(),
    needs.calls ? api.fetchDaily(dateFrom, dateTo)      : skip<DailyResponse>(),
    needs.calls ? api.fetchConversion(dateFrom, dateTo) : skip<ConversionResponse>(),
    needs.calls ? api.fetchPlanRange(dateFrom, dateTo)  : skip<PlanRangeResponse>(),
    needs.appointments && api.fetchAppointmentStats ? api.fetchAppointmentStats(dateFrom, dateTo) : skip<AppointmentStatsResponse>(),
    needs.payments && api.fetchPaymentStats         ? api.fetchPaymentStats(dateFrom, dateTo)     : skip<PaymentStatsResponse>(),
  ]);
  const stats = ok(s), daily = ok(d), conversionData = ok(cv), plan = ok(pl);

  // Прошлый период известен из ответа /stats: берём за него дни и конверсию
  let prevDaily: DailyResponse | null = null;
  let prevConversionPct: number | null = null;
  if (stats) {
    const [pd, pc] = await Promise.allSettled([
      api.fetchDaily(stats.prev_from, stats.prev_to),
      conversionData ? api.fetchConversion(stats.prev_from, stats.prev_to) : skip<ConversionResponse>(),
    ]);
    prevDaily = ok(pd);
    const prevConv = ok(pc);
    prevConversionPct = prevConv ? prevConv.total.conversion_pct : null;
  }

  return {
    dateFrom, dateTo, stats, daily, prevDaily, plan, conversionData,
    conversion: conversionData ? conversionValue(conversionData.total.conversion_pct, prevConversionPct) : null,
    appointments: ok(ap),
    payments:     ok(pay),
  };
}
