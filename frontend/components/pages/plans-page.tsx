"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, RotateCcw, Save } from "lucide-react";
import {
  PageContent, PageHeader, HeaderControls, HeaderDivider, DateNav, RefreshButton, Skeleton, ErrorBanner, TabGroup,
} from "@/components/ui/primitives";
import {
  VERDICT_BAR, VERDICT_TEXT, WEEKDAYS, dayTitle, distribute, draftFrom, fetchPlanOverview, fmtPlan, fmtShort,
  isWorking, monthDays, monthTitle, sameDraft, savePlanOverview, sumProgress, verdictOf, weekdayOf,
  type PlanDraft, type PlanMetric, type PlanOverview,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Планы. Сверху — выполнение по каждому показателю (факт, план, прогноз),
 * справа — план на месяц: цифры, рабочие дни; ниже — календарь месяца по
 * выбранному показателю. План вводится цифрой на месяц и сам раскладывается
 * по рабочим дням; день можно поправить или сделать выходным в календаре.
 */

const now = new Date();

export function PlansPage() {
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [ov, setOv] = useState<PlanOverview | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [metricKey, setMetricKey] = useState("calls_incoming");
  const [day, setDay] = useState<string | null>(null);
  const [pendingYm, setPendingYm] = useState<{ year: number; month: number } | null>(null);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true); setError(null);
    try {
      const res = await fetchPlanOverview(y, m);
      setOv(res);
      setDraft(draftFrom(res));
      setDay(null);
      setMetricKey(k => (res.metrics.some(x => x.key === k) ? k : res.metrics[0]?.key ?? k));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить план");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(ym.year, ym.month), 0);
    return () => clearTimeout(t);
  }, [ym, load]);

  const base = useMemo(() => (ov ? draftFrom(ov) : null), [ov]);
  const dirty = !!(draft && base && !sameDraft(draft, base));
  const days = useMemo(() => monthDays(ym.year, ym.month), [ym]);

  // Раскладка по дням по текущему черновику — для карточек и календаря
  const planDays = useMemo(() => {
    if (!ov || !draft) return {} as Record<string, Record<string, number>>;
    return Object.fromEntries(ov.metrics.filter(m => m.kind === "sum").map(m => [
      m.key,
      // план, введённый раньше по дням без цифры на месяц, показываем как есть
      draft.targets[m.key] == null || (!dirty && !ov.saved) ? m.plan_days : distribute(ym.year, ym.month, draft, m.key),
    ]));
  }, [ov, draft, dirty, ym]);

  function go(delta: number) {
    const d = new Date(ym.year, ym.month - 1 + delta, 1);
    const next = { year: d.getFullYear(), month: d.getMonth() + 1 };
    if (dirty) setPendingYm(next);
    else setYm(next);
  }

  async function save(): Promise<boolean> {
    if (!draft) return false;
    setSaving(true); setError(null);
    try {
      const res = await savePlanOverview(ym.year, ym.month, draft);
      setOv(res); setDraft(draftFrom(res));
      setNotice("План сохранён — он уже в карточках, на главной и в утренней сводке");
      setTimeout(() => setNotice(null), 3000);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
      return false;
    } finally { setSaving(false); }
  }

  async function copyPrev() {
    if (!draft) return;
    const d = new Date(ym.year, ym.month - 2, 1);
    try {
      const prev = await fetchPlanOverview(d.getFullYear(), d.getMonth() + 1);
      const p = draftFrom(prev);
      if (!Object.values(p.targets).some(v => v != null)) {
        setError(`В плане на ${monthTitle(d.getFullYear(), d.getMonth() + 1).toLowerCase()} нет цифр`);
        return;
      }
      setDraft({ ...draft, workdays: p.workdays, targets: { ...draft.targets, ...p.targets }, overrides: {} });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить прошлый месяц");
    }
  }

  const metric = ov?.metrics.find(m => m.key === metricKey) ?? ov?.metrics[0];
  const canEdit = !!ov?.can_edit;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader title="Планы">
        <HeaderControls>
          <DateNav label={monthTitle(ym.year, ym.month)} onPrev={() => go(-1)} onNext={() => go(1)} />
          {canEdit && dirty && (
            <>
              <HeaderDivider />
              <button type="button" onClick={() => base && setDraft(base)} disabled={saving}
                className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-border bg-card px-2.5 text-[12px] font-semibold text-text-2 transition-colors hover:bg-accent">
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} /><span className="max-sm:sr-only">Отменить</span>
              </button>
              <button type="button" onClick={save} disabled={saving}
                className="inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-brand px-3 text-[12px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-60">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />}
                Сохранить
              </button>
            </>
          )}
          {!dirty && <RefreshButton onClick={() => load(ym.year, ym.month)} refreshing={loading} />}
        </HeaderControls>
      </PageHeader>

      <PageContent>
        {error && <ErrorBanner message={error} />}
        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2.5 text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400">
            <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} /> {notice}
          </div>
        )}
        {pendingYm && (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-2.5 text-[12.5px] font-semibold text-amber-700 dark:text-amber-400">
            <span className="mr-auto">План на {monthTitle(ym.year, ym.month).toLowerCase()} не сохранён</span>
            <button type="button" className="rounded-[6px] bg-brand px-2.5 py-1 text-[12px] text-brand-foreground hover:bg-brand-strong"
              onClick={async () => { if (await save()) { setYm(pendingYm); setPendingYm(null); } }}>
              Сохранить и перейти
            </button>
            <button type="button" className="rounded-[6px] px-2.5 py-1 text-[12px] hover:bg-amber-500/15"
              onClick={() => { setYm(pendingYm); setPendingYm(null); }}>
              Не сохранять
            </button>
            <button type="button" className="rounded-[6px] px-2.5 py-1 text-[12px] hover:bg-amber-500/15"
              onClick={() => setPendingYm(null)}>
              Остаться
            </button>
          </div>
        )}

        {loading || !ov || !draft ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
            <Skeleton className="h-[420px]" />
          </>
        ) : !ov.metrics.length ? (
          <div className="card-surface px-5 py-8 text-center text-[13px] text-text-2">
            Для планов нужен доступ хотя бы к одному разделу: звонкам, записям или выручке.
          </div>
        ) : (
          <>
            {!ov.saved && !dirty && !ov.metrics.some(m => m.target != null) && (
              <div className="card-surface flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold">План на {monthTitle(ym.year, ym.month).toLowerCase()} ещё не задан</p>
                  <p className="mt-0.5 text-[12px] text-text-3">
                    {canEdit ? "Впишите цифры на месяц справа — они сами разложатся по рабочим дням."
                             : "Его задаёт руководитель; пока здесь виден только факт."}
                  </p>
                </div>
                {canEdit && (
                  <button type="button" onClick={copyPrev}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-border bg-card px-3 text-[12px] font-semibold text-text-2 hover:bg-accent">
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.8} /> Взять из прошлого месяца
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-tour="plans-cards">
              {ov.metrics.map(m => (
                <ProgressCard key={m.key} m={m} days={days} today={ov.today} active={m.key === metric?.key}
                  target={draft.targets[m.key] ?? null} plan={planDays[m.key]}
                  onClick={() => { setMetricKey(m.key); setDay(null); }} />
              ))}
            </div>

            <div className={cn("grid items-start gap-4", canEdit && "xl:grid-cols-[minmax(0,1fr)_340px]")}>
              {metric && (
                <PlanCalendar ov={ov} draft={draft} metric={metric} days={days}
                  plan={planDays[metric.key]} canEdit={canEdit} selected={day} onSelect={setDay}
                  onMetric={k => { setMetricKey(k); setDay(null); }}
                  onDraft={setDraft} />
              )}
              {canEdit && (
                <TargetsEditor ov={ov} draft={draft} days={days} onDraft={setDraft} onCopyPrev={copyPrev} />
              )}
            </div>
          </>
        )}
      </PageContent>
    </div>
  );
}

