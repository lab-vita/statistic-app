"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { AdminAppointmentStats, fetchPlanRange, PlanRangeResponse } from "@/lib/api";
import { CalendarCheck, CalendarX, UserPlus, Phone } from "lucide-react";

interface AppointmentCardsProps {
  stats:    AdminAppointmentStats;
  dateFrom: string;
  dateTo:   string;
}

export function AppointmentCards({ stats: s, dateFrom, dateTo }: AppointmentCardsProps) {
  const [plan, setPlan] = useState<PlanRangeResponse | null>(null);

  useEffect(() => {
    fetchPlanRange(dateFrom, dateTo).then(setPlan).catch(() => {});
  }, [dateFrom, dateTo]);

  // Считаем кол-во рабочих дней в периоде для среднего
  const spanDays = Math.max(
    1,
    Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1
  );

  // Суммарный план записей за период = план_в_день * кол-во_дней_с_планом
  const apptPlanTotal = plan?.totals.appt_count ?? 0;
  const apptPlanPct   = apptPlanTotal > 0 ? Math.round(s.total / apptPlanTotal * 100) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Всего записей" value={s.total} sub="за период"
          icon={<CalendarCheck className="h-4 w-4 text-blue-500" />}
          planValue={apptPlanTotal}
          planLabel={apptPlanTotal > 0 ? `план ${apptPlanTotal}` : undefined}
          planPct={apptPlanPct}
        />
        <StatCard
          title="Явки" value={s.visits} sub={`${s.visit_pct}% от записей`}
          accent="green" icon={<CalendarCheck className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          title="Неявки" value={s.noshow} sub={`${s.noshow_pct}% от записей`}
          accent={s.noshow_pct > 10 ? "red" : "yellow"}
          icon={<CalendarX className="h-4 w-4 text-red-500" />}
        />
        <StatCard
          title="Новые пациенты" value={s.new_patients}
          sub={`${s.total > 0 ? Math.round(s.new_patients / s.total * 100) : 0}% от записей`}
          accent="purple" icon={<UserPlus className="h-4 w-4 text-purple-500" />}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Колл-центр" value={s.callcenter_total}
          sub={`${s.total > 0 ? Math.round(s.callcenter_total / s.total * 100) : 0}% всех записей`}
          accent="blue" icon={<Phone className="h-4 w-4 text-blue-500" />}
        />
        <StatCard
          title="Отмены" value={s.cancels} sub="отменено пациентами"
          icon={<CalendarX className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Ожидают" value={s.pending} sub="не подтверждены / одобрены"
          icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />}
        />
      </div>
    </div>
  );
}
