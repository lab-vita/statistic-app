/**
 * Демо-данные для превью виджетов в каталоге: каталог рисует настоящие
 * виджеты на этих числах, поэтому превью всегда совпадает с тем, что
 * появится на главной. Числа условные, ни на что не влияют.
 */
import type { DailyItem, DeltaDir, OperatorStats } from "@/lib/api";
import type { HomeData } from "@/lib/home-data";

function op(name: string, k: number): OperatorStats {
  const r = (v: number) => Math.round(v * k);
  const d = (pct: number, dir: DeltaDir) => ({ pct, dir });
  const inc = d(8, "up"), down = d(5, "down");
  return {
    name,
    incoming: r(625), outgoing: r(310), missed: r(137), received: r(762), missed_pct: 18,
    total: r(1072), avg_duration: 184, avg_wait_time: 14, missed_total: r(137),
    callback_count: r(88), callback_pct: 64, avg_reaction_sec: 1680,
    outcome_reached: r(68), outcome_self: r(19), outcome_failed: r(13), outcome_none: r(37),
    lost: r(49), lost_pct: 6.4,
    incoming_delta_pct: inc.pct, incoming_delta_dir: inc.dir,
    outgoing_delta_pct: 4, outgoing_delta_dir: "up",
    missed_delta_pct: down.pct, missed_delta_dir: down.dir,
    missed_pct_delta_pct: 3, missed_pct_delta_dir: "down",
    lost_delta_pct: 6, lost_delta_dir: "down",
    lost_pct_delta_pct: 4, lost_pct_delta_dir: "down",
    avg_duration_delta_pct: 2, avg_duration_delta_dir: "up",
    callback_count_delta_pct: 7, callback_count_delta_dir: "up",
    callback_pct_delta_pct: 3, callback_pct_delta_dir: "up",
    avg_reaction_sec_delta_pct: 12, avg_reaction_sec_delta_dir: "down",
    total_delta_pct: 6, total_delta_dir: "up",
    received_delta_pct: 5, received_delta_dir: "up",
  };
}

function days(offset: number, seed: number): DailyItem[] {
  const out: DailyItem[] = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(Date.UTC(2026, 8, 1 + i + offset)).toISOString().slice(0, 10);
    const wave = Math.sin((i + seed) / 2.2);
    const received = Math.round(56 + wave * 12 + i * 0.8);
    const missed = Math.round(9 + Math.cos(i + seed) * 3);
    out.push({
      date, received, missed, incoming: received - missed, outgoing: Math.round(received * 0.4),
      missed_pct: (missed / received) * 100, lost: Math.round(missed * 0.35), total: received + Math.round(received * 0.4),
    });
  }
  return out;
}

export function sampleHomeData(): HomeData {
  const daily = days(0, 0);
  return {
    dateFrom: daily[0].date,
    dateTo: daily[daily.length - 1].date,
    stats: {
      date_from: daily[0].date, date_to: daily[daily.length - 1].date, prev_from: "", prev_to: "",
      operators: {
        total: op("Всего", 1),
        "1": op("Иванова Анна", 0.38),
        "2": op("Петрова Ольга", 0.34),
        "3": op("Сидорова Мария", 0.28),
      },
    },
    daily: { date_from: "", date_to: "", days: daily },
    prevDaily: { date_from: "", date_to: "", days: days(-14, 3) },
    plan: {
      by_day: Object.fromEntries(daily.map(d => [d.date, { calls_incoming: 50, calls_outgoing: 22 }])),
      totals: { calls_incoming: 50 * daily.length, calls_outgoing: 22 * daily.length, appt_count: 0 },
      fixed: { calls_missed_pct: 6 },
    },
    conversion: { value: 56.8, deltaPct: 3, deltaDir: "up" },
    conversionData: {
      operators: [
        { operator_id: "1", name: "Иванова Анна",   surname: "Иванова",  incoming: 238, appointments: 143, conversion_pct: 60.1 },
        { operator_id: "2", name: "Петрова Ольга",  surname: "Петрова",  incoming: 213, appointments: 119, conversion_pct: 55.9 },
        { operator_id: "3", name: "Сидорова Мария", surname: "Сидорова", incoming: 174, appointments: 93,  conversion_pct: 53.4 },
      ],
      total: { incoming: 625, appointments: 355, conversion_pct: 56.8 },
    },
    appointments: {
      date_from: "", date_to: "",
      total: {
        name: "Всего", group: "", group_label: "", is_callcenter: false,
        total: 354, visits: 261, noshow: 47, cancels: 18, pending: 28, new_patients: 112, callcenter_total: 213,
        visit_pct: 73.7, noshow_pct: 13.3, new_pct: 31.6, cancel_pct: 5.1,
        total_delta_pct: 6, total_delta_dir: "up", visits_delta_pct: 4, visits_delta_dir: "up",
        noshow_delta_pct: 2, noshow_delta_dir: "down", new_patients_delta_pct: 9, new_patients_delta_dir: "up",
      },
      by_group: {
        callcenter: { count: 213, pct: 60, label: "Колл-центр" },
        admin:      { count: 99,  pct: 28, label: "Администраторы" },
        other:      { count: 42,  pct: 12, label: "Прочие" },
      },
      by_admin: {},
    },
    payments: {
      count: 625, total_paid: 2184500, by_cash: 310000, by_card: 1500000, by_cashless: 300000, by_credit: 50000, by_balance: 24500,
      count_delta_pct: 8, count_delta_dir: "up", total_paid_delta_pct: 14, total_paid_delta_dir: "up",
      by_cash_delta_pct: null, by_cash_delta_dir: null, by_card_delta_pct: null, by_card_delta_dir: null,
    },
  };
}
