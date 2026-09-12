"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchStats, fetchHourly, fetchDaily, fetchAppointmentStats, fetchAppointmentDaily,
  toDateStr, addDays, formatDuration,
  StatsResponse, HourlyResponse, DailyResponse,
  AppointmentStatsResponse, AppointmentDailyResponse,
} from "@/lib/api";
import { Section } from "@/components/sidebar";
import {
  Phone, PhoneIncoming, PhoneMissed, Clock,
  CalendarCheck, CalendarX, UserPlus, ArrowRight, TrendingUp,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

type PeriodType = "day" | "week" | "month";

interface HomeDashboardProps {
  onNavigate: (s: Section) => void;
}

const MONTH_NAMES = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

function getPeriodRange(type: PeriodType, offset: number): { from: string; to: string; label: string } {
  const now = new Date();

  if (type === "day") {
    const d = addDays(now, offset);
    return {
      from:  toDateStr(d),
      to:    toDateStr(d),
      label: d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
    };
  }

  if (type === "week") {
    // Понедельник текущей недели + offset недель
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday    = addDays(now, -dayOfWeek + offset * 7);
    const sunday    = addDays(monday, 6);
    return {
      from:  toDateStr(monday),
      to:    toDateStr(sunday),
      label: `${monday.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} — ${sunday.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}`,
    };
  }

  // month
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from:  toDateStr(d),
    to:    toDateStr(lastDay),
    label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
  };
}

