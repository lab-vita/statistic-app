/**
 * Демо-данные для превью виджетов в каталоге: каталог рисует настоящие
 * виджеты на этих числах, поэтому превью всегда совпадает с тем, что
 * появится на главной. Числа условные, ни на что не влияют.
 */
import type { AdminAppointmentStats, DailyItem, DeltaDir, OperatorStats } from "@/lib/api";
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

function admin(name: string, group_label: string, total: number, visitPct: number, noshowPct: number, newP: number): AdminAppointmentStats {
  const visits = Math.round(total * visitPct / 100), noshow = Math.round(total * noshowPct / 100);
  return {
    name, group: "", group_label, is_callcenter: group_label === "Колл-центр",
    total, visits, noshow, cancels: 0, pending: total - visits - noshow, new_patients: newP, callcenter_total: 0,
    visit_pct: visitPct, noshow_pct: noshowPct, new_pct: Math.round(newP / total * 1000) / 10, cancel_pct: 0,
    total_delta_pct: null, total_delta_dir: null, visits_delta_pct: null, visits_delta_dir: null,
    noshow_delta_pct: null, noshow_delta_dir: null, new_patients_delta_pct: null, new_patients_delta_dir: null,
  };
}

export function sampleHomeData(): HomeData {
  const daily = days(0, 0);
  const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
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
      by_day: Object.fromEntries(daily.map(d => [d.date, { calls_incoming: 50, calls_outgoing: 22, appt_count: 26 }])),
      totals: { calls_incoming: 50 * daily.length, calls_outgoing: 22 * daily.length, appt_count: 26 * daily.length },
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
      days: daily.map((d, i) => {
        const incoming = Math.round(d.incoming * 0.75);
        const appointments = Math.round(incoming * (0.5 + Math.sin(i / 1.7) * 0.12));
        return { date: d.date, incoming, appointments, conversion_pct: incoming ? Math.round(appointments / incoming * 1000) / 10 : 0 };
      }),
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
      by_admin: {
        a1: admin("Иванова Анна",    "Колл-центр",     96, 76.0, 11.5, 31),
        a2: admin("Петрова Ольга",   "Колл-центр",     71, 73.2, 12.7, 24),
        a3: admin("Кузнецова Елена", "Администраторы", 58, 81.0, 6.9,  12),
        a4: admin("Смирнова Ирина",  "Администраторы", 41, 68.3, 17.1, 9),
        a5: admin("Сидорова Мария",  "Колл-центр",     46, 71.7, 13.0, 15),
      },
    },
    apptDaily: {
      date_from: "", date_to: "",
      days: daily.map((d, i) => {
        const total = Math.round(d.incoming * 0.55);
        const visits = Math.round(total * (0.7 + Math.sin(i) * 0.05));
        const noshow = Math.round(total * 0.13);
        return { date: d.date, total, visits, noshow, new_patients: Math.round(total * 0.3) };
      }),
    },
    heatmap: {
      date_from: "", date_to: "",
      cells: Array.from({ length: 7 }).flatMap((_, wd) => Array.from({ length: 13 }).map((__, j) => {
        const hour = 8 + j;
        const day = wd < 5 ? 1 : wd === 5 ? 0.45 : 0.15;
        const curve = Math.exp(-((hour - 11) ** 2) / 8) + 0.6 * Math.exp(-((hour - 16) ** 2) / 6);
        const total = Math.round(40 * day * curve);
        const missed = Math.round(total * (hour >= 10 && hour <= 12 ? 0.22 : 0.1));
        return { weekday: wd, weekday_name: "", hour, incoming: total - missed, outgoing: Math.round(total * 0.3), missed, total };
      })),
    },
    paymentDaily: {
      days: daily.map((d, i) => ({
        date: d.date, count: 40 + (i % 5) * 4,
        total_paid: Math.round((140000 + Math.sin(i / 1.6) * 38000 + i * 1500) / 100) * 100,
        by_cash: 0, by_card: 0, by_cashless: 0, by_credit: 0,
      })),
    },
    doctors: {
      doctors: [
        { doctor_id: 1, doctor_name: "Соколова Наталья Викторовна", doctor_surname: "Соколова", count: 112, total_paid: 412000, pct: 18.9 },
        { doctor_id: 2, doctor_name: "Морозов Андрей Петрович",     doctor_surname: "Морозов",  count: 96,  total_paid: 356500, pct: 16.3 },
        { doctor_id: 3, doctor_name: "Волкова Татьяна Сергеевна",   doctor_surname: "Волкова",  count: 88,  total_paid: 298000, pct: 13.6 },
        { doctor_id: 4, doctor_name: "Лебедев Игорь Олегович",      doctor_surname: "Лебедев",  count: 71,  total_paid: 241300, pct: 11.0 },
        { doctor_id: 5, doctor_name: "Новикова Юлия Андреевна",     doctor_surname: "Новикова", count: 64,  total_paid: 187900, pct: 8.6 },
        { doctor_id: 6, doctor_name: "Козлов Дмитрий Ильич",        doctor_surname: "Козлов",   count: 52,  total_paid: 152400, pct: 7.0 },
      ],
    },
    sales: {
      total: { final_sum: 2184500, delta_pct: 14, delta_dir: "up" },
      services: [
        { service_title: "Приём терапевта первичный",     service_id: 1, unit: "шт", amount: 214, final_sum: 385200, pct_of_total: 17.6, delta_pct: 6,  delta_dir: "up" },
        { service_title: "УЗИ брюшной полости",           service_id: 2, unit: "шт", amount: 98,  final_sum: 264600, pct_of_total: 12.1, delta_pct: 11, delta_dir: "up" },
        { service_title: "Общий анализ крови",            service_id: 3, unit: "шт", amount: 412, final_sum: 197800, pct_of_total: 9.1,  delta_pct: 3,  delta_dir: "down" },
        { service_title: "Приём кардиолога",              service_id: 4, unit: "шт", amount: 76,  final_sum: 182400, pct_of_total: 8.3,  delta_pct: 9,  delta_dir: "up" },
        { service_title: "ЭКГ с расшифровкой",            service_id: 5, unit: "шт", amount: 131, final_sum: 131000, pct_of_total: 6.0,  delta_pct: null, delta_dir: null },
        { service_title: "Приём невролога повторный",     service_id: 6, unit: "шт", amount: 64,  final_sum: 102400, pct_of_total: 4.7,  delta_pct: 2,  delta_dir: "up" },
      ],
    },
    reports: {
      from: "2026-04-01", to: "2026-09-30",
      calls: {
        granularity: "month",
        rows: months.map((period, i) => {
          const incoming = 1180 + i * 60 + (i % 2) * 90;
          const missed = 230 - i * 12;
          return { period, incoming, missed, outgoing: Math.round(incoming * 0.4), total: incoming + missed };
        }),
      },
      appts: {
        granularity: "month",
        rows: months.map((period, i) => {
          const total = 690 + i * 35 + (i % 2) * 40;
          const visits = Math.round(total * (0.72 + i * 0.01));
          return { period, total, visits, noshow: Math.round(total * 0.13), cancels: 20, new_patients: Math.round(total * 0.3), visit_pct: visits / total * 100 };
        }),
      },
    },
    payments: {
      count: 625, total_paid: 2184500, by_cash: 310000, by_card: 1500000, by_cashless: 300000, by_credit: 50000, by_balance: 24500,
      count_delta_pct: 8, count_delta_dir: "up", total_paid_delta_pct: 14, total_paid_delta_dir: "up",
      by_cash_delta_pct: null, by_cash_delta_dir: null, by_card_delta_pct: null, by_card_delta_dir: null,
    },
  };
}
