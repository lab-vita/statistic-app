"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import {
  AdminAppointmentStats, GroupBreakdownItem,
  fetchPlanRange, PlanRangeResponse,
} from "@/lib/api";
import { CalendarCheck, CalendarX, UserPlus, Phone, Users } from "lucide-react";

interface AppointmentCardsProps {
  stats:    AdminAppointmentStats;
  byGroup:  Record<string, GroupBreakdownItem>;
  dateFrom: string;
  dateTo:   string;
}

const GROUP_ORDER  = ["callcenter", "admin", "other", "unknown"] as const;
const GROUP_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  callcenter: { bar: "bg-blue-500",    text: "text-blue-500",    bg: "bg-blue-500/10"    },
  admin:      { bar: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10" },
  other:      { bar: "bg-purple-500",  text: "text-purple-500",  bg: "bg-purple-500/10"  },
  unknown:    { bar: "bg-muted",       text: "text-muted-foreground", bg: "bg-muted/30"  },
};

export function AppointmentCards({ stats: s, byGroup, dateFrom, dateTo }: AppointmentCardsProps) {
  const [plan, setPlan] = useState<PlanRangeResponse | null>(null);

  useEffect(() => {
    fetchPlanRange(dateFrom, dateTo).then(setPlan).catch(() => {});
  }, [dateFrom, dateTo]);

  const apptPlanTotal = plan?.totals.appt_count ?? 0;
  const apptPlanPct   = apptPlanTotal > 0 ? Math.round(s.total / apptPlanTotal * 100) : null;

  const hasGroups = Object.keys(byGroup).length > 0;

  return (
    <div className="space-y-3">
      {/* Основные карточки */}
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
          title="Отмены" value={s.cancels} sub="отменено пациентами"
          icon={<CalendarX className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Ожидают" value={s.pending} sub="не подтверждены / одобрены"
          icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Разбивка по источникам записей */}
      {hasGroups && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Источники записей</span>
            <span className="text-xs text-muted-foreground ml-auto">всего {s.total}</span>
          </div>

          <div className="space-y-3">
            {GROUP_ORDER.map(group => {
              const item = byGroup[group];
              if (!item) return null;
              const colors = GROUP_COLORS[group];
              return (
                <div key={group}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${colors.bg} ${colors.text}`}>
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold font-mono ${colors.text}`}>
                        {item.count}
                      </span>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {item.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${colors.bar}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