// ─── Карточка выполнения ─────────────────────────────────────────────

function ProgressCard({ m, days, today, plan, target, active, onClick }: {
  m: PlanMetric; days: string[]; today: string; plan?: Record<string, number>; target: number | null;
  active: boolean; onClick: () => void;
}) {
  const future = days[0] > today;
  let big = "—", sub: React.ReactNode = null, barPct: number | null = null, verdict: ReturnType<typeof verdictOf> | null = null;

  if (m.kind === "sum") {
    const p = sumProgress(days, plan ?? {}, m.fact_days, today);
    big = future ? fmtPlan(p.plan || null, m.unit) : fmtPlan(p.fact, m.unit);
    if (p.state === "no-plan") {
      sub = <span>план не задан</span>;
    } else if (p.state === "upcoming") {
      sub = <span>план на месяц</span>;
    } else {
      barPct = p.factPct;
      verdict = p.verdict;
      sub = (
        <>
          <span>из {fmtPlan(p.plan, m.unit)}</span>
          {p.state === "in-progress" && p.forecast != null && (
            <span className={cn("font-semibold", verdict && VERDICT_TEXT[verdict])}>
              прогноз {fmtShort(p.forecast, m.unit)} · {Math.round(p.forecastPct ?? 0)}%
            </span>
          )}
          {p.state === "finished" && (
            <span className={cn("font-semibold", verdict && VERDICT_TEXT[verdict])}>{Math.round(p.factPct ?? 0)}% плана</span>
          )}
        </>
      );
    }
  } else {
    big = future ? "—" : fmtPlan(m.fact_total, "pct");
    if (target == null) sub = <span>цель не задана</span>;
    else {
      if (!future && m.fact_total != null) {
        verdict = verdictOf(target ? m.fact_total / target * 100 : 100);
        barPct = target ? m.fact_total / target * 100 : null;
      }
      sub = (
        <>
          <span>цель {fmtPlan(target, "pct")}</span>
          {verdict && (
            <span className={cn("font-semibold", VERDICT_TEXT[verdict])}>
              {m.fact_total! >= target ? "достигнута" : `не хватает ${fmtPlan(target - m.fact_total!, "pct")}`}
            </span>
          )}
        </>
      );
    }
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn(
        "card-surface @container min-w-0 px-4 py-3.5 text-left transition-shadow",
        active ? "outline outline-2 -outline-offset-2 outline-brand" : "hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-brand/40",
      )}>
      <p className="metric-label truncate" title={m.hint}>{m.label}</p>
      <p className="mt-1.5 text-[length:min(26px,12cqw)] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{big}</p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-accent">
        {barPct != null && (
          <div className={cn("h-full rounded-full transition-all", verdict ? VERDICT_BAR[verdict] : "bg-brand")}
            style={{ width: `${Math.min(100, Math.max(2, barPct))}%` }} />
        )}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-text-3">{sub}</p>
    </button>
  );
}

