"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useChartTheme } from "@/components/charts/base-chart";
import { CATEGORY_COLORS } from "@/components/revenue-categories";
import { TabGroup } from "@/components/ui/primitives";
import {
  ROW_COMPARE_LABEL, fmtAxis, fmtDate, fmtValue,
  type Better, type DeltaInfo, type MetricInfo, type ReportResult, type ReportRow,
} from "@/lib/report-builder";
import { cn } from "@/lib/utils";

const BRAND = "#328fcd";
const PREV = "#94b3c9";
const OTHER = "#94b3c9";
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
/** Группировки с естественным порядком — их не сортируем по величине */
const ORDERED = new Set(["period", "weekday", "hour"]);
const ADDITIVE = new Set(["count", "rub", "min"]);

// ─── Изменение ───────────────────────────────────────────────────────

export function DeltaChip({ d, better, className }: { d?: DeltaInfo; better: Better; className?: string }) {
  if (!d || d.pct == null || !d.dir) return <span className={cn("text-[10.5px] text-text-3", className)}>—</span>;
  const sign = d.dir === "up" ? "+" : d.dir === "down" ? "−" : "";
  const good = d.dir === "flat" || !better ? null : (d.dir === "up") === (better === "up");
  return (
    <span className={cn(
      "inline-flex rounded-[4px] px-1 py-px text-[10.5px] font-bold tabular-nums",
      good === true ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : good === false ? "bg-red-500/10 text-red-600 dark:text-red-400"
        : "bg-accent text-text-2",
      className,
    )}>
      {sign}{d.pct}%
    </span>
  );
}

// ─── Итоги ───────────────────────────────────────────────────────────

