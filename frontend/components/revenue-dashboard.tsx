"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchPaymentStats, fetchPaymentDaily, fetchPaymentDailyByType,
  fetchPaymentByDoctor, fetchSalesStats,
  formatMoney,
  PaymentStatsResponse, PaymentDailyResponse,
  PaymentDailyByTypeResponse, PaymentDoctorResponse,
  SalesStatsResponse, DeltaDir,
} from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Banknote, CreditCard, Receipt, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function DeltaBadge({ pct, dir, invert }: { pct?: number | null; dir?: DeltaDir; invert?: boolean }) {
  if (!dir || dir === "flat" || pct == null) return null;
  const isGood = invert ? dir === "down" : dir === "up";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
      isGood
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-red-500/10 text-red-600 dark:text-red-400"
    )}>
      {dir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

const TYPE_COLORS: Record<string, string> = {
  by_cash:     "#22c55e",
  by_card:     "#3b82f6",
  by_cashless: "#f59e0b",
  by_credit:   "#a855f7",
  by_balance:  "#64748b",
};

const formatDateTick    = (d: string) => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
const formatTooltipDate = (d: unknown) => new Date(String(d)).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/60", className)} />;
}

const TOOLTIP_STYLE = {
  fontSize: 11, borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  color: "var(--color-foreground)",
};

interface RevenueDashboardProps {
  dateFrom: string;
  dateTo:   string;
}

