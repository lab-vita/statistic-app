"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchPaymentStats, fetchPaymentDaily, fetchPaymentDailyByType,
  fetchPaymentByDoctor, fetchSalesStats,
  toDateStr, addDays, formatMoney,
  PaymentStatsResponse, PaymentDailyResponse,
  PaymentDailyByTypeResponse, PaymentDoctorResponse,
  SalesStatsResponse, DeltaDir,
} from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Banknote, CreditCard, Receipt, Users } from "lucide-react";

// ─── Вспомогательные ─────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function DeltaBadge({ pct, dir, invert }: { pct?: number | null; dir?: DeltaDir; invert?: boolean }) {
  if (!dir || dir === "flat" || pct == null) return null;
  const isGood = invert ? dir === "down" : dir === "up";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
      isGood ? "text-emerald-500" : "text-red-500"
    }`}>
      {dir === "up"
        ? <TrendingUp className="h-3 w-3" />
        : <TrendingDown className="h-3 w-3" />}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

const TOOLTIP_STYLE = {
  fontSize: 11, borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
};

const TYPE_COLORS: Record<string, string> = {
  by_cash:     "#22c55e",
  by_card:     "#3b82f6",
  by_cashless: "#f59e0b",
  by_credit:   "#a855f7",
  by_balance:  "#64748b",
};

function formatDateTick(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatTooltipLabel(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-muted/40 border border-border ${className}`} />
);

