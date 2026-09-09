"use client";

import { useEffect, useState } from "react";
import {
  fetchStats, fetchHourly, fetchSuspicious, fetchAppointmentStats,
  toDateStr, formatDuration,
  StatsResponse, HourlyResponse, AppointmentStatsResponse, SuspiciousResponse,
} from "@/lib/api";
import { Section } from "@/components/sidebar";
import {
  Phone, PhoneIncoming, PhoneMissed, Clock,
  CalendarCheck, CalendarX, UserPlus, AlertTriangle,
  ArrowRight, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface HomeDashboardProps {
  onNavigate: (s: Section) => void;
}

export function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const today = toDateStr(new Date());

  const [calls, setCalls]         = useState<StatsResponse | null>(null);
  const [hourly, setHourly]       = useState<HourlyResponse | null>(null);
  const [appts, setAppts]         = useState<AppointmentStatsResponse | null>(null);
  const [suspicious, setSuspicious] = useState<SuspiciousResponse | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchStats(today, today),
      fetchHourly(today, today, 60),
      fetchAppointmentStats(today, today),
      fetchSuspicious(today, today),
    ]).then(([c, h, a, s]) => {
      if (c.status === "fulfilled") setCalls(c.value);
      if (h.status === "fulfilled") setHourly(h.value);
      if (a.status === "fulfilled") setAppts(a.value);
      if (s.status === "fulfilled") setSuspicious(s.value);
    }).finally(() => setLoading(false));
  }, [today]);

  const callTotal = calls?.operators["total"];
  const apptTotal = appts?.total;
  const suspCount = suspicious?.items.length ?? 0;
  const missedPct = callTotal && callTotal.incoming > 0
    ? Math.round(callTotal.missed / callTotal.incoming * 100)
    : 0;
  const noCallbackCount = callTotal
    ? callTotal.missed_total - callTotal.callback_count
    : 0;

  const dateLabel = new Date().toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse rounded-xl bg-muted/40 border border-border ${className}`} />
  );

  return (
    <div className="space-y-5">
      {/* Заголовок */}
      <div>
        <h1 className="text-base font-semibold">Сводка за сегодня</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
      </div>

      {/* Алерты */}
      {!loading && (noCallbackCount > 0 || suspCount > 0) && (
        <div className="space-y-2">
          {noCallbackCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5">
              <PhoneMissed className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-xs text-amber-700 dark:text-amber-400 flex-1">
                <span className="font-medium">{noCallbackCount}</span> пропущенных звонков без перезвона сегодня
              </span>
              <button
                onClick={() => onNavigate("calls")}
                className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                Подробнее <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
          {suspCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-400 flex-1">
                <span className="font-medium">{suspCount}</span> подозрительных {suspCount === 1 ? "запись" : suspCount < 5 ? "записи" : "записей"} в антифроде
              </span>
              <button
                onClick={() => onNavigate("appointments")}
                className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Подробнее <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Две колонки: Звонки и Записи */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Блок Звонки ── */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Звонки</span>
            </div>
            <button
              onClick={() => onNavigate("calls")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
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
            <p className="text-xs text-muted-foreground py-4 text-center">Нет данных за сегодня</p>
          )}
        </div>

        {/* ── Блок Записи ── */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Записи</span>
            </div>
            <button
              onClick={() => onNavigate("appointments")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
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
            <p className="text-xs text-muted-foreground py-4 text-center">Нет данных за сегодня</p>
          )}
        </div>
      </div>

      {/* График нагрузки по часам */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">Нагрузка по часам</span>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block bg-emerald-500 opacity-80" />Входящие</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block bg-blue-500 opacity-80" />Исходящие</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block bg-red-500 opacity-80" />Пропущенные</span>
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-40" />
        ) : hourly && hourly.slots.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hourly.slots} barCategoryGap="30%" barGap={2}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v.slice(0, 5)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={24}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                }}
                labelFormatter={v => v}
              />
              <Bar dataKey="incoming"  fill="#22c55e" opacity={0.85} radius={[2,2,0,0]} name="Входящие" />
              <Bar dataKey="outgoing"  fill="#3b82f6" opacity={0.85} radius={[2,2,0,0]} name="Исходящие" />
              <Bar dataKey="missed"    fill="#ef4444" opacity={0.85} radius={[2,2,0,0]} name="Пропущенные" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground py-10 text-center">Нет данных по часам за сегодня</p>
        )}
      </div>
    </div>
  );
}
