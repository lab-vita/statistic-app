"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Phone, CalendarCheck, Wallet, Stethoscope, Plus, X, Search, Check, ChevronLeft, Database } from "lucide-react";
import {
  PRESETS, autoTitle, defaultState, fetchDimValues,
  type BuilderState, type DimValue, type Granularity, type SourceInfo,
} from "@/lib/report-builder";
import { cn } from "@/lib/utils";

const SOURCE_ICON: Record<string, React.ElementType> = {
  calls: Phone, appointments: CalendarCheck, revenue: Wallet, sales: Stethoscope,
};

const GRANULARITY: { key: Granularity; label: string }[] = [
  { key: "auto", label: "Авто" }, { key: "day", label: "Дни" },
  { key: "week", label: "Недели" }, { key: "month", label: "Месяцы" },
];

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-t border-hairline px-4 py-3.5 first:border-t-0 sm:px-5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="metric-label">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-[4px] text-[11.5px] font-semibold transition-colors",
        active ? "border-foreground bg-foreground text-background"
               : "border-border bg-card text-text-2 hover:border-brand hover:text-brand",
      )}
    >
      {children}
    </button>
  );
}

const selectCls =
  "h-8 w-full min-w-0 rounded-[7px] border border-border bg-card px-2 text-[12px] font-medium text-foreground outline-none transition-colors focus:border-brand disabled:opacity-50";

