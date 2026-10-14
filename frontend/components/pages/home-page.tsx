"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchStats, fetchAppointmentStats, fetchConversion, fetchPaymentStats,
  toDateStr, addDays, formatDuration, fmtRub,
  type StatsResponse, type AppointmentStatsResponse, type ConversionResponse, type PaymentStatsResponse,
} from "@/lib/api";
import { getDefaultPeriod, shiftPeriod, formatPeriodLabel, type Period, type PeriodType } from "@/lib/periods";
import {
  PageContent, SectionCard, SrcBar, Delta, ProgressBar,
  TabGroup, Skeleton, Empty, ErrorBanner, SparkLine,
} from "@/components/ui/primitives";
import { fetchDaily, type DailyResponse } from "@/lib/api";
import type { Section } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const PERIODS = ["День","Неделя","Месяц","Квартал","Год"];
const P_MAP: Record<string, PeriodType> = {
  "День":"day","Неделя":"week","Месяц":"month","Квартал":"quarter","Год":"year"
};
const GROUP_ORDER = ["callcenter","admin","other","unknown"] as const;
const GROUP_LABELS: Record<string, string> = {
  callcenter:"Колл-центр", admin:"Администраторы", other:"Прочие", unknown:"Не указан"
};
const GROUP_COLORS: Record<string, { text: string; bar: string }> = {
  callcenter: { text: "#1d4ed8", bar: "#2563eb" },
  admin:      { text: "#15803d", bar: "#16a34a" },
  other:      { text: "#6d28d9", bar: "#7c3aed" },
  unknown:    { text: "#9ca3af", bar: "#d1d5db" },
};

function fmt(n: number) { return n.toLocaleString("ru-RU"); }
function fmtPct(n: number) { return n.toFixed(1) + "%"; }

interface KpiCardProps {
  label:      string;
  value:      string;
  sub:        string;
  color:      string;
  spark?:     number[];
  sparkColor: string;
  dir?:       string | null;
  pct?:       number | null;
  invert?:    boolean;
  onClick?:   () => void;
}

function KpiCard({ label, value, sub, color, spark, sparkColor, dir, pct, invert, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border bg-card p-4 flex flex-col",
        onClick && "cursor-pointer hover:border-foreground/20 transition-colors"
      )}
    >
      <div className="flex items-start justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70">{label}</p>
        {spark && <SparkLine values={spark} color={sparkColor} />}
      </div>
      <p className={cn("text-[36px] font-black leading-none tracking-tight tabular-nums mb-1", color)}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground/60 mb-3">{sub}</p>
      <Delta dir={dir as any} pct={pct} invert={invert} />
    </div>
  );
}

