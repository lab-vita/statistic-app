"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchStats, fetchHourly, fetchDaily, fetchHeatmap, fetchConversion,
  fetchOperators, toDateStr, addDays, formatDuration,
  type StatsResponse, type HourlyResponse, type DailyResponse,
  type HeatmapResponse, type ConversionResponse, type Operator,
} from "@/lib/api";
import { getDefaultPeriod, shiftPeriod, formatPeriodLabel, type Period, type PeriodType } from "@/lib/periods";
import {
  Topbar, PageContent, MetricCard, SectionCard,
  Delta, StatusPill, ProgressBar, TabGroup,
  Th, Td, SkeletonCards, Skeleton, Empty, ErrorBanner, SrcBar,
} from "@/components/ui/primitives";
import { CallsTimeChart } from "@/components/charts/calls-time-chart";
import { HeatmapChart }   from "@/components/charts/heatmap-chart";
import { cn } from "@/lib/utils";

const PERIODS = ["День","Неделя","Месяц","Квартал","Год","Период"];
const P_MAP: Record<string, PeriodType> = {
  "День":"day","Неделя":"week","Месяц":"month","Квартал":"quarter","Год":"year","Период":"custom"
};
const PROFOSMOTR = new Set(["544"]);

function fmt(n: number) { return n.toLocaleString("ru-RU"); }
function fmtPct(n: number) { return n.toFixed(1) + "%"; }

