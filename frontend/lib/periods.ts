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

export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  if (p.type === "custom") return p;
  const len = Math.round((p.dateTo.getTime() - p.dateFrom.getTime()) / 86400000) + 1;
  const step = dir * len;
  return { ...p, dateFrom: addDays(p.dateFrom, step), dateTo: addDays(p.dateTo, step) };
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
  return d.toISOString().slice(0, 10);
}
