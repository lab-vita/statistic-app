export type PeriodType = "day" | "week" | "month" | "quarter" | "year" | "custom";

export interface Period {
  type:     PeriodType;
  dateFrom: Date;
  dateTo:   Date;
}

function today(): Date {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

export function getDefaultPeriod(type: PeriodType): Period {
  const t = today();
  const yesterday = addDays(t, -1);
  switch (type) {
    case "day":
      return { type, dateFrom: yesterday, dateTo: yesterday };
    case "week": {
      const end   = addDays(t, -1);
      const start = addDays(end, -6);
      return { type, dateFrom: start, dateTo: end };
    }
    case "month": {
      const start = new Date(t.getFullYear(), t.getMonth(), 1);
      const end   = addDays(t, -1);
      return { type, dateFrom: start, dateTo: end };
    }
    case "quarter": {
      const qm    = Math.floor(t.getMonth() / 3) * 3;
      const start = new Date(t.getFullYear(), qm, 1);
      const end   = addDays(t, -1);
      return { type, dateFrom: start, dateTo: end };
    }
    case "year": {
      const start = new Date(t.getFullYear(), 0, 1);
      const end   = addDays(t, -1);
      return { type, dateFrom: start, dateTo: end };
    }
    default:
      return { type: "custom", dateFrom: addDays(t, -7), dateTo: yesterday };
  }
}

/**
 * Соседний период. Месяц, квартал и год листаются по календарю: из «октября
 * (1–14)» назад — весь сентябрь, а не 14 дней до 1 октября. Текущий период
 * заканчивается вчерашним днём, как в getDefaultPeriod.
 */
export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  if (p.type === "custom") return p;
  const yesterday = addDays(today(), -1);
  const clamp = (start: Date, end: Date): Period =>
    ({ ...p, dateFrom: start, dateTo: end > yesterday && start <= yesterday ? yesterday : end });

  const months = p.type === "month" ? 1 : p.type === "quarter" ? 3 : p.type === "year" ? 12 : 0;
  if (months) {
    const start = new Date(p.dateFrom.getFullYear(), p.dateFrom.getMonth() + dir * months, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + months, 0);
    return clamp(start, end);
  }
  const len = p.type === "week" ? 7 : p.type === "day" ? 1
    : Math.round((p.dateTo.getTime() - p.dateFrom.getTime()) / 86400000) + 1;
  const start = addDays(p.dateFrom, dir * len);
  return clamp(start, addDays(start, len - 1));
}

export function formatPeriodLabel(p: Period): string {
  const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const fmtY = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });

  if (p.type === "day") {
    return p.dateFrom.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }
  if (p.type === "month") {
    return p.dateFrom.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }
  const sameYear = p.dateFrom.getFullYear() === p.dateTo.getFullYear();
  return sameYear ? `${fmt(p.dateFrom)} — ${fmtY(p.dateTo)}` : `${fmtY(p.dateFrom)} — ${fmtY(p.dateTo)}`;
}

export function toDateStr(d: Date): string {
  // Локальная дата, а не UTC: toISOString() у полуночи по Кемерово (UTC+7)
  // давал предыдущий день — периоды съезжали на день назад.
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