export function BuilderPanel({ sources, state, onChange }: {
  sources: SourceInfo[];
  state: BuilderState;
  onChange: (s: BuilderState) => void;
}) {
  const src = sources.find(s => s.key === state.source) ?? sources[0];
  const set = (patch: Partial<BuilderState>) => onChange({ ...state, ...patch });

  function pickSource(key: string) {
    if (key === state.source) return;
    const next = sources.find(s => s.key === key);
    if (!next) return;
    const d = defaultState(next);
    const keepGroups = state.groupBy.filter(g => next.dimensions.some(x => x.key === g));
    onChange({
      ...d, title: "", period: state.period, compare: state.compare, granularity: state.granularity,
      groupBy: keepGroups.length ? keepGroups : d.groupBy,
    });
  }

  function toggleMetric(key: string) {
    const on = state.metrics.includes(key);
    if (on && state.metrics.length === 1) return;
    const next = on ? state.metrics.filter(k => k !== key) : [...state.metrics, key];
    set({ metrics: src.metrics.map(m => m.key).filter(k => next.includes(k)) });
  }

  function setGroup(i: 0 | 1, key: string) {
    const g = [...state.groupBy];
    if (!key) g.splice(i);
    else g[i] = key;
    const clean = g.filter(Boolean);
    if (clean.length === 2 && clean[0] === clean[1]) clean.pop();
    set({ groupBy: clean });
  }

  const hasPeriod = state.groupBy.includes("period");
  const dims = src.dimensions;
  const filterDims = dims.filter(d => d.key !== "period");

  return (
    <div className="card-surface overflow-visible">
      <Section title="Название">
        <input
          value={state.title}
          onChange={e => set({ title: e.target.value })}
          placeholder={autoTitle(state, src)}
          maxLength={200}
          aria-label="Название отчёта"
          className="h-8 w-full rounded-[7px] border border-border bg-card px-2.5 text-[12.5px] font-semibold outline-none placeholder:font-medium placeholder:text-text-3 focus:border-brand"
        />
      </Section>

      <Section title="Данные">
        <div className="grid grid-cols-2 gap-1.5">
          {sources.map(s => {
            const Icon = SOURCE_ICON[s.key] ?? Database;
            const active = s.key === state.source;
            return (
              <button
                key={s.key} type="button" onClick={() => pickSource(s.key)} aria-pressed={active} title={s.hint}
                className={cn(
                  "flex items-center gap-2 rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-semibold transition-colors",
                  active ? "border-brand bg-brand-soft text-brand"
                         : "border-border bg-card text-text-2 hover:border-brand/50 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                <span className="min-w-0 leading-tight">{s.label}</span>
              </button>
            );
          })}
        </div>
        {src.options.map(o => (
          <div key={o.key} className="mt-3">
            <p className="mb-1.5 text-[11px] text-text-3">{o.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {o.values.map(v => (
                <Chip key={v.value} active={(state.options[o.key] ?? o.default) === v.value}
                  onClick={() => set({ options: { ...state.options, [o.key]: v.value } })}>
                  {v.label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Период">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <Chip key={p.key} active={state.period.preset === p.key}
              onClick={() => set({ period: p.key === "custom"
                ? { preset: "custom", ...(state.period.preset === "custom" ? state.period : {}) }
                : { preset: p.key } })}>
              {p.label}
            </Chip>
          ))}
        </div>
        {state.period.preset === "custom" && <CustomDates state={state} onChange={set} />}
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px] font-medium text-text-2">
          <input type="checkbox" checked={state.compare} onChange={e => set({ compare: e.target.checked })}
            className="h-3.5 w-3.5 accent-brand" />
          Сравнить с прошлым периодом
        </label>
      </Section>

      <Section title="Показатели" aside={<span className="text-[11px] text-text-3">{state.metrics.length} из {src.metrics.length}</span>}>
        <div className="space-y-0.5">
          {src.metrics.map(m => {
            const on = state.metrics.includes(m.key);
            return (
              <label key={m.key} title={m.hint || undefined}
                className="flex cursor-pointer items-center gap-2.5 rounded-[6px] px-1.5 py-[5px] transition-colors hover:bg-accent/60">
                <input type="checkbox" checked={on} onChange={() => toggleMetric(m.key)} className="sr-only" />
                <span className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                  on ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card",
                )}>
                  {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1 text-[12.5px] font-medium leading-tight">{m.label}</span>
                {m.hint && <span className="hidden text-[10.5px] text-text-3 xl:inline">{hintShort(m.hint)}</span>}
              </label>
            );
          })}
        </div>
      </Section>

      <Section title="Группировка">
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-2">
          <label htmlFor="rb-g1" className="text-[11.5px] text-text-3">Строки</label>
          <select id="rb-g1" className={selectCls} value={state.groupBy[0] ?? ""} onChange={e => setGroup(0, e.target.value)}>
            <option value="">Без группировки — только итоги</option>
            {dims.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <label htmlFor="rb-g2" className="text-[11.5px] text-text-3">Внутри</label>
          <select id="rb-g2" className={selectCls} value={state.groupBy[1] ?? ""} disabled={!state.groupBy[0]}
            onChange={e => setGroup(1, e.target.value)}>
            <option value="">—</option>
            {dims.filter(d => d.key !== state.groupBy[0]).map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        {hasPeriod && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] text-text-3">Шаг периода</p>
            <div className="flex flex-wrap gap-1.5">
              {GRANULARITY.map(g => (
                <Chip key={g.key} active={state.granularity === g.key} onClick={() => set({ granularity: g.key })}>{g.label}</Chip>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Фильтры">
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(state.filters).map(([k, vals]) => {
            const d = dims.find(x => x.key === k);
            if (!d) return null;
            const labels = vals.map(v => state.filterLabels[k]?.[v] ?? v);
            return (
              <FilterChip key={k} label={`${d.label}: ${labels.length > 2 ? `${labels.slice(0, 2).join(", ")} и ещё ${labels.length - 2}` : labels.join(", ")}`}
                onRemove={() => {
                  const f = { ...state.filters }; delete f[k];
                  const fl = { ...state.filterLabels }; delete fl[k];
                  set({ filters: f, filterLabels: fl });
                }}>
                {close => <ValuesPicker state={state} dim={k} onCancel={close} onApply={(v, l) => {
                  close(); applyFilter(state, set, k, v, l);
                }} />}
              </FilterChip>
            );
          })}
          {filterDims.some(d => !state.filters[d.key]) && (
            <AddFilter state={state} dims={filterDims.filter(d => !state.filters[d.key])}
              onApply={(k, v, l) => applyFilter(state, set, k, v, l)} />
          )}
        </div>
        {!Object.keys(state.filters).length && (
          <p className="mt-2 text-[11px] leading-snug text-text-3">Например, только колл-центр или только один врач.</p>
        )}
      </Section>
    </div>
  );
}

function hintShort(h: string) {
  return h.length > 26 ? "" : h;
}

function applyFilter(state: BuilderState, set: (p: Partial<BuilderState>) => void,
  key: string, values: string[], labels: Record<string, string>) {
  const f = { ...state.filters };
  const fl = { ...state.filterLabels };
  if (values.length) { f[key] = values; fl[key] = labels; } else { delete f[key]; delete fl[key]; }
  set({ filters: f, filterLabels: fl });
}

function CustomDates({ state, onChange }: { state: BuilderState; onChange: (p: Partial<BuilderState>) => void }) {
  const p = state.period;
  const inputCls = "h-8 min-w-0 flex-1 rounded-[7px] border border-border bg-card px-2 text-[12px] font-medium outline-none focus:border-brand";
  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      <label className="sr-only" htmlFor="rb-from">С даты</label>
      <input id="rb-from" type="date" value={p.from ?? ""} className={inputCls}
        onChange={e => onChange({ period: { ...p, preset: "custom", from: e.target.value } })} />
      <span className="text-[12px] text-text-3">—</span>
      <label className="sr-only" htmlFor="rb-to">По дату</label>
      <input id="rb-to" type="date" value={p.to ?? ""} className={inputCls}
        onChange={e => onChange({ period: { ...p, preset: "custom", to: e.target.value } })} />
    </div>
  );
}

// ─── Фильтры ─────────────────────────────────────────────────────────

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

const popCls = "absolute left-0 top-[calc(100%+6px)] z-50 w-[280px] max-w-[calc(100vw-32px)] rounded-lg border border-border bg-popover shadow-pop";

function FilterChip({ label, onRemove, children }: {
  label: string; onRemove: () => void; children: (close: () => void) => React.ReactNode;
}) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="relative" ref={ref}>
      <span className="inline-flex max-w-full items-center rounded-full border border-brand/40 bg-brand-soft text-[11.5px] font-semibold text-brand">
        <button type="button" onClick={() => setOpen(v => !v)} className="max-w-[230px] truncate py-[4px] pl-2.5 pr-1">{label}</button>
        <button type="button" onClick={onRemove} aria-label="Убрать фильтр"
          className="mr-1 flex h-5 w-5 items-center justify-center rounded-full hover:bg-brand/15">
          <X className="h-3 w-3" strokeWidth={2.4} />
        </button>
      </span>
      {open && <div className={popCls}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

function AddFilter({ state, dims, onApply }: {
  state: BuilderState; dims: { key: string; label: string }[];
  onApply: (key: string, values: string[], labels: Record<string, string>) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const [dim, setDim] = useState<string | null>(null);
  const close = () => { setOpen(false); setDim(null); };
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen(v => !v); setDim(null); }}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-[4px] text-[11.5px] font-semibold text-text-2 transition-colors hover:border-brand hover:text-brand">
        <Plus className="h-3 w-3" strokeWidth={2.4} /> Добавить фильтр
      </button>
      {open && (
        <div className={popCls}>
          {!dim ? (
            <div className="p-1">
              <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[.07em] text-text-3">Оставить только…</p>
              {dims.map(d => (
                <button key={d.key} type="button" onClick={() => setDim(d.key)}
                  className="flex w-full rounded-[5px] px-2.5 py-[7px] text-left text-[12px] font-medium text-text-2 hover:bg-accent hover:text-foreground">
                  {d.label}
                </button>
              ))}
            </div>
          ) : (
            <ValuesPicker state={state} dim={dim} onBack={() => setDim(null)} onCancel={close}
              onApply={(v, l) => { close(); onApply(dim, v, l); }} />
          )}
        </div>
      )}
    </div>
  );
}

function ValuesPicker({ state, dim, onApply, onCancel, onBack }: {
  state: BuilderState; dim: string;
  onApply: (values: string[], labels: Record<string, string>) => void;
  onCancel: () => void; onBack?: () => void;
}) {
  const [items, setItems] = useState<DimValue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(state.filters[dim] ?? []));

  useEffect(() => {
    let alive = true;
    fetchDimValues(state, dim)
      .then(r => { if (alive) setItems(r.values); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Ошибка"); });
    return () => { alive = false; };
    // значения берём за текущий период; повторно грузить при каждом изменении панели не нужно
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dim]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? []).filter(i => !s || i.label.toLowerCase().includes(s));
  }, [items, q]);

  const toggle = (v: string) => setPicked(p => { const n = new Set(p); if (n.has(v)) n.delete(v); else n.add(v); return n; });

  return (
    <div className="flex max-h-[360px] flex-col">
      <div className="flex items-center gap-1.5 border-b border-hairline p-2">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Назад"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-text-3 hover:bg-accent hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-3" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск"
            aria-label="Поиск значения"
            className="h-7 w-full rounded-[6px] border border-border bg-card pl-7 pr-2 text-[12px] outline-none focus:border-brand" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {error && <p className="px-2.5 py-2 text-[12px] text-red-600 dark:text-red-400">{error}</p>}
        {!items && !error && <p className="px-2.5 py-2 text-[12px] text-text-3">Загрузка…</p>}
        {items && !shown.length && <p className="px-2.5 py-2 text-[12px] text-text-3">Ничего не найдено</p>}
        {shown.map(i => {
          const on = picked.has(i.value);
          return (
            <label key={i.value} className="flex cursor-pointer items-center gap-2 rounded-[5px] px-2 py-[6px] hover:bg-accent">
              <input type="checkbox" checked={on} onChange={() => toggle(i.value)} className="sr-only" />
              <span className={cn("flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border",
                on ? "border-brand bg-brand text-brand-foreground" : "border-border")}>
                {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px]" title={i.label}>{i.label}</span>
              <span className="text-[10.5px] tabular-nums text-text-3">{i.count.toLocaleString("ru-RU")}</span>
            </label>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-1.5 border-t border-hairline p-2">
        <button type="button" onClick={onCancel}
          className="h-7 rounded-[7px] px-2.5 text-[12px] font-semibold text-text-2 hover:bg-accent">Отмена</button>
        <button type="button"
          onClick={() => onApply([...picked], Object.fromEntries((items ?? []).filter(i => picked.has(i.value)).map(i => [i.value, i.label])))}
          className="h-7 rounded-[7px] bg-brand px-3 text-[12px] font-semibold text-brand-foreground hover:bg-brand-strong">
          {picked.size ? `Применить (${picked.size})` : "Без фильтра"}
        </button>
      </div>
    </div>
  );
}
