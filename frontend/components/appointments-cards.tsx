import { StatCard } from "@/components/stat-card";
import { AdminAppointmentStats } from "@/lib/api";
import { CalendarCheck, CalendarX, UserPlus, Phone } from "lucide-react";

interface AppointmentCardsProps {
  stats: AdminAppointmentStats;
}

export function AppointmentCards({ stats: s }: AppointmentCardsProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Всего записей"
          value={s.total}
          sub="за период"
          icon={<CalendarCheck className="h-4 w-4 text-blue-500" />}
        />
        <StatCard
          title="Явки"
          value={s.visits}
          sub={`${s.visit_pct}% от записей`}
          accent="green"
          icon={<CalendarCheck className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          title="Неявки"
          value={s.noshow}
          sub={`${s.noshow_pct}% от записей`}
          accent={s.noshow_pct > 10 ? "red" : "yellow"}
          icon={<CalendarX className="h-4 w-4 text-red-500" />}
        />
        <StatCard
          title="Новые пациенты"
          value={s.new_patients}
          sub={`${s.total > 0 ? Math.round(s.new_patients / s.total * 100) : 0}% от записей`}
          accent="purple"
          icon={<UserPlus className="h-4 w-4 text-purple-500" />}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Колл-центр"
          value={s.callcenter_total}
          sub={`${s.total > 0 ? Math.round(s.callcenter_total / s.total * 100) : 0}% всех записей`}
          accent="blue"
          icon={<Phone className="h-4 w-4 text-blue-500" />}
        />
        <StatCard
          title="Отмены"
          value={s.cancels}
          sub="отменено пациентами"
          icon={<CalendarX className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Ожидают"
          value={s.pending}
          sub="не подтверждены / одобрены"
          icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />}
        />
      </div>
    </div>
  );
}