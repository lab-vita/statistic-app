"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fmtRub, type SalesByCategoryResponse } from "@/lib/api";
import { Delta, SectionCard, SparkLine, Th, Td } from "@/components/ui/primitives";
import { useChartTheme } from "@/components/charts/base-chart";
import { cn } from "@/lib/utils";

/**
 * Выручка по направлениям (верхний уровень категорий услуг) и услуги в динамике.
 * Цвета направлений — фиксированный порядок по убыванию выручки, проверен
 * на различимость для дальтоников; седьмое и дальше — в «Остальные».
 */
export const CATEGORY_COLORS = ["#328fcd", "#1a9e6e", "#c98418", "#8b5cf6", "#0a9fb8", "#db2777"];
const OTHER_COLOR = "#94b3c9";
const OTHER = "Остальные";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function periodLabel(iso: string, g: SalesByCategoryResponse["granularity"]): string {
  const d = new Date(`${iso}T00:00:00`);
  if (g === "month") return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  if (g === "week") return `с ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const STEP_LABEL = { day: "по дням", week: "по неделям", month: "по месяцам" } as const;

const short = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} млн` :
  n >= 1_000 ? `${Math.round(n / 1_000)} тыс` : String(Math.round(n));

export function CategoryTrendCard({ data }: { data: SalesByCategoryResponse }) {
  const ct = useChartTheme();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // Шесть крупнейших направлений по своим цветам, остальные — одной серией
  const { series, rows } = useMemo(() => {
    const top = data.categories.slice(0, CATEGORY_COLORS.length);
    const rest = data.categories.slice(CATEGORY_COLORS.length);
    const s = top.map((c, i) => ({ key: c.title, color: CATEGORY_COLORS[i], values: c.series }));
    if (rest.length) {
      s.push({
        key: OTHER, color: OTHER_COLOR,
        values: data.periods.map((_, i) => rest.reduce((sum, c) => sum + (c.series[i] ?? 0), 0)),
      });
    }
    const r = data.periods.map((p, i) => {
      const row: Record<string, string | number> = { period: periodLabel(p, data.granularity) };
      s.forEach(x => { row[x.key] = x.values[i] ?? 0; });
      return row;
    });
    return { series: s, rows: r };
  }, [data]);

  const colorOf = (title: string, i: number) => (i < CATEGORY_COLORS.length ? CATEGORY_COLORS[i] : OTHER_COLOR);
  const toggle = (key: string) =>
    setHidden(h => { const n = new Set(h); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  return (
    <SectionCard
      title="Выручка по направлениям"
      right={<span>{fmtRub(data.total.sum)} · {STEP_LABEL[data.granularity]}</span>}
      noPad
    >
      {/* Легенда-фильтр: клик прячет направление на графике */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-5 pb-2">
        {series.map(s => (
          <button
            key={s.key} type="button" onClick={() => toggle(s.key)}
            aria-pressed={!hidden.has(s.key)}
            className={cn("inline-flex items-center gap-1.5 rounded-[5px] px-1 py-0.5 text-[11.5px] font-medium text-text-2 transition-opacity hover:bg-accent",
              hidden.has(s.key) && "opacity-40")}
          >
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.key}
          </button>
        ))}
      </div>
      <div className="px-2 sm:px-3">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false}
              interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} width={52}
              tickFormatter={v => short(Number(v))} />
            <Tooltip
              {...ct.tooltip}
              cursor={{ fill: ct.cursor }}
              formatter={(v, name) => [fmtRub(Number(v)), String(name)]}
              itemSorter={item => -Number(item.value ?? 0)}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key} dataKey={s.key} stackId="cat" fill={s.color} hide={hidden.has(s.key)}
                stroke={ct.dark ? "#112131" : "#ffffff"} strokeWidth={1}
                radius={i === series.length - 1 ? [3, 3, 0, 0] : 0} maxBarSize={44}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Таблица — точные суммы, доля и изменение к прошлому периоду */}
      <div className="mt-2 overflow-x-auto border-t border-hairline">
        <table className="w-full border-collapse [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead>
            <tr>
              <Th>Направление</Th>
              <Th right>Выручка</Th>
              <Th right>Доля</Th>
              <Th right>К прошлому</Th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((c, i) => (
              <tr key={c.title} className="transition-colors hover:bg-accent/60">
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colorOf(c.title, i) }} />
                    <span className="font-semibold">{c.title}</span>
                  </span>
                </Td>
                <Td right bold>{fmtRub(c.total)}</Td>
                <Td right>
                  <span className="inline-flex items-center justify-end gap-2">
                    <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-border sm:block">
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(c.share, 100)}%`, background: colorOf(c.title, i) }} />
                    </span>
                    <span className="min-w-[40px] text-right text-[12px] font-semibold tabular-nums">{c.share.toFixed(1)}%</span>
                  </span>
                </Td>
                <Td right>
                  {c.prev_total ? <Delta dir={c.delta_dir} pct={c.delta_pct} /> : <span className="text-[11px] text-text-3">новое</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export function ServicesTrendCard({ data }: { data: SalesByCategoryResponse }) {
  const colorByCat = new Map(data.categories.map((c, i) => [c.title, i < CATEGORY_COLORS.length ? CATEGORY_COLORS[i] : OTHER_COLOR]));
  return (
    <SectionCard title="Услуги в динамике" right={`топ ${data.services.length} · ${STEP_LABEL[data.granularity]}`} noPad>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead>
            <tr>
              <Th>Услуга</Th>
              <Th right>Динамика</Th>
              <Th right>Выручка</Th>
              <Th right>Доля</Th>
              <Th right>К прошлому</Th>
            </tr>
          </thead>
          <tbody>
            {data.services.map(s => (
              <tr key={s.title} className="transition-colors hover:bg-accent/60">
                <Td>
                  <div className="max-w-[clamp(160px,36vw,420px)]">
                    <span className="block truncate text-[13px] font-medium" title={s.title}>{s.title}</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-text-3">
                      <span className="h-2 w-2 rounded-[2px]" style={{ background: colorByCat.get(s.category) ?? OTHER_COLOR }} />
                      {s.category}
                    </span>
                  </div>
                </Td>
                <Td right>
                  <span className="inline-flex justify-end">
                    <SparkLine values={s.series} color="#328fcd" width={88} height={26} />
                  </span>
                </Td>
                <Td right bold>{fmtRub(s.total)}</Td>
                <Td right><span className="text-[12px] font-semibold tabular-nums text-text-2">{s.share.toFixed(1)}%</span></Td>
                <Td right><Delta dir={s.delta_dir} pct={s.delta_pct} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
