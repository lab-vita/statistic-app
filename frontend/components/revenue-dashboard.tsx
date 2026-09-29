"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchPaymentStats, fetchPaymentDaily, fetchPaymentDailyByType,
  fetchPaymentByDoctor, fetchSalesStats,
  toDateStr, addDays, formatMoney,
  PaymentStatsResponse, PaymentDailyResponse,
  PaymentDailyByTypeResponse, PaymentByDoctorResponse, SalesStatsResponse,
  DeltaDir,
} from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── Вспомогательные компоненты ──────────────────────────────

function Delta({ pct, dir, invert }: { pct?: number | null; dir?: DeltaDir; invert?: boolean }) {
  if (!dir || dir === "flat" || pct == null)
    return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />—</span>;
  const good = invert ? dir === "down" : dir === "up";
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${
      good ? "text-emerald-500" : "text-red-500"
    }`}>
      {dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {dir === "up" ? "+" : "−"}{pct}%
    </span>
  );
}

function StatCard({
  label, value, sub, deltaPct, deltaDir, invert, color,
}: {
  label: string;
  value: string;
  sub?: string;
  deltaPct?: number | null;
  deltaDir?: DeltaDir;
  invert?: boolean;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-1.5">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold ${color ?? ""}`}>{value}</div>
      <div className="flex items-center justify-between">
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
        <Delta pct={deltaPct} dir={deltaDir} invert={invert} />
      </div>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  by_cash:     "#22c55e",
  by_card:     "#3b82f6",
  by_cashless: "#a855f7",
  by_credit:   "#f59e0b",
  by_balance:  "#6b7280",
};