// ─── План на месяц ───────────────────────────────────────────────────

function TargetsEditor({ ov, draft, days, onDraft, onCopyPrev }: {
  ov: PlanOverview; draft: PlanDraft; days: string[];
  onDraft: (d: PlanDraft) => void; onCopyPrev: () => void;
}) {
  const working = days.filter(d => isWorking(d, draft)).length;

  function setTarget(key: string, v: number | null) {
    onDraft({ ...draft, targets: { ...draft.targets, [key]: v } });
  }
  function toggleWeekday(w: number) {
    const has = draft.workdays.includes(w);
    if (has && draft.workdays.length === 1) return;
    onDraft({ ...draft, workdays: has ? draft.workdays.filter(x => x !== w) : [...draft.workdays, w].sort() });
  }

  return (
    <section className="card-surface" data-tour="plans-editor">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-5 pb-3 pt-4">
        <h3 className="section-title">План на {monthTitle(ov.year, ov.month).toLowerCase()}</h3>
        <button type="button" onClick={onCopyPrev} title="Взять цифры и рабочие дни из прошлого месяца"
          className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[11.5px] font-semibold text-text-3 hover:bg-accent hover:text-foreground">
          <Copy className="h-3.5 w-3.5" strokeWidth={1.8} /> Как в прошлом
        </button>
      </div>

      <div className="space-y-3 px-5 py-4">
        {ov.metrics.map(m => {
          const v = draft.targets[m.key];
          const id = `plan-${m.key}`;
          return (
            <div key={m.key}>
              <div className="flex items-center gap-3">
                <label htmlFor={id} className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold leading-tight">{m.label}</span>
                  <span className="block truncate text-[10.5px] text-text-3" title={m.hint}>
                    {m.kind === "pct" ? "цель на месяц" : v != null && working
                      ? `≈ ${fmtPlan(Math.round(v / working), m.unit)} в рабочий день` : "на месяц"}
                  </span>
                </label>
                <div className="relative w-[136px] shrink-0">
                  <NumberInput id={id} value={v ?? null} onChange={x => setTarget(m.key, x)}
                    className="h-8 w-full rounded-[7px] border border-border bg-card pl-2.5 pr-7 text-right text-[13px] font-semibold tabular-nums outline-none transition-colors placeholder:font-normal placeholder:text-text-3 focus:border-brand" />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-3">
                    {m.unit === "rub" ? "₽" : m.unit === "pct" ? "%" : "шт"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-hairline px-5 py-4">
        <p className="metric-label mb-2">Рабочие дни</p>
        <div className="flex gap-1">
          {WEEKDAYS.map((w, i) => {
            const on = draft.workdays.includes(i);
            return (
              <button key={w} type="button" onClick={() => toggleWeekday(i)} aria-pressed={on}
                className={cn(
                  "h-8 flex-1 rounded-[7px] border text-[12px] font-semibold transition-colors",
                  on ? "border-brand bg-brand-soft text-brand" : "border-border bg-card text-text-3 hover:border-brand/40",
                )}>
                {w}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-text-3">
          {working} {plural(working, "рабочий день", "рабочих дня", "рабочих дней")} в месяце.
          {" "}Праздник или выходной — нажмите на день в календаре.
        </p>
      </div>
    </section>
  );
}

// ─── Календарь ───────────────────────────────────────────────────────

function PlanCalendar({ ov, draft, metric, days, plan, canEdit, selected, onSelect, onMetric, onDraft }: {
  ov: PlanOverview; draft: PlanDraft; metric: PlanMetric; days: string[]; plan?: Record<string, number>;
  canEdit: boolean; selected: string | null;
  onSelect: (d: string | null) => void; onMetric: (k: string) => void; onDraft: (d: PlanDraft) => void;
}) {
  const lead = weekdayOf(days[0]);
  const isPct = metric.kind === "pct";
  const target = draft.targets[metric.key] ?? null;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  const planTotal = isPct ? null : days.reduce((s, d) => s + (plan?.[d] ?? 0), 0);
  const factTotal = isPct ? metric.fact_total : days.reduce((s, d) => s + (metric.fact_days[d] ?? 0), 0);

  return (
    <section className="card-surface min-w-0" data-tour="plans-calendar">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
        <h3 className="section-title">По дням</h3>
        <div className="max-w-full overflow-x-auto">
          <TabGroup small items={ov.metrics.map(m => m.label)} active={metric.label}
            onChange={l => onMetric(ov.metrics.find(m => m.label === l)?.key ?? metric.key)} />
        </div>
      </div>

      <div className="px-2 pb-2 sm:px-4">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={cn("pb-1 text-center text-[10px] font-bold uppercase tracking-[.06em]",
              draft.workdays.includes(i) ? "text-text-3" : "text-text-3/50")}>{w}</div>
          ))}
          {cells.map((d, i) => d ? (
            <DayCell key={d} date={d} metric={metric} plan={plan?.[d] ?? 0} target={target}
              fact={metric.fact_days[d]} today={ov.today} working={isWorking(d, draft)}
              manual={!isPct && d in (draft.overrides[metric.key] ?? {})}
              selected={selected === d} clickable={canEdit}
              onClick={() => onSelect(selected === d ? null : d)} />
          ) : <div key={`x${i}`} />)}
        </div>
      </div>

      {canEdit && selected && (
        <DayEditor key={`${selected}|${metric.key}|${plan?.[selected] ?? 0}`} date={selected} metric={metric} draft={draft} plan={plan?.[selected] ?? 0}
          onDraft={onDraft} onClose={() => onSelect(null)} />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline px-4 py-3 text-[11.5px] text-text-3 sm:px-5">
        {isPct ? (
          <span>Факт за месяц <b className="text-foreground">{fmtPlan(factTotal, "pct")}</b>
            {target != null && <> · цель <b className="text-foreground">{fmtPlan(target, "pct")}</b></>}</span>
        ) : (
          <span>План <b className="text-foreground">{fmtPlan(planTotal, metric.unit)}</b>
            {" "}· факт <b className="text-foreground">{fmtPlan(factTotal, metric.unit)}</b></span>
        )}
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />план выполнен</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />почти</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />меньше 90%</span>
        {!isPct && <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-brand" />задан вручную</span>}
        {canEdit && !selected && <span className="ml-auto max-sm:ml-0">Нажмите на день, чтобы поправить план</span>}
      </div>
    </section>
  );
}

function DayCell({ date, metric, plan, target, fact, today, working, manual, selected, clickable, onClick }: {
  date: string; metric: PlanMetric; plan: number; target: number | null; fact?: number; today: string;
  working: boolean; manual: boolean; selected: boolean; clickable: boolean; onClick: () => void;
}) {
  const past = date < today;
  const isToday = date === today;
  const isPct = metric.kind === "pct";
  const goal = isPct ? target : plan;
  const hasFact = fact != null && (past || isToday);
  // сегодняшний день ещё идёт — его факт не красим
  const verdict = hasFact && past && goal ? verdictOf((fact! / goal) * 100) : null;
  const n = Number(date.slice(8));

  const body = (
    <>
      <span className={cn("flex items-center gap-1 text-[11px] font-bold tabular-nums",
        isToday ? "text-brand" : working ? "text-text-2" : "text-text-3/70")}>
        {n}
        {manual && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="задан вручную" />}
      </span>
      <span className={cn("mt-auto block truncate text-[12.5px] font-extrabold leading-tight tabular-nums max-sm:text-[11px]",
        verdict ? VERDICT_TEXT[verdict] : isToday ? "text-foreground" : "text-text-3/60")}>
        {hasFact ? fmtShort(fact!, metric.unit) : ""}
      </span>
      <span className="block truncate text-[10px] leading-tight tabular-nums text-text-3 max-sm:text-[9px]">
        {!isPct && plan ? `план ${fmtShort(plan, metric.unit)}` : !working ? "выходной" : isPct ? "" : "—"}
      </span>
    </>
  );
  const cls = cn(
    "flex min-h-[64px] min-w-0 flex-col items-start rounded-[8px] border px-1.5 py-1.5 text-left transition-colors sm:min-h-[72px] sm:px-2",
    working ? "border-hairline bg-card" : "border-transparent bg-accent/50",
    isToday && "border-brand/50",
    selected && "ring-2 ring-brand",
  );
  return clickable ? (
    <button type="button" onClick={onClick} className={cn(cls, "hover:border-brand/40")}
      aria-label={`${dayTitle(date)}: план ${plan}`}>{body}</button>
  ) : <div className={cls}>{body}</div>;
}

function DayEditor({ date, metric, draft, plan, onDraft, onClose }: {
  date: string; metric: PlanMetric; draft: PlanDraft; plan: number;
  onDraft: (d: PlanDraft) => void; onClose: () => void;
}) {
  const off = draft.days_off.includes(date);
  const weekdayOff = !draft.workdays.includes(weekdayOf(date));
  const over = draft.overrides[metric.key] ?? {};
  const manual = date in over;
  const [val, setVal] = useState(String(plan || ""));

  function setOverride(v: number | null) {
    const o = { ...over };
    if (v == null) delete o[date]; else o[date] = v;
    onDraft({ ...draft, overrides: { ...draft.overrides, [metric.key]: o } });
  }
  function toggleOff() {
    const days_off = off ? draft.days_off.filter(d => d !== date) : [...draft.days_off, date];
    // выходной — вручную заданные значения этого дня больше не нужны
    const overrides = off ? draft.overrides : Object.fromEntries(
      Object.entries(draft.overrides).map(([k, o]) => [k, Object.fromEntries(Object.entries(o).filter(([d]) => d !== date))]));
    onDraft({ ...draft, days_off, overrides });
  }

  return (
    <div className="mx-2 mb-3 rounded-[10px] border border-brand/30 bg-brand-soft/50 px-3 py-3 sm:mx-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-[12.5px] font-bold first-letter:uppercase">{dayTitle(date)}</p>
        <button type="button" onClick={onClose} className="rounded-[6px] px-2 py-1 text-[11.5px] font-semibold text-text-3 hover:bg-accent">
          Закрыть
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {metric.kind === "sum" && !off && !weekdayOff && (
          <>
            <label htmlFor="plan-day" className="text-[12px] text-text-2">{metric.label}, план на день</label>
            <input id="plan-day" inputMode="decimal" value={val} onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") setOverride(Math.max(0, Number(val.replace(",", ".")) || 0)); }}
              className="h-8 w-28 rounded-[7px] border border-border bg-card px-2.5 text-right text-[13px] font-semibold tabular-nums outline-none focus:border-brand" />
            <button type="button" onClick={() => setOverride(Math.max(0, Number(val.replace(",", ".")) || 0))}
              className="h-8 rounded-[7px] bg-brand px-3 text-[12px] font-semibold text-brand-foreground hover:bg-brand-strong">
              Задать
            </button>
            {manual && (
              <button type="button" onClick={() => setOverride(null)}
                className="h-8 rounded-[7px] border border-border bg-card px-3 text-[12px] font-semibold text-text-2 hover:bg-accent">
                Поровну с другими днями
              </button>
            )}
          </>
        )}
        {!weekdayOff && (
          <button type="button" onClick={toggleOff}
            className="h-8 rounded-[7px] border border-border bg-card px-3 text-[12px] font-semibold text-text-2 hover:bg-accent">
            {off ? "Сделать рабочим" : "Сделать выходным"}
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-text-3">
        {weekdayOff
          ? "Этот день недели нерабочий — включите его в «Рабочих днях», чтобы планировать."
          : off ? "Выходной: план на него не ставится, его доля переходит на рабочие дни."
          : metric.kind === "pct" ? "Процент — цель на весь месяц, по дням он не задаётся."
          : "Остаток плана месяца сам поделится между остальными рабочими днями."}
      </p>
    </div>
  );
}

/** Поле для числа: пока редактируется — как набрано, вне фокуса — с пробелами между разрядами. */
function NumberInput({ id, value, onChange, className }: {
  id: string; value: number | null; onChange: (v: number | null) => void; className?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value == null ? "" : value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }));
  return (
    <input id={id} inputMode="decimal" autoComplete="off" placeholder="—" className={className}
      value={shown}
      onFocus={() => setText(value == null ? "" : String(value).replace(".", ","))}
      onBlur={() => setText(null)}
      onChange={e => {
        const raw = e.target.value;
        setText(raw);
        const clean = raw.replace(/[\s ]/g, "").replace(",", ".");
        onChange(clean === "" ? null : Math.max(0, Number(clean) || 0));
      }} />
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}
