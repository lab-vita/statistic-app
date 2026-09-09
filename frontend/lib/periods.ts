import { toDateStr, addDays } from "./api";

export type PeriodType = "day" | "week" | "month" | "quarter" | "year" | "custom";

export interface Period {
  type: PeriodType;
  dateFrom: Date;
  dateTo: Date;
}

const yesterday = (): Date => addDays(new Date(), -1);

export function getDefaultPeriod(type: PeriodType): Period {
  const today = new Date();
  const yest  = yesterday();

  switch (type) {
    case "day":
      return { type, dateFrom: yest, dateTo: yest };

    case "week": {
      const dow = yest.getDay();
      const mon = addDays(yest, -(dow === 0 ? 6 : dow - 1));
      return { type, dateFrom: mon, dateTo: yest };
    }

    case "month":
      return {
        type,
        dateFrom: new Date(today.getFullYear(), today.getMonth(), 1),
        dateTo:   yest,
      };

    case "quarter": {
      const q     = Math.floor(today.getMonth() / 3);
      const qStart = new Date(today.getFullYear(), q * 3, 1);
      return { type, dateFrom: qStart, dateTo: yest };
    }

    case "year":
      return {
        type,
        dateFrom: new Date(today.getFullYear(), 0, 1),
        dateTo:   yest,
      };

    case "custom":
      return { type, dateFrom: addDays(yest, -6), dateTo: yest };
  }
}

export function shiftPeriod(period: Period, direction: -1 | 1): Period {
  const { type, dateFrom, dateTo } = period;

  switch (type) {
    case "day": {
      const d = addDays(dateFrom, direction);
      return { type, dateFrom: d, dateTo: d };
    }
    case "week": {
      const d = addDays(dateFrom, direction * 7);
      return { type, dateFrom: d, dateTo: addDays(d, 6) };
    }
    case "month": {
      const d = new Date(dateFrom.getFullYear(), dateFrom.getMonth() + direction, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { type, dateFrom: d, dateTo: end };
    }
    case "quarter": {
      const d = new Date(dateFrom.getFullYear(), dateFrom.getMonth() + direction * 3, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 3, 0);
      return { type, dateFrom: d, dateTo: end };
    }
    case "year": {
      const d = new Date(dateFrom.getFullYear() + direction, 0, 1);
      const end = new Date(d.getFullYear(), 11, 31);
      return { type, dateFrom: d, dateTo: end };
    }
    case "custom":
      return period;
  }
}

export function formatPeriodLabel(period: Period): string {
  const { type, dateFrom, dateTo } = period;
  const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  const fmtShort = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  switch (type) {
    case "day":
      return dateFrom.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    case "week":
      return `${fmtShort(dateFrom)} — ${fmt(dateTo)}`;
    case "month":
      return dateFrom.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    case "quarter": {
      const q = Math.floor(dateFrom.getMonth() / 3) + 1;
      return `Q${q} ${dateFrom.getFullYear()}`;
    }
    case "year":
      return `${dateFrom.getFullYear()}`;
    case "custom":
      return `${fmtShort(dateFrom)} — ${fmt(dateTo)}`;
  }
}