const TYPE_LABELS: Record<string, string> = {
  by_cash:     "Наличными",
  by_card:     "Картой",
  by_cashless: "Безналичными",
  by_credit:   "Кредитом",
  by_balance:  "Лицевой счёт",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-muted/40 border border-border ${className}`} />
);

// ─── Пресеты периода ─────────────────────────────────────────

type PeriodPreset = "week" | "month" | "quarter" | "custom";

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "week",    label: "7 дней"  },
  { id: "month",   label: "30 дней" },
  { id: "quarter", label: "90 дней" },
  { id: "custom",  label: "Период"  },
];

function presetDates(p: PeriodPreset): { from: string; to: string } {
  const to   = toDateStr(addDays(new Date(), -1));
  const days = p === "week" ? 7 : p === "month" ? 30 : 90;
  return { from: toDateStr(addDays(new Date(), -days)), to };
}

// ─── Основной компонент ──────────────────────────────────────

export function RevenueDashboard() {
  const [preset, setPreset]       = useState<PeriodPreset>("month");
  const [customFrom, setFrom]     = useState(toDateStr(addDays(new Date(), -30)));
  const [customTo,   setTo]       = useState(toDateStr(addDays(new Date(), -1)));

  const dateFrom = preset === "custom" ? customFrom : presetDates(preset).from;
  const dateTo   = preset === "custom" ? customTo   : presetDates(preset).to;

  const [payStats,  setPayStats]  = useState<PaymentStatsResponse | null>(null);
  const [payDaily,  setPayDaily]  = useState<PaymentDailyResponse | null>(null);
  const [byType,    setByType]    = useState<PaymentDailyByTypeResponse | null>(null);
  const [byDoctor,  setByDoctor]  = useState<PaymentByDoctorResponse | null>(null);
  const [salesData, setSalesData] = useState<SalesStatsResponse | null>(null);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, pd, bt, bd, sd] = await Promise.all([
        fetchPaymentStats(dateFrom, dateTo, 6),   // только обычные
        fetchPaymentDaily(dateFrom, dateTo, 6),
        fetchPaymentDailyByType(dateFrom, dateTo),
        fetchPaymentByDoctor(dateFrom, dateTo, 15),
        fetchSalesStats(dateFrom, dateTo, 20),
      ]);
      setPayStats(ps); setPayDaily(pd); setByType(bt); setByDoctor(bd); setSalesData(sd);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // Данные для графика динамики (area)
  const areaData = payDaily?.days.map(d => ({
    date:        d.date,
    total_paid:  Math.round(d.total_paid / 1000), // в тысячах
  })) ?? [];

  // Данные для stacked bar (типы оплаты)
  const stackData = byType
    ? byType.days.map((day, i) => {
        const obj: Record<string, number | string> = { date: day };
        byType.series.forEach(s => { obj[s.key] = Math.round(s.values[i] / 1000); });
        return obj;
      })
    : [];

  // Прячем нулевые типы
  const activeTypes = byType?.series.filter(s => s.values.some(v => v > 0)) ?? [];

  const totalPaid   = payStats?.total_paid   ?? 0;
  const avgPerDay   = payDaily && payDaily.days.length > 0
    ? Math.round(totalPaid / payDaily.days.filter(d => d.total_paid > 0).length)
    : 0;
  const avgCheck    = payStats && payStats.count > 0
    ? Math.round(totalPaid / payStats.count)
    : 0;

  return (
    <div className="space-y-5">

      {/* Заголовок + выбор периода */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-semibold">Выручка</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(dateFrom).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} —{" "}
            {new Date(dateTo).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  preset === p.id
                    ? "bg-background border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} onChange={e => setFrom(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none" />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="date" value={customTo} onChange={e => setTo(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none" />
            </div>
          )}
        </div>
      </div>

      {/* Карточки */}
      {loading
        ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        : payStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Выручка"
              value={`${formatMoney(totalPaid)} ₽`}
              sub={`${payStats.count} платежей`}
              deltaPct={payStats.total_paid_delta_pct}
              deltaDir={payStats.total_paid_delta_dir}
              color="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label="Средний чек"
              value={`${formatMoney(avgCheck)} ₽`}
              sub="за платёж"
            />
            <StatCard
              label="В день (среднее)"
              value={`${formatMoney(avgPerDay)} ₽`}
              sub="рабочих дней"
            />
            <StatCard
              label="Платежей"
              value={String(payStats.count)}
              deltaPct={payStats.count_delta_pct}
              deltaDir={payStats.count_delta_dir}
            />
          </div>
        )}

      {/* График динамики */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Динамика выручки</h3>
          <span className="text-xs text-muted-foreground">тыс. руб.</span>
        </div>
        {loading ? <Skeleton className="h-48" /> : areaData.length > 0 ? (
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false}
                interval={areaData.length > 30 ? 6 : areaData.length > 14 ? 3 : 0} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false} tickLine={false} width={36}
                tickFormatter={v => `${v}`} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                labelFormatter={fmtDate}
                formatter={(v: number) => [`${v} тыс. ₽`, "Выручка"]} />
              <Area type="monotone" dataKey="total_paid" stroke="#22c55e" strokeWidth={2}
                fill="url(#revGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Нет данных</div>
        )}
      </div>

      {/* Stacked bar по типам оплаты */}
      {activeTypes.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">По способам оплаты</h3>
            <div className="flex flex-wrap gap-3">
              {activeTypes.map(s => (
                <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm" style={{ background: TYPE_COLORS[s.key] }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          {loading ? <Skeleton className="h-48" /> : stackData.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={stackData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false} tickLine={false}
                  interval={stackData.length > 30 ? 6 : stackData.length > 14 ? 3 : 0} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                  labelFormatter={fmtDate}
                  formatter={(v: number, name: string) => [
                    `${v} тыс. ₽`, TYPE_LABELS[name] ?? name
                  ]} />
                {activeTypes.map(s => (
                  <Bar key={s.key} dataKey={s.key} stackId="a"
                    fill={TYPE_COLORS[s.key]} opacity={0.9}
                    radius={s.key === activeTypes[activeTypes.length - 1].key ? [2,2,0,0] : [0,0,0,0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Нет данных</div>
          )}
        </div>
      )}

      {/* Нижняя строка: топ врачей + топ услуг */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Топ врачей */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-medium">Топ врачей по выручке</h3>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : byDoctor && byDoctor.doctors.length > 0 ? (
            <div className="divide-y divide-border">
              {byDoctor.doctors.slice(0, 12).map((d, i) => (
                <div key={d.doctor_id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {d.doctor_surname} {d.doctor_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{d.count} платежей</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold">{formatMoney(d.total_paid)} ₽</div>
                    <div className="text-[11px] text-muted-foreground">{d.pct}%</div>
                  </div>
                  {/* Полоска */}
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Нет данных</div>
          )}
        </div>

        {/* Топ услуг */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium">Топ услуг по продажам</h3>
            {salesData && (
              <span className="text-xs text-muted-foreground">
                {formatMoney(salesData.total.final_sum)} ₽ итого
              </span>
            )}
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : salesData && salesData.services.length > 0 ? (
            <div className="divide-y divide-border">
              {salesData.services.slice(0, 12).map((s, i) => (
                <div key={s.service_title} className="px-5 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" title={s.service_title}>
                      {s.service_title}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{s.amount} шт.</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold">{formatMoney(s.final_sum)} ₽</div>
                    <div className="text-[11px] text-muted-foreground">{s.pct_of_total}%</div>
                  </div>
                  {/* Полоска */}
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.min(s.pct_of_total * 3, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Нет данных</div>
          )}
        </div>
      </div>
    </div>
  );
}