// ─── Основной компонент ──────────────────────────────────────

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
    setLoading(true);
    setError(null);
    try {
      const [s, d, bt, doc, sl] = await Promise.all([
        fetchPaymentStats(dateFrom, dateTo),
        fetchPaymentDaily(dateFrom, dateTo),
        fetchPaymentDailyByType(dateFrom, dateTo),
        fetchPaymentByDoctor(dateFrom, dateTo, 15),
        fetchSalesStats(dateFrom, dateTo, 20),
      ]);
      setStats(s); setDaily(d); setByType(bt);
      setDoctors(doc); setSales(sl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-500">
        {error}
      </div>
    );
  }

  const avgCheck = stats && stats.count > 0
    ? Math.round(stats.total_paid / stats.count)
    : 0;

  // Для stacked area: преобразуем series в [{date, by_cash, by_card, ...}]
  const stackedData = byType
    ? byType.days.map((date, i) => {
        const row: Record<string, string | number> = { date };
        for (const s of byType.series) row[s.key] = s.values[i];
        return row;
      })
    : [];

  // Фильтруем нулевые серии (лицевой счёт)
  const activeSeries = byType?.series.filter(s =>
    s.values.some(v => v > 0)
  ) ?? [];

  const tickInterval = (daily?.days.length ?? 0) > 60 ? 6
    : (daily?.days.length ?? 0) > 30 ? 2 : 0;

  return (
    <div className="space-y-5">

      {/* ── Карточки ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Выручка */}
        {loading ? <Skeleton className="h-24" /> : (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Banknote className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <span className="text-xs text-muted-foreground">Выручка</span>
            </div>
            <div className="text-2xl font-semibold">
              {fmt(stats?.total_paid ?? 0)} ₽
            </div>
            <div className="mt-1">
              <DeltaBadge pct={stats?.total_paid_delta_pct} dir={stats?.total_paid_delta_dir} />
            </div>
          </div>
        )}

        {/* Платежей */}
        {loading ? <Skeleton className="h-24" /> : (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Receipt className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground">Платежей</span>
            </div>
            <div className="text-2xl font-semibold">{fmt(stats?.count ?? 0)}</div>
            <div className="mt-1">
              <DeltaBadge pct={stats?.count_delta_pct} dir={stats?.count_delta_dir} />
            </div>
          </div>
        )}

        {/* Средний чек */}
        {loading ? <Skeleton className="h-24" /> : (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <CreditCard className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <span className="text-xs text-muted-foreground">Средний чек</span>
            </div>
            <div className="text-2xl font-semibold">{fmt(avgCheck)} ₽</div>
            <div className="mt-1 text-[11px] text-muted-foreground">за визит</div>
          </div>
        )}

        {/* Разбивка по способам */}
        {loading ? <Skeleton className="h-24" /> : (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <span className="text-xs text-muted-foreground">Способы оплаты</span>
            </div>
            {stats && stats.total_paid > 0 ? (
              <div className="space-y-1.5">
                {[
                  { label: "Наличные", val: stats.by_cash,     color: "bg-emerald-500" },
                  { label: "Карта",    val: stats.by_card,     color: "bg-blue-500" },
                  { label: "Безнал",   val: stats.by_cashless, color: "bg-amber-500" },
                ].filter(x => x.val > 0).map(({ label, val, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-1.5">
                      <div className={`h-1.5 rounded-full ${color}`}
                        style={{ width: `${Math.round(val / stats.total_paid * 100)}%`, minWidth: 4 }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-14 text-right">
                      {label} {Math.round(val / stats.total_paid * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Нет данных</div>
            )}
          </div>
        )}
      </div>

      {/* ── Динамика выручки ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-medium mb-4">Динамика выручки</h3>
        {loading ? <Skeleton className="h-52" /> : daily && daily.days.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={daily.days}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDateTick}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tickFormatter={v => formatMoney(v)}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} width={48} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={formatTooltipLabel}
                formatter={(v: number) => [`${fmt(v)} ₽`, "Выручка"]} />
              <Area type="monotone" dataKey="total_paid" stroke="#22c55e" strokeWidth={2}
                fill="url(#revGrad)" name="Выручка" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
            Нет данных за период
          </div>
        )}
      </div>

      {/* ── Способы оплаты по дням ── */}
      {!loading && activeSeries.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Способы оплаты по дням</h3>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {activeSeries.map(s => (
                <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm inline-block"
                    style={{ background: TYPE_COLORS[s.key] ?? "#888" }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stackedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDateTick}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tickFormatter={v => formatMoney(v)}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} width={48} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={formatTooltipLabel}
                formatter={(v: number, name: string) => [
                  `${fmt(v)} ₽`,
                  activeSeries.find(s => s.key === name)?.label ?? name,
                ]} />
              {activeSeries.map(s => (
                <Area key={s.key} type="monotone" dataKey={s.key}
                  stackId="1"
                  stroke={TYPE_COLORS[s.key] ?? "#888"}
                  fill={TYPE_COLORS[s.key] ?? "#888"}
                  fillOpacity={0.6} strokeWidth={1} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Топ врачей + Топ услуг ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Топ врачей */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-medium">Топ врачей по выручке</h3>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : doctors && doctors.doctors.length > 0 ? (
            <div className="divide-y divide-border">
              {doctors.doctors.map((d, i) => (
                <div key={d.doctor_id} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {d.doctor_surname} {d.doctor_name?.[0] ? `${d.doctor_name[0]}.` : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {d.count} платежей
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{fmt(d.total_paid)} ₽</div>
                    <div className="text-[11px] text-muted-foreground">{d.pct}%</div>
                  </div>
                  {/* Полоска */}
                  <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500/70"
                      style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Нет данных
            </div>
          )}
        </div>

        {/* Топ услуг */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-medium">Топ услуг по выручке</h3>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : sales && sales.services.length > 0 ? (
            <div className="divide-y divide-border">
              {sales.services.map((s, i) => (
                <div key={s.service_title} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" title={s.service_title}>
                      {s.service_title}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.amount} шт
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{fmt(Math.round(s.final_sum))} ₽</div>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[11px] text-muted-foreground">{s.pct_of_total}%</span>
                      {s.delta_pct != null && s.delta_dir && s.delta_dir !== "flat" && (
                        <span className={`text-[10px] font-medium ${
                          s.delta_dir === "up" ? "text-emerald-500" : "text-red-500"
                        }`}>
                          {s.delta_dir === "up" ? "+" : "−"}{s.delta_pct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500/70"
                      style={{ width: `${Math.min(s.pct_of_total * 3, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Нет данных
            </div>
          )}
        </div>
      </div>

      {/* ── Столбчатая детализация по дням ── */}
      {!loading && daily && daily.days.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium mb-4">Платежи по дням (кол-во)</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={daily.days} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDateTick}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={formatTooltipLabel}
                formatter={(v: number) => [v, "Платежей"]} />
              <Bar dataKey="count" fill="#6366f1" opacity={0.8} radius={[3,3,0,0]} name="Платежей" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
