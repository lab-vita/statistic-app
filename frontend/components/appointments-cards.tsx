"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import {
  AdminAppointmentStats, GroupBreakdownItem,
  fetchPlanRange, PlanRangeResponse,
} from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CalendarCheck, CalendarX, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppointmentCardsProps {
  stats:    AdminAppointmentStats;
  byGroup:  Record<string, GroupBreakdownItem>;
  dateFrom: string;
  dateTo:   string;
}

const GROUP_ORDER  = ["callcenter", "admin", "other", "unknown"] as const;
const GROUP_COLORS: Record<string, { bar: string; text: string; pill: string }> = {
  callcenter: { bar: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400",    pill: "bg-blue-500/10 text-blue-600 dark:text-blue-400"    },
  admin:      { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", pill: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  other:      { bar: "bg-violet-500",  text: "text-violet-600 dark:text-violet-400", pill: "bg-violet-500/10 text-violet-600 dark:text-violet-400"  },
  unknown:    { bar: "bg-border",      text: "text-muted-foreground",               pill: "bg-muted text-muted-foreground"                        },
};

export function AppointmentCards({ stats: s, byGroup, dateFrom, dateTo }: AppointmentCardsProps) {
  const [plan, setPlan] = useState<PlanRangeResponse | null>(null);

  useEffect(() => {
    fetchPlanRange(dateFrom, dateTo).then(setPlan).catch(() => {});
  }, [dateFrom, dateTo]);

  const apptPlanTotal = plan?.totals.appt_count ?? 0;
  const apptPlanPct   = apptPlanTotal > 0 ? Math.round(s.total / apptPlanTotal * 100) : null;
  const hasGroups     = Object.keys(byGroup).length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Всего записей" value={s.total} sub="за период"
          icon={<CalendarCheck className="h-4 w-4" />}
          planValue={apptPlanTotal}
          planLabel={apptPlanTotal > 0 ? `план ${apptPlanTotal}` : undefined}
          planPct={apptPlanPct}
        />
        <StatCard
          title="Явки" value={s.visits} sub={`${s.visit_pct}% от записей`}
          accent="green" icon={<CalendarCheck className="h-4 w-4" />}
        />
        <StatCard
          title="Неявки" value={s.noshow} sub={`${s.noshow_pct}% от записей`}
          accent={s.noshow_pct > 10 ? "red" : "yellow"}
          icon={<CalendarX className="h-4 w-4" />}
        />
        <StatCard
          title="Новые пациенты" value={s.new_patients}
          sub={`${s.total > 0 ? Math.round(s.new_patients / s.total * 100) : 0}% от записей`}
          accent="purple" icon={<UserPlus className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Отмены" value={s.cancels} sub="отменено пациентами"
          icon={<CalendarX className="h-4 w-4" />}
        />
        <StatCard
          title="Ожидают" value={s.pending} sub="не подтверждены / одобрены"
          icon={<CalendarCheck className="h-4 w-4" />}
        />
      </div>

      {hasGroups && (
        <Card>
          <CardHeader className="border-b px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground/60" />
              <CardTitle className="text-sm font-semibold">Источники записей</CardTitle>
              <span className="ml-auto text-[11px] text-muted-foreground/60">всего {s.total}</span>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {GROUP_ORDER.map(group => {
              const item = byGroup[group];
              if (!item) return null;
              const c = GROUP_COLORS[group];
              return (
                <div key={group}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("text-[11px] font-semibold uppercase tracking-widest", c.text)}>
                      {item.label}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-[13px] font-semibold tabular-nums", c.text)}>{item.count}</span>
                      <span className="text-[11px] text-muted-foreground/60 tabular-nums w-8 text-right">{item.pct}%</span>
                    </div>
                  </div>
                  <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", c.bar)} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