function FunnelCard({ s }: { s: NonNullable<StatsResponse["operators"]["total"]> }) {
  const segs1 = [{ v: s.incoming, c: "#16a34a" }, { v: s.missed, c: "#f59e0b" }];
  const segs2 = [
    { v: s.outcome_reached, c: "#16a34a" },
    { v: s.outcome_self,    c: "#2563eb"  },
    { v: s.outcome_failed,  c: "#f59e0b"  },
    { v: s.outcome_none,    c: "#dc2626"  },
  ];
  return (
    <SectionCard title="Судьба звонков" right={`${fmt(s.received)} поступило`}>
      <div className="space-y-3">
        <div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-border gap-px mb-2">
            {segs1.map((sg,i) => <div key={i} style={{ width:`${s.received>0?sg.v/s.received*100:0}%`, background:sg.c }} />)}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              {c:"#16a34a",l:"Принято",  v:s.incoming, p:fmtPct(s.received>0?s.incoming/s.received*100:0)},
              {c:"#f59e0b",l:"Пропущено",v:s.missed,   p:fmtPct(s.missed_pct)},
            ].map((r,i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{background:r.c}} />
                <span className="text-muted-foreground/60 flex-1">{r.l}</span>
                <span className="font-bold tabular-nums">{fmt(r.v)}</span>
                <span className="text-muted-foreground/50 w-10">{r.p}</span>
              </div>
            ))}
          </div>
        </div>
        {s.missed > 0 && (
          <div className="pt-3 border-t border-border">
            <p className="text-[11px] text-muted-foreground/60 mb-2">Из {fmt(s.missed)} пропущенных</p>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-border gap-px mb-2">
              {segs2.map((sg,i) => <div key={i} style={{ width:`${s.missed>0?sg.v/s.missed*100:0}%`, background:sg.c }} />)}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                {c:"#16a34a",l:"Перезв., дозв.",  v:s.outcome_reached, p:fmtPct(s.missed>0?s.outcome_reached/s.missed*100:0)},
                {c:"#2563eb",l:"Клиент сам",       v:s.outcome_self,    p:fmtPct(s.missed>0?s.outcome_self/s.missed*100:0)},
                {c:"#f59e0b",l:"Перезв., нет",     v:s.outcome_failed,  p:fmtPct(s.missed>0?s.outcome_failed/s.missed*100:0)},
                {c:"#dc2626",l:"Не перезвонили",   v:s.outcome_none,    p:fmtPct(s.missed>0?s.outcome_none/s.missed*100:0)},
              ].map((r,i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full" style={{background:r.c}} />
                  <span className="text-muted-foreground/60 flex-1">{r.l}</span>
                  <span className="font-bold tabular-nums">{fmt(r.v)}</span>
                  <span className="text-muted-foreground/50 w-10">{r.p}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="pt-3 border-t border-border flex justify-between items-end">
          <div>
            <p className="text-[11px] text-muted-foreground/60 mb-1">Потеряно навсегда</p>
            <p className="text-[30px] font-black tabular-nums leading-none text-red-600 dark:text-red-400">{fmt(s.lost)}</p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold tabular-nums">{fmtPct(s.lost_pct)}</p>
            <p className="text-[11px] text-muted-foreground/60">от поступивших</p>
            <div className="mt-1"><Delta dir={s.lost_delta_dir} pct={s.lost_delta_pct} invert /></div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

interface Props { onNavigate: (s: Section) => void; }

export function HomePage({ onNavigate }: Props) {
  const [periodLabel, setPeriodLabel] = useState("Месяц");
  const [period,      setPeriod]      = useState<Period>(getDefaultPeriod("month"));
  const [stats,       setStats]       = useState<StatsResponse | null>(null);
  const [appts,       setAppts]       = useState<AppointmentStatsResponse | null>(null);
  const [conv,        setConv]        = useState<ConversionResponse | null>(null);
  const [daily,       setDaily]       = useState<DailyResponse | null>(null);
  const [payments,    setPayments]    = useState<PaymentStatsResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const dateFrom  = toDateStr(period.dateFrom);
  const dateTo    = toDateStr(period.dateTo);
  const yesterday = toDateStr(addDays(new Date(), -1));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, a, c, d, pay] = await Promise.all([
        fetchStats(dateFrom, dateTo),
        fetchAppointmentStats(dateFrom, dateTo),
        fetchConversion(dateFrom, dateTo),
        fetchDaily(dateFrom, dateTo),
        fetchPaymentStats(dateFrom, dateTo).catch(() => null),
      ]);
      setStats(s); setAppts(a); setConv(c); setDaily(d); setPayments(pay);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const total   = stats?.operators["total"];
  const appt    = appts?.total;
  const spark   = daily?.days.map(d => d.incoming) ?? [];
  const avgCheck = payments && payments.count > 0 ? Math.round(payments.total_paid / payments.count) : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-5">
        <span className="text-[13px] font-bold">Главная</span>
        <div className="flex-1" />
        <TabGroup
          items={PERIODS}
          active={periodLabel}
          onChange={l => { setPeriodLabel(l); setPeriod(getDefaultPeriod(P_MAP[l] ?? "month")); }}
        />
        <div className="flex items-center gap-0.5">
          <button onClick={() => setPeriod(p => shiftPeriod(p, -1))}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors text-base">‹</button>
          <span className="text-[12px] font-medium min-w-[120px] text-center tabular-nums">{formatPeriodLabel(period)}</span>
          <button onClick={() => setPeriod(p => shiftPeriod(p, 1))}
            disabled={toDateStr(period.dateTo) >= yesterday}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40 text-base">›</button>
        </div>
        <div className="h-4 w-px bg-border" />
        <button onClick={load} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors text-sm">↻</button>
      </header>

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-36"/>)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Skeleton className="h-72" /><Skeleton className="h-72" />
            </div>
          </>
        ) : !total ? (
          <Empty />
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KpiCard
                label="Принято звонков"
                value={fmt(total.incoming)}
                sub={`из ${fmt(total.received)} поступивших · ${fmtPct(total.received>0?total.incoming/total.received*100:0)}`}
                color="text-emerald-600 dark:text-emerald-400"
                spark={spark}
                sparkColor="#16a34a"
                dir={total.incoming_delta_dir}
                pct={total.incoming_delta_pct}
                onClick={() => onNavigate("calls")}
              />
              <KpiCard
                label="Потеряно клиентов"
                value={fmt(total.lost)}
                sub={`${fmtPct(total.lost_pct)} от поступивших · не дозвонились`}
                color="text-red-600 dark:text-red-400"
                spark={daily?.days.map(d=>d.lost)??[]}
                sparkColor="#dc2626"
                dir={total.lost_delta_dir}
                pct={total.lost_delta_pct}
                invert
                onClick={() => onNavigate("calls")}
              />
              {/* Conversion */}
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col cursor-pointer hover:border-foreground/20 transition-colors"
                onClick={() => onNavigate("calls")}>
                <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-1">
                  Конверсия звонок → запись
                </p>
                <p className="text-[36px] font-black leading-none tracking-tight tabular-nums text-blue-600 dark:text-blue-400 mb-1">
                  {conv ? `${conv.total.conversion_pct}%` : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground/60 mb-3">
                  {conv ? `${conv.total.appointments} записей из ${conv.total.incoming} принятых` : "только колл-центр"}
                </p>
                {conv && conv.operators.map(op => (
                  <div key={op.operator_id} className="flex items-center gap-2 mb-2 last:mb-0">
                    <span className="text-[11px] text-muted-foreground/60 min-w-[90px] truncate">{op.surname}</span>
                    <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(op.conversion_pct, 100)}%`,
                          background: op.conversion_pct>=70?"#16a34a":op.conversion_pct>=40?"#d97706":"#dc2626"
                        }}
                      />
                    </div>
                    <span className={cn(
                      "text-[11px] font-bold tabular-nums min-w-[36px] text-right",
                      op.conversion_pct>=70?"text-emerald-600 dark:text-emerald-400":op.conversion_pct>=40?"text-amber-600 dark:text-amber-400":"text-red-600 dark:text-red-400"
                    )}>
                      {op.conversion_pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue KPI strip */}
            {payments && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  className="rounded-lg border border-border bg-card p-4 flex flex-col cursor-pointer hover:border-foreground/20 transition-colors"
                  onClick={() => onNavigate("revenue")}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-1">Выручка</p>
                  <p className="text-[28px] font-black leading-none tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400 mb-1">
                    {fmtRub(payments.total_paid)}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">{payments.count} платежей</p>
                  <div className="mt-auto pt-2">
                    <Delta dir={payments.total_paid_delta_dir} pct={payments.total_paid_delta_pct} />
                  </div>
                </div>
                <div
                  className="rounded-lg border border-border bg-card p-4 flex flex-col cursor-pointer hover:border-foreground/20 transition-colors"
                  onClick={() => onNavigate("revenue")}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-1">Средний чек</p>
                  <p className="text-[28px] font-black leading-none tracking-tight tabular-nums text-foreground mb-1">
                    {fmtRub(avgCheck)}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">за визит</p>
                </div>
                <div
                  className="rounded-lg border border-border bg-card p-4 flex flex-col cursor-pointer hover:border-foreground/20 transition-colors sm:col-span-2"
                  onClick={() => onNavigate("revenue")}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70 mb-2">Способы оплаты</p>
                  <div className="space-y-2 flex-1">
                    {[
                      { label: "Наличными", val: payments.by_cash,    color: "#16a34a" },
                      { label: "Картой",    val: payments.by_card,    color: "#2563eb" },
                      { label: "Безнал",    val: payments.by_cashless, color: "#d97706" },
                      { label: "Кредит",   val: payments.by_credit,  color: "#7c3aed" },
                    ].filter(x => x.val > 0).map(x => {
                      const pct = payments.total_paid > 0 ? Math.round(x.val / payments.total_paid * 100) : 0;
                      return (
                        <div key={x.label}>
                          <div className="flex justify-between mb-0.5">
                            <span className="text-[11px] text-muted-foreground/60">{x.label}</span>
                            <span className="text-[11px] font-bold tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: pct + "%", background: x.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Funnel + Appointments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <FunnelCard s={total} />

              {/* Appointments summary */}
              <div className="flex flex-col gap-3">
                {appt && (
                  <div className="rounded-lg border border-border bg-card p-4 cursor-pointer hover:border-foreground/20 transition-colors"
                    onClick={() => onNavigate("appointments")}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/70">Записи за период</p>
                      <span className="text-[11px] text-muted-foreground/50">всего {fmt(appt.total)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        { l:"Явки",           v:appt.visits,        c:"text-emerald-600 dark:text-emerald-400", s:`${fmtPct(appt.visit_pct)} от записей` },
                        { l:"Неявки",         v:appt.noshow,        c:appt.noshow_pct>10?"text-red-600 dark:text-red-400":"text-amber-600 dark:text-amber-400", s:`${fmtPct(appt.noshow_pct)}` },
                        { l:"Новые пациенты", v:appt.new_patients,  c:"text-violet-600 dark:text-violet-400", s:`${fmtPct(appt.new_pct)}` },
                        { l:"Ожидают",        v:appt.pending,       c:"text-foreground", s:"не подтверждены" },
                      ].map(x => (
                        <div key={x.l} className="bg-muted/40 rounded-lg px-3 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 mb-1">{x.l}</p>
                          <p className={cn("text-[22px] font-black tabular-nums leading-none", x.c)}>{fmt(x.v)}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{x.s}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sources */}
                {appts?.by_group && (
                  <SectionCard title="Источники записей" right={appt ? `всего ${fmt(appt.total)}` : undefined}>
                    {GROUP_ORDER.map(g => {
                      const item = appts.by_group[g];
                      if (!item || item.count === 0) return null;
                      const c = GROUP_COLORS[g];
                      return (
                        <SrcBar key={g}
                          name={GROUP_LABELS[g]} nameColor={c.text}
                          count={item.count} pct={item.pct} barColor={c.bar}
                        />
                      );
                    })}
                  </SectionCard>
                )}
              </div>
            </div>
          </>
        )}
      </PageContent>
    </div>
  );
}
