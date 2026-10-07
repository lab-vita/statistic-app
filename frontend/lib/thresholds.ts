/**
 * Пороги «светофора» для качества работы операторов.
 * Меньше — лучше для всех показателей. Значение не больше good — «в норме»,
 * не больше warn — «внимание», выше — «плохо».
 *
 * Значения согласованы с владельцем; позже их можно вынести в настройки админ-панели.
 */
export type Status = "good" | "warn" | "bad";

interface Limits { good: number; warn: number }

export const THRESHOLDS = {
  /** доля пропущенных среди поступивших, % */
  missed_pct:   { good: 6,  warn: 10 },
  /** доля потерянных клиентов среди поступивших, % */
  lost_pct:     { good: 3,  warn: 5  },
  /** среднее время до первой попытки перезвонить, минут */
  reaction_min: { good: 30, warn: 60 },
} as const satisfies Record<string, Limits>;

function lessIsBetter(value: number, t: Limits): Status {
  return value <= t.good ? "good" : value <= t.warn ? "warn" : "bad";
}

export const missedStatus = (pct: number): Status => lessIsBetter(pct, THRESHOLDS.missed_pct);
export const lostStatus   = (pct: number): Status => lessIsBetter(pct, THRESHOLDS.lost_pct);

/** Время до перезвона в секундах; нет данных (0 или пусто) → null, светофор не показываем. */
export function reactionStatus(seconds: number | null | undefined): Status | null {
  if (!seconds || seconds <= 0) return null;
  return lessIsBetter(seconds / 60, THRESHOLDS.reaction_min);
}

export const STATUS_DOT: Record<Status, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  bad:  "bg-rose-400",
};

export const STATUS_LABEL: Record<Status, string> = {
  good: "в норме",
  warn: "внимание",
  bad:  "плохо",
};