function CallsFunnel({ s }: { s: ReturnType<typeof buildTotal> }) {
  const segs1 = [
    { v: s.incoming, c: "#16a34a" },
    { v: s.missed,   c: "#f59e0b" },
  ];
  const segs2 = [
    { v: s.outcome_reached, c: "#16a34a" },
    { v: s.outcome_self,    c: "#2563eb" },
    { v: s.outcome_failed,  c: "#f59e0b" },
    { v: s.outcome_none,    c: "#dc2626" },
  ];
  return (
    <SectionCard title="Судьба звонков" right={`поступило ${fmt(s.received)}`}>
      <div className="space-y-3">
        {/* Bar 1 */}
        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground/60 mb-1.5">
            <span>Принято / Пропущено</span>
            <span className="tabular-nums">{fmt(s.received)}</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-border gap-px">
            {segs1.map((sg, i) => (
              <div key={i} style={{ width: `${s.received > 0 ? sg.v/s.received*100 : 0}%`, background: sg.c }}
                className="transition-all duration-500" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 mt-2">
            {[
              { c:"#16a34a", l:"Принято",   v:s.incoming, p:fmtPct(s.received>0?s.incoming/s.received*100:0) },
              { c:"#f59e0b", l:"Пропущено", v:s.missed,   p:fmtPct(s.missed_pct) },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.c }} />
                <span className="text-muted-foreground/60 flex-1">{row.l}</span>
                <span className="font-bold tabular-nums">{fmt(row.v)}</span>
                <span className="text-muted-foreground/50">{row.p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar 2 */}
        {s.missed > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="flex justify-between text-[11px] text-muted-foreground/60 mb-1.5">
              <span>Из {fmt(s.missed)} пропущенных</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-border gap-px">
              {segs2.map((sg, i) => (
                <div key={i} style={{ width: `${s.missed>0?sg.v/s.missed*100:0}%`, background: sg.c }}
                  className="transition-all duration-500" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-4 mt-2">
              {[
                { c:"#16a34a", l:"Перезв., дозв.",  v:s.outcome_reached, p:fmtPct(s.missed>0?s.outcome_reached/s.missed*100:0) },
                { c:"#2563eb", l:"Клиент сам",       v:s.outcome_self,    p:fmtPct(s.missed>0?s.outcome_self/s.missed*100:0) },
                { c:"#f59e0b", l:"Перезв., нет",     v:s.outcome_failed,  p:fmtPct(s.missed>0?s.outcome_failed/s.missed*100:0) },
                { c:"#dc2626", l:"Не перезвонили",   v:s.outcome_none,    p:fmtPct(s.missed>0?s.outcome_none/s.missed*100:0) },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.c }} />
                  <span className="text-muted-foreground/60 flex-1">{row.l}</span>
                  <span className="font-bold tabular-nums">{fmt(row.v)}</span>
                  <span className="text-muted-foreground/50">{row.p}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Итог */}
        <div className="pt-3 border-t border-border flex justify-between items-end">
          <div>
            <p className="text-[11px] text-muted-foreground/60 mb-1">Потеряно навсегда</p>
            <p className="text-[30px] font-black tabular-nums leading-none text-red-600 dark:text-red-400 tracking-tight">
              {fmt(s.lost)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold tabular-nums">{fmtPct(s.lost_pct)}</p>
            <p className="text-[11px] text-muted-foreground/60">от поступивших</p>
            <div className="mt-1.5">
              <Delta dir={s.lost_delta_dir} pct={s.lost_delta_pct} invert />
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function buildTotal(stats: StatsResponse, opId: string | null) {
  const key = opId && stats.operators[opId] ? opId : "total";
  return stats.operators[key];
}

export function CallsPage() {
  const [periodLabel, setPeriodLabel] = useState("День");
  const [period,      setPeriod]      = useState<Period>(getDefaultPeriod("day"));
  const [interval,    setInterval]    = useState(60);
  const [opId,        setOpId]        = useState<string | null>(null);
  const [opMenuOpen,  setOpMenuOpen]  = useState(false);
  const [operators,   setOperators]   = useState<Operator[]>([]);

  const [stats,      setStats]      = useState<StatsResponse | null>(null);
  const [hourly,     setHourly]     = useState<HourlyResponse | null>(null);
  const [daily,      setDaily]      = useState<DailyResponse | null>(null);
  const [heatmap,    setHeatmap]    = useState<HeatmapResponse | null>(null);
  const [conversion, setConversion] = useState<ConversionResponse | null>(null);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const isDay = period.type === "day";
  const dateFrom = toDateStr(period.dateFrom);
  const dateTo   = toDateStr(period.dateTo);
  const yesterday = toDateStr(addDays(new Date(), -1));

  useEffect(() => {
    fetchOperators().then(r => setOperators(r.operators)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, hm, conv] = await Promise.all([
        fetchStats(dateFrom, dateTo, opId ?? undefined),
        fetchHeatmap(dateFrom, dateTo, opId ?? undefined),
        !opId ? fetchConversion(dateFrom, dateTo) : Promise.resolve(null),
      ]);
      setStats(s); setHeatmap(hm); setConversion(conv);

      if (isDay) {
        const h = await fetchHourly(dateFrom, dateTo, interval, opId ?? undefined);
        setHourly(h); setDaily(null);
      } else {
        const d = await fetchDaily(dateFrom, dateTo, opId ?? undefined);
        setDaily(d); setHourly(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally { setLoading(false); }
  }, [dateFrom, dateTo, isDay, interval, opId]);

  useEffect(() => { load(); }, [load]);

  function handlePeriod(label: string) {
    const type = P_MAP[label] ?? "day";
    setPeriodLabel(label);
    setPeriod(getDefaultPeriod(type));
  }

  function handlePrev() { setPeriod(p => shiftPeriod(p, -1)); }
  function handleNext() { setPeriod(p => shiftPeriod(p, 1)); }

  const s     = stats ? buildTotal(stats, opId) : null;
  const opName = opId ? operators.find(o => o.id === opId)?.name.split(" ")[0] ?? "Оператор" : "Все операторы";
  const rows   = stats ? Object.entries(stats.operators).filter(([k]) => k !== "total") : [];
  const total  = stats?.operators["total"];

  const MISSED_THRESHOLD = 6;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Звонки"
        filterLabel={opName}
        onFilterClick={() => setOpMenuOpen(v => !v)}
        periodItems={PERIODS}
        period={periodLabel}
        onPeriod={handlePeriod}
        periodLabel={formatPeriodLabel(period)}
        onPrev={handlePrev}
        onNext={handleNext}
        nextDisabled={toDateStr(period.dateTo) >= yesterday}
        onRefresh={load}
        refreshing={refreshing}
      />

      {/* Operator dropdown */}
      {opMenuOpen && (
        <div className="absolute top-[100px] left-[216px] z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
          <button onClick={() => { setOpId(null); setOpMenuOpen(false); }}
            className={cn("w-full px-3 py-1.5 text-left text-[12px] hover:bg-accent transition-colors", !opId && "font-semibold")}>
            Все операторы
          </button>
          <div className="h-px bg-border mx-2 my-1" />
          {operators.map(op => (
            <button key={op.id} onClick={() => { setOpId(op.id); setOpMenuOpen(false); }}
              className={cn("w-full px-3 py-1.5 text-left text-[12px] hover:bg-accent transition-colors", opId === op.id && "font-semibold")}>
              {op.name}
            </button>
          ))}
        </div>
      )}

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <>
            <SkeletonCards cols={4} />
            <SkeletonCards cols={3} count={3} />
            <Skeleton className="h-64" />
          </>
        ) : !s ? (
          <Empty />
        ) : (
          <>
            {/* Row 1: 4 cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                label="Принятые" value={fmt(s.incoming)} valueClass="text-emerald-600 dark:text-emerald-400"
                sub={`из ${fmt(s.received)} поступивших`}
                deltaDir={s.incoming_delta_dir} deltaPct={s.incoming_delta_pct}
              />
              <MetricCard
                label="Исходящие" value={fmt(s.outgoing)} valueClass="text-blue-600 dark:text-blue-400"
                sub="совершённые звонки"
                deltaDir={s.outgoing_delta_dir} deltaPct={s.outgoing_delta_pct}
              />
              <MetricCard
                label="Пропущенные" value={fmt(s.missed)} valueClass="text-red-600 dark:text-red-400"
                sub={`${fmtPct(s.missed_pct)} от поступивших`}
                planPct={Math.round(s.missed_pct / MISSED_THRESHOLD * 100)}
                planLabel={`порог ≤ ${MISSED_THRESHOLD}%`}
                planInvert
                deltaDir={s.missed_delta_dir} deltaPct={s.missed_delta_pct} invert
              />
              <MetricCard
                label="Ср. разговор" value={formatDuration(s.avg_duration)}
                sub="успешные звонки"
                deltaDir={s.avg_duration_delta_dir} deltaPct={s.avg_duration_delta_pct}
              />
            </div>

            {/* Row 2: 3 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricCard
                label="Ср. ожидание" value={formatDuration(s.avg_wait_time)}
                valueClass="text-amber-600 dark:text-amber-400"
                sub="клиент ждал до сброса"
              />
              <MetricCard
                label="Перезвонили" value={`${s.callback_count} / ${s.missed_total}`}
                sub={`${s.callback_pct}% пропущенных`}
                deltaDir={s.callback_pct_delta_dir} deltaPct={s.callback_pct_delta_pct}
              />
              <MetricCard
                label="Ср. реакция" value={s.avg_reaction_sec ? formatDuration(s.avg_reaction_sec) : "—"}
                sub="до первого перезвона"
                deltaDir={s.avg_reaction_sec_delta_dir} deltaPct={s.avg_reaction_sec_delta_pct} invert
              />
            </div>

            {/* Time chart */}
            <CallsTimeChart
              hourly={hourly?.slots}
              daily={daily?.days}
              isDay={isDay}
              interval={interval}
              onInterval={setInterval}
            />

            {/* Funnel + Conversion */}
            {!opId && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <CallsFunnel s={s} />

                {conversion && conversion.operators.length > 0 && (
                  <SectionCard title="Конверсия звонок → запись" right="только колл-центр">
                    <div className="space-y-4">
                      {conversion.operators.map(op => (
                        <div key={op.operator_id}>
                          <div className="flex justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium">{op.surname}</span>
                              <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                                {op.incoming} прин. → {op.appointments} зап.
                              </span>
                            </div>
                            <span className={cn(
                              "text-[13px] font-bold tabular-nums",
                              op.conversion_pct >= 70 ? "text-emerald-600 dark:text-emerald-400"
                              : op.conversion_pct >= 40 ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                            )}>
                              {op.conversion_pct}%
                            </span>
                          </div>
                          <ProgressBar pct={Math.min(op.conversion_pct, 100)} />
                        </div>
                      ))}
                      <div className="pt-3 border-t border-border flex justify-between items-center">
                        <span className="text-[13px] font-semibold">Итого</span>
                        <span className={cn(
                          "text-[15px] font-black tabular-nums",
                          conversion.total.conversion_pct >= 70 ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                        )}>
                          {conversion.total.conversion_pct}%
                        </span>
                      </div>
                    </div>
                  </SectionCard>
                )}
              </div>
            )}

            {/* Heatmap */}
            {heatmap && heatmap.cells.length > 0 && (
              <HeatmapChart cells={heatmap.cells} />
            )}

            {/* Operators table */}
            {!opId && total && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-[13px] font-semibold">По операторам</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <Th>Оператор</Th>
                        <Th right>Принятые</Th>
                        <Th right>Исходящие</Th>
                        <Th right>Пропущенные</Th>
                        <Th right>Всего</Th>
                        <Th right>Ср. разговор</Th>
                        <Th right>Перезвонили</Th>
                        <Th right>Ср. реакция</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([id, op]) => {
                        const plain = PROFOSMOTR.has(id);
                        return (
                          <tr key={id} className="hover:bg-muted/40 transition-colors">
                            <Td>
                              <span className="font-semibold">{op.name.split(" ")[0]}</span>
                              {" "}
                              <span className="text-[11px] text-muted-foreground/50">
                                {op.name.split(" ").slice(1).join(" ")}
                              </span>
                              {plain && (
                                <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                                  профосмотры
                                </span>
                              )}
                            </Td>
                            <Td right color="#16a34a" bold>{op.incoming}</Td>
                            <Td right color="#2563eb">{op.outgoing}</Td>
                            <Td right>
                              {plain ? (
                                <span className="text-muted-foreground/60 tabular-nums">{op.missed}</span>
                              ) : (
                                <StatusPill color={op.missed_pct > 10 ? "red" : op.missed_pct > 6 ? "amber" : "green"}>
                                  {op.missed} ({fmtPct(op.missed_pct)})
                                </StatusPill>
                              )}
                            </Td>
                            <Td right>{op.total}</Td>
                            <Td right muted>{formatDuration(op.avg_duration)}</Td>
                            <Td right>
                              {plain ? (
                                <span className="text-muted-foreground/60 tabular-nums">{op.callback_count}/{op.missed_total}</span>
                              ) : (
                                <StatusPill color={op.callback_pct >= 80 ? "green" : op.callback_pct >= 50 ? "amber" : "red"}>
                                  {op.callback_count}/{op.missed_total} ({op.callback_pct}%)
                                </StatusPill>
                              )}
                            </Td>
                            <Td right muted>{op.avg_reaction_sec ? formatDuration(op.avg_reaction_sec) : "—"}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 border-t border-border">
                        <Td bold>Итого</Td>
                        <Td right color="#16a34a" bold>{total.incoming}</Td>
                        <Td right color="#2563eb">{total.outgoing}</Td>
                        <Td right>
                          <StatusPill color={total.missed_pct > 10 ? "red" : total.missed_pct > 6 ? "amber" : "green"}>
                            {total.missed} ({fmtPct(total.missed_pct)})
                          </StatusPill>
                        </Td>
                        <Td right bold>{total.total}</Td>
                        <Td right muted>{formatDuration(total.avg_duration)}</Td>
                        <Td right>
                          <StatusPill color={total.callback_pct >= 80 ? "green" : total.callback_pct >= 50 ? "amber" : "red"}>
                            {total.callback_count}/{total.missed_total} ({total.callback_pct}%)
                          </StatusPill>
                        </Td>
                        <Td right muted>{total.avg_reaction_sec ? formatDuration(total.avg_reaction_sec) : "—"}</Td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </PageContent>
    </div>
  );
}
