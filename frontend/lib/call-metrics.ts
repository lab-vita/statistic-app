/**
 * Общие правила показа метрик звонков.
 *
 * Определения (считает сервер, backend/app/services/analytics/call_stats.py):
 *   Принятые   — отвеченные входящие (поле incoming)
 *   Пропущено  — входящие, на которые не ответили (поле missed)
 *   Поступило  — принятые + пропущенные (поле received)
 *   % пропущенных = пропущено ÷ поступило
 */
import type { DeltaDir } from "@/lib/api";

/** Проценты с одним знаком после запятой: 16,7% (целые без хвоста: 20%). */
export function formatPct(value: number): string {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
}

/** Время до перезвона: «< 1 мин», «39 мин», «1 ч 12 мин»; нет данных → «—». */
export function formatReaction(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60) return "< 1 мин";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** Относительное изменение, как на сервере (calc_delta): нет базы → null. */
export function relativeDelta(current: number, previous: number): { pct: number | null; dir: DeltaDir } {
  if (!previous) return { pct: null, dir: null };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

/** Конверсия приходит отдельным запросом (/api/calls/conversion), а не из /stats. */
export interface ConversionValue {
  value: number | null;
  deltaPct: number | null;
  deltaDir: string | null;
}

/**
 * Значение плитки «Конверсия → запись»: текущее число и изменение к прошлому периоду.
 * previous === null — прошлый период не удалось загрузить: показываем число без изменения.
 */
export function conversionValue(current: number, previous: number | null): ConversionValue {
  if (previous === null) return { value: current, deltaPct: null, deltaDir: null };
  const d = relativeDelta(current, previous);
  return { value: current, deltaPct: d.pct, deltaDir: d.dir };
}

/**
 * Хорошее ли это изменение. Для «плохих» метрик (пропущенные) рост — это плохо,
 * поэтому цвет переворачивается. null — изменения нет или нет данных.
 */
export function deltaIsGood(dir: string | null | undefined, invert = false): boolean | null {
  if (!dir || dir === "flat") return null;
  return invert ? dir === "down" : dir === "up";
}

/** Подпись, когда нечего показывать вместо дельты. */
export function noDeltaLabel(pct: number | null, dir: string | null | undefined): string {
  return pct === null || !dir ? "нет данных для сравнения" : "без изменений";
}