export function RevenueDashboard({ dateFrom, dateTo }: RevenueDashboardProps) {
  const [stats,   setStats]   = useState<PaymentStatsResponse | null>(null);
  const [daily,   setDaily]   = useState<PaymentDailyResponse | null>(null);
  const [byType,  setByType]  = useState<PaymentDailyByTypeResponse | null>(null);
  const [doctors, setDoctors] = useState<PaymentDoctorResponse | null>(null);
  const [sales,   setSales]   = useState<SalesStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, d, bt, doc, sl] = await Promise.all([
        fetchPaymentStats(dateFrom, dateTo),
        fetchPaymentDaily(dateFrom, dateTo),
        fetchPaymentDailyByType(dateFrom, dateTo),
        fetchPaymentByDoctor(dateFrom, dateTo, 15),
        fetchSalesStats(dateFrom, dateTo, 20),
      ]);
      setStats(s); setDaily(d); setByType(bt); setDoctors(doc); setSales(sl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-[12px] text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  const avgCheck    = stats && stats.count > 0 ? Math.round(stats.total_paid / stats.count) : 0;
  const stackedData = byType
    ? byType.days.map((date, i) => {
        const row: Record<string, string | number> = { date };
        for (const s of byType.series) row[s.key] = s.values[i];
        return row;
      })
    : [];
  const activeSeries  = byType?.series.filter(s => s.values.some(v => v > 0)) ?? [];
  const tickInterval  = (daily?.days.length ?? 0) > 60 ? 6 : (daily?.days.length ?? 0) > 30 ? 2 : 0;

  const SUMMARY_CARDS = [
    {
      label: "Выручка",
      value: stats ? `${fmt(stats.total_paid)} ₽` : "—",
      icon: <Banknote className="h-3.5 w-3.5" />,
      color: "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400",
      delta: <DeltaBadge pct={stats?.total_paid_delta_pct} dir={stats?.total_paid_delta_dir} />,
    },
    {
      label: "Платежей",
      value: stats ? fmt(stats.count) : "—",
      icon: <Receipt className="h-3.5 w-3.5" />,
      color: "bg-blue-500/8 text-blue-600 dark:text-blue-400",
      delta: <DeltaBadge pct={stats?.count_delta_pct} dir={stats?.count_delta_dir} />,
    },
    {
      label: "Средний чек",
      value: `${fmt(avgCheck)} ₽`,
      icon: <CreditCard className="h-3.5 w-3.5" />,
      color: "bg-violet-500/8 text-violet-600 dark:text-violet-400",
      delta: <span className="text-[11px] text-muted-foreground/60">за визит</span>,
    },
  ];

  return (
    <div className="space-y-4">

      {/* Карточки метрик */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {SUMMARY_CARDS.map(({ label, value, icon, color, delta }) => (
          loading ? <Skeleton key={label} className="h-24" /> : (
            <Card key={label} className="p-5 transition-all duration-150 hover:border-foreground/15">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">{label}</span>
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", color)}>{icon}</span>
              </div>
              <div className="text-[24px] font-semibold leading-none tracking-tight tabular-nums mb-2">{value}</div>
              <div>{delta}</div>
            </Card>
          )
        ))}

        {/* Способы оплаты */}
        {loading ? <Skeleton className="h-24" /> : (
          <Card className="p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Оплата</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/8 text-amber-600 dark:text-amber-400">
                <Users className="h-3.5 w-3.5" />
              </span>
            </div>
            {stats && stats.total_paid > 0 ? (
              <div className="space-y-2">
                {[
                  { label: "Наличные", val: stats.by_cash,     color: "bg-emerald-500" },
                  { label: "Карта",    val: stats.by_card,     color: "bg-blue-500" },
                  { label: "Безнал",   val: stats.by_cashless, color: "bg-amber-500" },
                ].filter(x => x.val > 0).map(({ label, val, color }) => {
                  const pct = Math.round(val / stats.total_paid * 100);
                  return (
                    <div key={label}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[11px] text-muted-foreground/60">{label}</span>
                        <span className="text-[11px] font-medium tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground/50">Нет данных</span>
            )}
          </Card>
        )}
      </div>

      {/* Динамика выручки */}
      <Card className="p-5">
        <h3 className="text-[13px] font-semibold tracking-tight mb-4">Динамика выручки</h3>
        {loading ? <Skeleton className="h-52" /> : daily && daily.days.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={daily.days}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDateTick}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tickFormatter={v => formatMoney(v)}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatTooltipDate}
                formatter={(v) => [`${fmt(Number(v))} ₽`, "Выручка"]} />
              <Area type="monotone" dataKey="total_paid" stroke="#22c55e" strokeWidth={2}
                fill="url(#revGrad)" name="Выручка" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center text-[12px] text-muted-foreground/50">
            Нет данных за период
          </div>
        )}
      </Card>

      {/* Способы оплаты по дням */}
      {!loading && activeSeries.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold tracking-tight">Способы оплаты по дням</h3>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {activeSeries.map(s => (
                <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm inline-block" style={{ background: TYPE_COLORS[s.key] ?? "#888" }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stackedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDateTick}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tickFormatter={v => formatMoney(v)}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatTooltipDate}
                formatter={(v, name) => [`${fmt(Number(v))} ₽`, activeSeries.find(s => s.key === name)?.label ?? name]} />
              {activeSeries.map(s => (
                <Area key={s.key} type="monotone" dataKey={s.key}
                  stackId="1" stroke={TYPE_COLORS[s.key] ?? "#888"}
                  fill={TYPE_COLORS[s.key] ?? "#888"} fillOpacity={0.55} strokeWidth={1} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Топ врачей + услуг */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Топ врачей */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="text-sm font-semibold">Топ врачей по выручке</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : doctors && doctors.doctors.length > 0 ? (
              <div className="divide-y divide-border">
                {doctors.doctors.map((d, i) => (
                  <div key={d.doctor_id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                    <span className="text-[11px] text-muted-foreground/50 w-4 text-right tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {d.doctor_surname} {d.doctor_name?.[0] ? `${d.doctor_name[0]}.` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground/60">{d.count} платежей</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-semibold tabular-nums">{fmt(d.total_paid)} ₽</div>
                      <div className="text-[11px] text-muted-foreground/60 tabular-nums">{d.pct}%</div>
                    </div>
                    <div className="w-14 h-1 rounded-full bg-border overflow-hidden shrink-0">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-[12px] text-muted-foreground/50">Нет данных</div>
            )}
          </CardContent>
        </Card>

        {/* Топ услуг */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b px-5 py-3.5">
            <CardTitle className="text-sm font-semibold">Топ услуг по выручке</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : sales && sales.services.length > 0 ? (
              <div className="divide-y divide-border">
                {sales.services.map((s, i) => (
                  <div key={s.service_title} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                    <span className="text-[11px] text-muted-foreground/50 w-4 text-right tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate" title={s.service_title}>{s.service_title}</div>
                      <div className="text-[11px] text-muted-foreground/60">{s.amount} шт.</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-semibold tabular-nums">{fmt(Math.round(s.final_sum))} ₽</div>
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[11px] text-muted-foreground/60 tabular-nums">{s.pct_of_total}%</span>
                        {s.delta_pct != null && s.delta_dir && s.delta_dir !== "flat" && (
                          <span className={cn("text-[10px] font-medium", s.delta_dir === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                            {s.delta_dir === "up" ? "+" : "−"}{s.delta_pct}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-14 h-1 rounded-full bg-border overflow-hidden shrink-0">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(s.pct_of_total * 3, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-[12px] text-muted-foreground/50">Нет данных</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Платежи по дням */}
      {!loading && daily && daily.days.length > 0 && (
        <Card className="p-5">
          <h3 className="text-[13px] font-semibold tracking-tight mb-4">Платежи по дням (количество)</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={daily.days} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDateTick}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatTooltipDate}
                formatter={(v) => [Number(v), "Платежей"]} />
              <Bar dataKey="count" fill="#6366f1" fillOpacity={0.75} radius={[3,3,0,0]} name="Платежей" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