export function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("day");
  const [offset, setOffset]         = useState(0);

  const { from: dateFrom, to: dateTo, label: dateLabel } = getPeriodRange(periodType, offset);
  const isToday = periodType === "day" && offset === 0;

  const [calls, setCalls]     = useState<StatsResponse | null>(null);
  const [hourly, setHourly]   = useState<HourlyResponse | null>(null);
  const [daily, setDaily]     = useState<DailyResponse | null>(null);
  const [appts, setAppts]     = useState<AppointmentStatsResponse | null>(null);
  const [apptDaily, setApptDaily] = useState<AppointmentDailyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setCalls(null); setHourly(null); setDaily(null);
    setAppts(null); setApptDaily(null);

    const promises: Promise<any>[] = [
      fetchStats(dateFrom, dateTo),
      fetchAppointmentStats(dateFrom, dateTo),
    ];

    if (periodType === "day") {
      promises.push(fetchHourly(dateFrom, dateTo, 60));
    } else {
      promises.push(fetchDaily(dateFrom, dateTo));
      promises.push(fetchAppointmentDaily(dateFrom, dateTo));
    }

    const results = await Promise.allSettled(promises);
    if (results[0].status === "fulfilled") setCalls(results[0].value);
    if (results[1].status === "fulfilled") setAppts(results[1].value);
    if (periodType === "day") {
      if (results[2].status === "fulfilled") setHourly(results[2].value);
    } else {
      if (results[2].status === "fulfilled") setDaily(results[2].value);
      if (results[3]?.status === "fulfilled") setApptDaily(results[3].value);
    }

    setLoading(false);
  }, [dateFrom, dateTo, periodType]);

  useEffect(() => { load(); }, [load]);

  // При смене типа периода сбрасываем offset
  function handlePeriodType(t: PeriodType) {
    setPeriodType(t);
    setOffset(0);
  }

  const callTotal = calls?.operators["total"];
  const apptTotal = appts?.total;
  const missedPct = callTotal && callTotal.incoming > 0
    ? Math.round(callTotal.missed / callTotal.incoming * 100) : 0;

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse rounded-xl bg-muted/40 border border-border ${className}`} />
  );

  const formatDateTick = (d: string) =>
    new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  const tickInterval = (daily?.days.length ?? 0) > 20 ? 3 : 0;

  return (
    <div className="space-y-5">

      {/* Шапка с переключателем периода */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">
            {isToday ? "Сводка за сегодня" : "Сводка"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Тип периода */}
          <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {(["day","week","month"] as PeriodType[]).map(t => (
              <button key={t} onClick={() => handlePeriodType(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  periodType === t
                    ? "bg-background border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {t === "day" ? "День" : t === "week" ? "Неделя" : "Месяц"}
              </button>
            ))}
          </div>

          {/* Навигация */}
          <div className="flex items-center gap-1">
            <button onClick={() => setOffset(o => o - 1)}
              className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/40 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setOffset(o => o + 1)}
              disabled={offset >= 0}
              className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/40 transition-colors disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Блоки Звонки + Записи */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Звонки */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Звонки</span>
            </div>
            <button onClick={() => onNavigate("calls")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Детали <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : callTotal ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <PhoneIncoming className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Входящие</span>
                </div>
                <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{callTotal.incoming}</div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <PhoneMissed className="h-3 w-3 text-red-500" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Пропущенные</span>
                </div>
                <div className="text-xl font-semibold text-red-500">{callTotal.missed}</div>
                <div className="text-[10px] text-muted-foreground">{missedPct}% от входящих</div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3 w-3 text-blue-500" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Ср. разговор</span>
                </div>
                <div className="text-xl font-semibold">{formatDuration(callTotal.avg_duration)}</div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Phone className="h-3 w-3 text-amber-500" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Перезвонили</span>
                </div>
                <div className="text-xl font-semibold">
                  {callTotal.callback_count}
                  <span className="text-sm text-muted-foreground font-normal"> / {callTotal.missed_total}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{callTotal.callback_pct}% пропущенных</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">Нет данных за период</p>
          )}
        </div>

        {/* Записи */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Записи</span>
            </div>
            <button onClick={() => onNavigate("appointments")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Детали <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : apptTotal ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <CalendarCheck className="h-3 w-3 text-blue-500" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Всего записей</span>
                </div>
                <div className="text-xl font-semibold text-blue-500">{apptTotal.total}</div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Явки</span>
                </div>
                <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{apptTotal.visits}</div>
                <div className="text-[10px] text-muted-foreground">{apptTotal.visit_pct}% от записей</div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <CalendarX className="h-3 w-3 text-red-500" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Неявки</span>
                </div>
                <div className="text-xl font-semibold text-red-500">{apptTotal.noshow}</div>
                <div className="text-[10px] text-muted-foreground">{apptTotal.noshow_pct}% от записей</div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <UserPlus className="h-3 w-3 text-purple-500" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Новые пациенты</span>
                </div>
                <div className="text-xl font-semibold text-purple-500">{apptTotal.new_patients}</div>
                <div className="text-[10px] text-muted-foreground">
                  {apptTotal.total > 0 ? Math.round(apptTotal.new_patients / apptTotal.total * 100) : 0}% от записей
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">Нет данных за период</p>
          )}
        </div>
      </div>

      {/* График — по часам (день) или по дням (неделя/месяц) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">
            {periodType === "day" ? "Нагрузка по часам" : "Динамика по дням"}
          </span>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm inline-block bg-emerald-500 opacity-80" />Входящие
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm inline-block bg-blue-500 opacity-80" />Исходящие
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm inline-block bg-red-500 opacity-80" />Пропущенные
            </span>
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-40" />
        ) : periodType === "day" && hourly && hourly.slots.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hourly.slots} barCategoryGap="30%" barGap={2}>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} tickFormatter={v => v.slice(0, 5)} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} width={24} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }} />
              <Bar dataKey="incoming" fill="#22c55e" opacity={0.85} radius={[2,2,0,0]} name="Входящие" />
              <Bar dataKey="outgoing" fill="#3b82f6" opacity={0.85} radius={[2,2,0,0]} name="Исходящие" />
              <Bar dataKey="missed"   fill="#ef4444" opacity={0.85} radius={[2,2,0,0]} name="Пропущенные" />
            </BarChart>
          </ResponsiveContainer>
        ) : daily && daily.days.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={daily.days}>
              <XAxis dataKey="date" tickFormatter={formatDateTick}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                labelFormatter={formatDateTick} />
              <Line type="monotone" dataKey="incoming" stroke="#22c55e" strokeWidth={2}
                dot={false} name="Входящие" />
              <Line type="monotone" dataKey="outgoing" stroke="#3b82f6" strokeWidth={2}
                dot={false} name="Исходящие" />
              <Line type="monotone" dataKey="missed" stroke="#ef4444" strokeWidth={2}
                dot={false} name="Пропущенные" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground py-10 text-center">Нет данных за период</p>
        )}
      </div>
    </div>
  );
}