export function TotalsTiles({ rep }: { rep: ReportResult }) {
  const cols = rep.metrics.length <= 2 ? "sm:grid-cols-2" : rep.metrics.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-3 xl:grid-cols-4";
  return (
    <div className={cn("grid grid-cols-2 gap-3", cols)}>
      {rep.metrics.map(m => (
        <div key={m.key} className="card-surface @container min-w-0 px-4 py-3.5">
          <p className="metric-label truncate" title={m.label}>{m.label}</p>
          <p className="mt-1.5 text-[length:min(26px,13cqw)] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
            {fmtValue(rep.totals.values[m.key], m.unit)}
          </p>
          {rep.prev_from && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] text-text-3">
              <DeltaChip d={rep.totals.delta[m.key]} better={m.better} />
              <span className="truncate">было {fmtValue(rep.totals.prev?.[m.key], m.unit)}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── График ──────────────────────────────────────────────────────────

function periodShort(iso: string, g: ReportResult["granularity"]) {
  const d = new Date(`${iso}T00:00:00`);
  if (g === "month") return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function rowName(rep: ReportResult, r: ReportRow, i: number) {
  return rep.dimensions[i]?.key === "period" ? periodShort(r.keys[i], rep.granularity) : r.labels[i];
}

export function ReportChart({ rep }: { rep: ReportResult }) {
  const ct = useChartTheme();
  const [metricKey, setMetricKey] = useState(rep.metrics[0].key);
  const m = rep.metrics.find(x => x.key === metricKey) ?? rep.metrics[0];
  const dims = rep.dimensions;
  if (!dims.length || !rep.rows.length) return null;

  const tooltip = (v: unknown) => fmtValue(Number(v), m.unit);
  const axis = { tick: { fontSize: 10.5, fill: ct.axis }, axisLine: false, tickLine: false } as const;
  const periodPos = dims.findIndex(d => d.key === "period");

  let body: React.ReactNode;
  let note: string | null = null;

  if (dims.length === 1 && (periodPos === 0 || ORDERED.has(dims[0].key))) {
    // По времени или по дням недели / часам — вертикальные столбики в естественном порядке
    const data = rep.rows.map((r, i) => ({
      name: rowName(rep, r, 0),
      full: r.labels[0],
      value: r.values[m.key] ?? 0,
      prev: rep.prev_series?.[i]?.[m.key],
    }));
    const hasPrev = !!rep.prev_series;
    const line = data.length > 45;
    body = (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
          <XAxis dataKey="name" {...axis} interval="preserveStartEnd" minTickGap={14} />
          <YAxis {...axis} width={56} tickFormatter={v => fmtAxis(Number(v), m.unit)} />
          <Tooltip {...ct.tooltip} cursor={{ fill: ct.cursor }}
            labelFormatter={(_l, p) => (p?.[0]?.payload as { full?: string })?.full ?? ""}
            formatter={(v, n) => [tooltip(v), n === "prev" ? "Прошлый период" : m.label]} />
          {line
            ? <Line dataKey="value" stroke={BRAND} strokeWidth={2} dot={false} type="monotone" />
            : <Bar dataKey="value" fill={BRAND} radius={[3, 3, 0, 0]} maxBarSize={36} />}
          {hasPrev && <Line dataKey="prev" stroke={PREV} strokeWidth={1.6} strokeDasharray="4 3" dot={false} type="monotone" />}
        </ComposedChart>
      </ResponsiveContainer>
    );
    if (hasPrev) note = "пунктир — прошлый период";
  } else if (dims.length === 2 && periodPos >= 0) {
    // Период + другая группировка: серии по второй группировке (шесть крупнейших)
    const other = periodPos === 0 ? 1 : 0;
    const byKey = new Map<string, number>();
    rep.rows.forEach(r => byKey.set(r.labels[other], (byKey.get(r.labels[other]) ?? 0) + (r.values[m.key] ?? 0)));
    const top = [...byKey.entries()].sort((a, b) => b[1] - a[1]).slice(0, CATEGORY_COLORS.length).map(e => e[0]);
    const additive = ADDITIVE.has(m.unit);
    const periods: { key: string; name: string; full: string }[] = [];
    const seen = new Set<string>();
    [...rep.rows].sort((a, b) => a.keys[periodPos].localeCompare(b.keys[periodPos])).forEach(r => {
      if (!seen.has(r.keys[periodPos])) {
        seen.add(r.keys[periodPos]);
        periods.push({ key: r.keys[periodPos], name: rowName(rep, r, periodPos), full: r.labels[periodPos] });
      }
    });
    const series = additive && byKey.size > top.length ? [...top, "Остальные"] : top;
    const data = periods.map(p => {
      const row: Record<string, string | number> = { name: p.name, full: p.full };
      series.forEach(s => { row[s] = 0; });
      rep.rows.filter(r => r.keys[periodPos] === p.key).forEach(r => {
        const s = top.includes(r.labels[other]) ? r.labels[other] : "Остальные";
        if (s in row) row[s] = Number(row[s]) + (r.values[m.key] ?? 0);
      });
      return row;
    });
    const color = (i: number, s: string) => (s === "Остальные" ? OTHER : CATEGORY_COLORS[i]);
    body = (
      <>
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-1">
          {series.map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-text-2">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color(i, s) }} />{s}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
            <XAxis dataKey="name" {...axis} interval="preserveStartEnd" minTickGap={14} />
            <YAxis {...axis} width={56} tickFormatter={v => fmtAxis(Number(v), m.unit)} />
            <Tooltip {...ct.tooltip} cursor={{ fill: ct.cursor }}
              labelFormatter={(_l, p) => (p?.[0]?.payload as { full?: string })?.full ?? ""}
              formatter={(v, n) => [tooltip(v), String(n)]}
              itemSorter={item => -Number(item.value ?? 0)} />
            {series.map((s, i) => additive
              ? <Bar key={s} dataKey={s} stackId="a" fill={color(i, s)} stroke={ct.dark ? "#112131" : "#ffffff"} strokeWidth={1} maxBarSize={44} />
              : <Line key={s} dataKey={s} stroke={color(i, s)} strokeWidth={2} dot={false} type="monotone" />)}
          </ComposedChart>
        </ResponsiveContainer>
      </>
    );
    if (byKey.size > top.length && !additive) note = `${top.length} крупнейших`;
  } else {
    // Всё остальное — горизонтальные столбики, 15 самых больших
    const data = [...rep.rows]
      .map(r => ({ name: r.labels.join(" · "), value: r.values[m.key] ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
    if (rep.rows.length > 15) note = `15 из ${rep.rows.length}`;
    body = (
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 28 + 30)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
          <XAxis type="number" {...axis} tickFormatter={v => fmtAxis(Number(v), m.unit)} />
          <YAxis type="category" dataKey="name" {...axis} width={150} interval={0}
            tickFormatter={(s: string) => (s.length > 24 ? `${s.slice(0, 23)}…` : s)} />
          <Tooltip {...ct.tooltip} cursor={{ fill: ct.cursor }} formatter={v => [tooltip(v), m.label]} />
          <Bar dataKey="value" fill={BRAND} radius={[0, 3, 3, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
        <h3 className="section-title">{m.label}{note && <span className="ml-2 text-[11px] font-medium text-text-3">{note}</span>}</h3>
        {rep.metrics.length > 1 && (
          <div className="max-w-full overflow-x-auto">
            <TabGroup small items={rep.metrics.map(x => x.label)} active={m.label}
              onChange={l => setMetricKey(rep.metrics.find(x => x.label === l)?.key ?? metricKey)} />
          </div>
        )}
      </div>
      <div className="px-2 pb-3 sm:px-3">{body}</div>
    </div>
  );
}

// ─── Таблица ─────────────────────────────────────────────────────────

type Sort = { col: string; dir: "asc" | "desc" } | null;

export function ReportTable({ rep }: { rep: ReportResult }) {
  const [sort, setSort] = useState<Sort>(null);
  const dims = rep.dimensions;
  const compare = !!rep.prev_from;

  const rows = useMemo(() => {
    if (!sort) return rep.rows;
    const out = [...rep.rows];
    const dimIdx = dims.findIndex(d => d.key === sort.col);
    out.sort((a, b) => {
      const c = dimIdx >= 0
        ? (dims[dimIdx].key === "period" ? a.keys[dimIdx].localeCompare(b.keys[dimIdx]) : a.labels[dimIdx].localeCompare(b.labels[dimIdx], "ru"))
        : (a.values[sort.col] ?? 0) - (b.values[sort.col] ?? 0);
      return sort.dir === "asc" ? c : -c;
    });
    return out;
  }, [rep.rows, sort, dims]);

  const cycle = (col: string, numeric: boolean) => setSort(s =>
    !s || s.col !== col ? { col, dir: numeric ? "desc" : "asc" }
      : s.dir === (numeric ? "desc" : "asc") ? { col, dir: numeric ? "asc" : "desc" } : null);

  if (!dims.length) return null;
  const cmpLabel = rep.row_compare === "bucket" ? ROW_COMPARE_LABEL[rep.granularity] : "к прошлому периоду";

  const head = (col: string, label: string, numeric: boolean) => {
    const active = sort?.col === col;
    const Icon = !active ? ChevronsUpDown : sort!.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th key={col} className={cn(
        "sticky top-0 z-10 whitespace-nowrap border-b border-hairline bg-card px-3 py-2 text-[10px] font-bold uppercase tracking-[.06em] text-text-3 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5",
        numeric ? "text-right" : "text-left",
      )}>
        <button type="button" onClick={() => cycle(col, numeric)}
          className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", active && "text-brand")}>
          {label}
          <Icon className={cn("h-3 w-3", !active && "opacity-40")} strokeWidth={2.2} />
        </button>
      </th>
    );
  };

  const cell = (m: MetricInfo, values: Record<string, number>, delta: Record<string, DeltaInfo>, bold = false) => (
    <td key={m.key} className="whitespace-nowrap px-3 py-2 text-right align-top last:pr-4 sm:last:pr-5">
      <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
        <span className={cn("text-[12.5px] tabular-nums", bold ? "font-extrabold" : "font-semibold")}>{fmtValue(values[m.key], m.unit)}</span>
        {compare && <DeltaChip d={delta[m.key]} better={m.better} className="sm:min-w-[44px] sm:justify-center" />}
      </div>
    </td>
  );

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
        <h3 className="section-title">Таблица</h3>
        <span className="text-[11px] text-text-3">
          {rep.rows.length.toLocaleString("ru-RU")} {plural(rep.rows.length, "строка", "строки", "строк")}
          {compare && ` · изменение ${cmpLabel}`}
        </span>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {dims.map(d => head(d.key, d.label, false))}
              {rep.metrics.map(m => head(m.key, m.label, true))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const repeat = !sort && dims.length > 1 && idx > 0 && rows[idx - 1].labels[0] === r.labels[0];
              const groupStart = !sort && dims.length > 1 && idx > 0 && !repeat;
              return (
                <tr key={r.keys.join("|")} className={cn("transition-colors hover:bg-accent/50", groupStart && "border-t border-border")}>
                  {r.labels.map((l, i) => (
                    <td key={i} className={cn(
                      "max-w-[280px] px-3 py-2 align-top text-[12.5px] first:pl-4 sm:first:pl-5",
                      i === 0 && dims.length > 1 ? "font-semibold" : "font-medium",
                    )}>
                      {i === 0 && repeat ? "" : <span className="line-clamp-2" title={l}>{l}</span>}
                    </td>
                  ))}
                  {rep.metrics.map(m => cell(m, r.values, r.delta))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-accent/50">
              <td colSpan={dims.length} className="px-3 py-2.5 align-top text-[12.5px] font-extrabold first:pl-4 sm:first:pl-5">Итого</td>
              {rep.metrics.map(m => cell(m, rep.totals.values, rep.totals.delta, true))}
            </tr>
          </tfoot>
        </table>
      </div>
      {rep.truncated && (
        <p className="border-t border-hairline px-5 py-2.5 text-[11px] text-amber-600 dark:text-amber-400">
          Показаны первые 500 строк — сузьте отчёт фильтрами или группировкой.
        </p>
      )}
    </div>
  );
}

export function CompareNote({ rep }: { rep: ReportResult }) {
  if (!rep.prev_from || !rep.prev_to) return null;
  const prev = `${fmtDate(rep.prev_from)} — ${fmtDate(rep.prev_to)}`;
  const unit = { day: "предыдущим днём", week: "предыдущей неделей", month: "предыдущим месяцем" }[rep.granularity];
  return (
    <p className="px-1 text-[11px] leading-relaxed text-text-3">
      {rep.row_compare === "bucket"
        ? `Изменение в строках — по сравнению с ${unit}; в итогах — с периодом ${prev}`
        : `Изменение — по сравнению с периодом ${prev} той же длины`}
    </p>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}
