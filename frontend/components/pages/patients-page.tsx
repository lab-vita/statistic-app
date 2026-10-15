"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  fetchNoshows, fetchReturns, toDateStr, addDays,
  type NoshowCounts, type NoshowsResponse, type ReturnsResponse,
} from "@/lib/api";
import { getDefaultPeriod, shiftPeriod, formatPeriodLabel, type Period, type PeriodType } from "@/lib/periods";
import {
  Topbar, PageContent, MetricCard, SectionCard, StatusPill, Th, Td, Skeleton, SkeletonCards, Empty, ErrorBanner,
} from "@/components/ui/primitives";
import { useChartTheme } from "@/components/charts/base-chart";

/**
 * Пациенты: неявки (по врачам, дням недели, часам) и повторные визиты
 * (кто возвращается и через сколько). Записи считаются по дню приёма;
 * приёмы, которые ещё впереди, в доли не входят.
 */

const PERIODS = ["Неделя", "Месяц", "Квартал", "Год"];
const P_MAP: Record<string, PeriodType> = { "Неделя": "week", "Месяц": "month", "Квартал": "quarter", "Год": "year" };

const BRAND = "#328fcd";
const GREEN = "#1a9e6e";
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const fmt = (n: number) => n.toLocaleString("ru-RU");
const pct = (n: number) => `${n.toFixed(1).replace(".", ",").replace(",0", "")}%`;
const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
};

// Пороги цвета для доли неявок — как в остальном приложении для пропущенных
const noshowTone = (p: number): "green" | "amber" | "red" => (p > 10 ? "red" : p > 6 ? "amber" : "green");

// ─── Неявки ──────────────────────────────────────────────────

