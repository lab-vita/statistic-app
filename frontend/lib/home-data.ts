/**
 * Загрузка всех данных для виджетов главной одним вызовом.
 * Каждый запрос независим: если один не удался, остальные виджеты всё равно работают.
 */
import type {
  ConversionResponse, DailyResponse, PlanRangeResponse, StatsResponse,
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
}

export interface HomeApi {
  fetchStats:      (from: string, to: string) => Promise<StatsResponse>;
  fetchDaily:      (from: string, to: string) => Promise<DailyResponse>;
  fetchConversion: (from: string, to: string) => Promise<ConversionResponse>;
  fetchPlanRange:  (from: string, to: string) => Promise<PlanRangeResponse>;
}

const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);

export const emptyHomeData = (dateFrom = "", dateTo = ""): HomeData => ({
  dateFrom, dateTo, stats: null, daily: null, prevDaily: null, plan: null, conversion: null, conversionData: null,
});

export async function loadHomeData(dateFrom: string, dateTo: string, api: HomeApi): Promise<HomeData> {
  const [s, d, cv, pl] = await Promise.allSettled([
    api.fetchStats(dateFrom, dateTo),
    api.fetchDaily(dateFrom, dateTo),
    api.fetchConversion(dateFrom, dateTo),
    api.fetchPlanRange(dateFrom, dateTo),
  ]);
  const stats = ok(s), daily = ok(d), conversionData = ok(cv), plan = ok(pl);

  // Прошлый период известен из ответа /stats: берём за него дни и конверсию
  let prevDaily: DailyResponse | null = null;
  let prevConversionPct: number | null = null;
  if (stats) {
    const [pd, pc] = await Promise.allSettled([
      api.fetchDaily(stats.prev_from, stats.prev_to),
      conversionData ? api.fetchConversion(stats.prev_from, stats.prev_to) : Promise.reject(new Error("нет конверсии")),
    ]);
    prevDaily = ok(pd);
    const prevConv = ok(pc);
    prevConversionPct = prevConv ? prevConv.total.conversion_pct : null;
  }

  return {
    dateFrom, dateTo, stats, daily, prevDaily, plan, conversionData,
    conversion: conversionData ? conversionValue(conversionData.total.conversion_pct, prevConversionPct) : null,
  };
}