function RateBars({ rows, label }: { rows: { name: string; c: NoshowCounts }[]; label: string }) {
  const ct = useChartTheme();
  const data = rows.map(r => ({ name: r.name, value: r.c.noshow_pct, noshow: r.c.noshow, attended: r.c.visits + r.c.noshow }));
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 16, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} interval={0} minTickGap={0} />
        <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
        <Tooltip
          {...ct.tooltip}
          cursor={{ fill: ct.cursor }}
          formatter={(_v, _n, item) => {
            const p = item.payload as typeof data[number];
            return [`${pct(p.value)} — ${fmt(p.noshow)} из ${fmt(p.attended)}`, label];
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}
          label={{ position: "top", fontSize: 10, fill: ct.axis, formatter: (v: unknown) => (Number(v) ? pct(Number(v)) : "") }}>
          {data.map((d, i) => (
            <Cell key={i} fill={BRAND} fillOpacity={d.attended ? 0.35 + 0.65 * (d.value / max) : 0.15} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function NoshowSection({ data }: { data: NoshowsResponse }) {
  const t = data.total;
  const weekdays = data.by_weekday.filter(w => w.appointments > 0).map(w => ({ name: w.label, c: w }));
  const hours = data.by_hour.filter(h => h.visits + h.noshow >= 5).map(h => ({ name: `${h.hour}:00`, c: h }));
  const worstDay = [...weekdays].sort((a, b) => b.c.noshow_pct - a.c.noshow_pct)[0];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Неявки" value={pct(t.noshow_pct)}
          valueClass={noshowTone(t.noshow_pct) === "red" ? "text-red-600 dark:text-red-400" : noshowTone(t.noshow_pct) === "amber" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}
          sub={`${fmt(t.noshow)} из ${fmt(t.visits + t.noshow)} приёмов`}
          deltaDir={t.noshow_pct_delta_dir} deltaPct={t.noshow_pct_delta_pct} invert
        />
        <MetricCard label="Пришли" value={fmt(t.visits)} valueClass="text-emerald-600 dark:text-emerald-400" sub="состоявшиеся приёмы" />
        <MetricCard label="Отмены" value={pct(t.cancel_pct)} sub={`${fmt(t.cancels)} ${plural(t.cancels, "запись отменена", "записи отменены", "записей отменено")}`} />
        <MetricCard label="Ещё впереди" value={fmt(t.pending)} sub="без отметки — в доли не входят" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Неявки по дням недели" right={worstDay ? `чаще всего — ${worstDay.name.toLowerCase()}` : undefined}>
          {weekdays.length ? <RateBars rows={weekdays} label="Неявки" /> : <p className="text-[12px] text-text-3">Нет приёмов</p>}
        </SectionCard>
        <SectionCard title="Неявки по времени приёма" right="час начала приёма">
          {hours.length ? <RateBars rows={hours} label="Неявки" /> : <p className="text-[12px] text-text-3">Нет приёмов</p>}
        </SectionCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <SectionCard title="Новые и повторные пациенты">
          <div className="space-y-4">
            {([["Впервые в клинике", data.by_patient.new], ["Уже бывали", data.by_patient.repeat]] as const).map(([name, c]) => (
              <div key={name}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-medium">{name}</span>
                  <StatusPill color={noshowTone(c.noshow_pct)}>{pct(c.noshow_pct)}</StatusPill>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(c.noshow_pct * 4, 100)}%`, background: BRAND }} />
                </div>
                <p className="mt-1 text-[11px] text-text-3">не пришли {fmt(c.noshow)} из {fmt(c.visits + c.noshow)}</p>
              </div>
            ))}
            <p className="text-[11px] leading-relaxed text-text-3">
              Если новые пациенты не приходят заметно чаще, им стоит звонить накануне приёма в первую очередь.
            </p>
          </div>
        </SectionCard>

        <div className="lg:col-span-2">
          <SectionCard title="Неявки по врачам" right={`от ${data.min_doctor_appts} приёмов за период`} noPad>
            {data.by_doctor.length === 0 ? (
              <p className="px-5 pb-5 text-[12px] text-text-3">Мало приёмов, чтобы сравнивать врачей</p>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full border-collapse [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                  <thead className="sticky top-0 bg-card">
                    <tr><Th>Врач</Th><Th right>Приёмов</Th><Th right>Не пришли</Th><Th right>Неявки</Th><Th right>Отмены</Th></tr>
                  </thead>
                  <tbody>
                    {data.by_doctor.map(d => (
                      <tr key={d.doctor_id} className="transition-colors hover:bg-accent/60">
                        <Td><span className="font-semibold">{d.doctor_name}</span></Td>
                        <Td right>{fmt(d.visits + d.noshow)}</Td>
                        <Td right>{fmt(d.noshow)}</Td>
                        <Td right><StatusPill color={noshowTone(d.noshow_pct)}>{pct(d.noshow_pct)}</StatusPill></Td>
                        <Td right muted>{pct(d.cancel_pct)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

// ─── Повторные визиты ────────────────────────────────────────

function MonthlyChart({ rows }: { rows: ReturnsResponse["monthly"] }) {
  const ct = useChartTheme();
  const data = rows.filter(r => r.reliable && r.new + r.returning > 0).map(r => {
    const [y, m] = r.month.split("-").map(Number);
    return { name: `${MONTHS[m - 1]} ${String(y).slice(2)}`, Новые: r.new, Повторные: r.returning };
  });
  if (data.length < 2) return <p className="text-[12px] text-text-3">Пока мало истории для динамики по месяцам</p>;
  return (
    <>
      <div className="mb-2 flex gap-4 text-[11.5px] text-text-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GREEN }} />Уже бывали</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BRAND }} />Впервые</span>
      </div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
          <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} />
          <Tooltip {...ct.tooltip} cursor={{ fill: ct.cursor }} formatter={(v, n) => [fmt(Number(v)), n === "Новые" ? "Впервые" : "Уже бывали"]} />
          <Bar dataKey="Повторные" stackId="p" fill={GREEN} stroke={ct.dark ? "#112131" : "#ffffff"} strokeWidth={1} maxBarSize={40} />
          <Bar dataKey="Новые" stackId="p" fill={BRAND} stroke={ct.dark ? "#112131" : "#ffffff"} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

function ReturnsSection({ data }: { data: ReturnsResponse }) {
  const since = data.data_since ? new Date(`${data.data_since}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : null;
  const cb30 = data.came_back.find(c => c.days === 30);
  const cb90 = data.came_back.find(c => c.days === 90);
  const gapMax = Math.max(...data.gap_buckets.map(b => b.count), 1);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Пациентов пришло" value={fmt(data.patients)} sub={`${fmt(data.new)} впервые`} />
        <MetricCard label="Уже бывали у нас" value={pct(data.returning_pct)} valueClass="text-emerald-600 dark:text-emerald-400"
          sub={`${fmt(data.returning)} ${plural(data.returning, "пациент", "пациента", "пациентов")}`} />
        <MetricCard label="Вернулись за 30 дней" value={cb30 && cb30.eligible ? pct(cb30.pct) : "—"}
          sub={cb30 && cb30.eligible ? `${fmt(cb30.count)} из ${fmt(cb30.eligible)}` : "мало времени прошло"} />
        <MetricCard label="Между визитами" value={data.median_gap_days != null ? `${data.median_gap_days} дн.` : "—"} sub="медиана, у тех, кто вернулся" />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionCard title="Новые и вернувшиеся по месяцам" right="уникальные пациенты">
            <MonthlyChart rows={data.monthly} />
          </SectionCard>
        </div>
        <div className="lg:col-span-2">
          <SectionCard title="Через сколько возвращаются" right="визиты в периоде">
            <div className="space-y-3">
              {data.gap_buckets.map(b => (
                <div key={b.label}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="text-text-2">{b.label}</span>
                    <span className="font-bold tabular-nums">{fmt(b.count)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full" style={{ width: `${(b.count / gapMax) * 100}%`, background: BRAND }} />
                  </div>
                </div>
              ))}
              {cb90 && cb90.eligible > 0 && (
                <p className="pt-1 text-[11px] leading-relaxed text-text-3">
                  За 90 дней после визита вернулись {pct(cb90.pct)} — {fmt(cb90.count)} из {fmt(cb90.eligible)} пациентов,
                  у которых эти 90 дней уже прошли.
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Возвращаемость по врачам" right={`пациенты с визитом не позже чем 90 дней назад, от ${data.min_doctor_patients}`} noPad>
        {data.by_doctor.length === 0 ? (
          <p className="px-5 pb-5 text-[12px] text-text-3">
            Пока не набралось пациентов, у которых после визита прошло 90 дней. Выберите период подальше в прошлое.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full border-collapse [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className="sticky top-0 bg-card">
                <tr><Th>Врач</Th><Th right>Пациентов</Th><Th right>Вернулись в клинику</Th><Th right>К тому же врачу</Th></tr>
              </thead>
              <tbody>
                {data.by_doctor.map(d => (
                  <tr key={d.doctor_id} className="transition-colors hover:bg-accent/60">
                    <Td><span className="font-semibold">{d.doctor_name}</span></Td>
                    <Td right>{fmt(d.patients)}</Td>
                    <Td right bold>{pct(d.came_back_pct)}</Td>
                    <Td right muted>{pct(d.same_doctor_pct)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {since && (
        <p className="px-1 text-[11px] leading-relaxed text-text-3">
          История визитов в базе — с {since}. Пациенты, которые были в клинике раньше, но с тех пор не приходили,
          для «Пульса» выглядят новыми, поэтому в первые месяцы доля «уже бывали» занижена.
        </p>
      )}
    </>
  );
}

// ─── Страница ────────────────────────────────────────────────

export function PatientsPage() {
  const [periodLabel, setPeriodLabel] = useState("Квартал");
  // по умолчанию — прошлый квартал: у его пациентов уже было время вернуться
  const [period, setPeriod] = useState<Period>(() => shiftPeriod(getDefaultPeriod("quarter"), -1));
  const [noshows, setNoshows] = useState<NoshowsResponse | null>(null);
  const [returns, setReturns] = useState<ReturnsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateFrom = toDateStr(period.dateFrom);
  const dateTo = toDateStr(period.dateTo);
  const yesterday = toDateStr(addDays(new Date(), -1));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [n, r] = await Promise.all([fetchNoshows(dateFrom, dateTo), fetchReturns(dateFrom, dateTo)]);
      setNoshows(n); setReturns(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Пациенты"
        periodItems={PERIODS}
        period={periodLabel}
        onPeriod={l => { setPeriodLabel(l); setPeriod(getDefaultPeriod(P_MAP[l] ?? "quarter")); }}
        periodLabel={formatPeriodLabel(period)}
        onPrev={() => setPeriod(p => shiftPeriod(p, -1))}
        onNext={() => setPeriod(p => shiftPeriod(p, 1))}
        nextDisabled={toDateStr(period.dateTo) >= yesterday}
        onRefresh={load}
      />
      <PageContent>
        {error && <ErrorBanner message={error} />}
        {loading ? (
          <>
            <SkeletonCards cols={4} />
            <Skeleton className="h-60" />
            <SkeletonCards cols={4} />
            <Skeleton className="h-60" />
          </>
        ) : !noshows || !returns || (noshows.total.appointments === 0 && returns.patients === 0) ? (
          <Empty />
        ) : (
          <>
            <h2 className="px-1 pt-1 text-[15px] font-extrabold tracking-[-0.02em]">Неявки</h2>
            <NoshowSection data={noshows} />
            <h2 className="px-1 pt-3 text-[15px] font-extrabold tracking-[-0.02em]">Повторные визиты</h2>
            <ReturnsSection data={returns} />
          </>
        )}
      </PageContent>
    </div>
  );
}
