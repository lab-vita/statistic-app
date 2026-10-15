"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark, Check, ChevronDown, Download, FilePlus2, FileSpreadsheet, FileText, Loader2, Save, SlidersHorizontal, Trash2,
} from "lucide-react";
import {
  PageContent, PageHeader, HeaderControls, HeaderDivider, Skeleton, ErrorBanner,
} from "@/components/ui/primitives";
import { BuilderPanel } from "@/components/reports/builder-panel";
import { CompareNote, ReportChart, ReportTable, TotalsTiles } from "@/components/reports/report-view";
import {
  PRESETS, autoTitle, defaultState, downloadReport, effectiveGranularity, fetchSchema, periodText,
  resolvePeriod, runReport, sanitizeState, templatesApi, toRequest,
  type BuilderState, type ReportResult, type ReportTemplate, type SourceInfo,
} from "@/lib/report-builder";
import { cn } from "@/lib/utils";

/**
 * Отчёты — конструктор: источник данных, показатели, группировки, фильтры и
 * период. Отчёт пересчитывается сам при каждом изменении; его можно сохранить
 * как общий шаблон и выгрузить в Excel или PDF (файлы строит сервер).
 */

const LS_KEY = "pulse.reports.builder.v1";
const GRAN_TEXT = { day: "по дням", week: "по неделям", month: "по месяцам" } as const;

function loadLocal(): { state?: Partial<BuilderState>; templateId?: number | null } {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
}
function saveLocal(v: { state: BuilderState; templateId: number | null }) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch { /* хранилище недоступно */ }
}

/** Сравнение настроек без учёта порядка ключей (и без подписей фильтров — они справочные). */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().filter(k => k !== "filterLabels")
      .map(k => `${k}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}
const same = (a: BuilderState, b: BuilderState) => stable(a) === stable(b);

export function ReportsPage() {
  const [sources, setSources] = useState<SourceInfo[] | null>(null);
  const [state, setState] = useState<BuilderState | null>(null);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "xlsx" | "pdf" | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const seq = useRef(0);

  // Схема, шаблоны и последний открытый отчёт
  useEffect(() => {
    let alive = true;
    Promise.all([fetchSchema(), templatesApi.list().catch(() => ({ templates: [] as ReportTemplate[] }))])
      .then(([sch, tpl]) => {
        if (!alive) return;
        setSources(sch.sources);
        setTemplates(tpl.templates);
        const local = loadLocal();
        const restored = sanitizeState(local.state, sch.sources);
        setState(restored ?? (sch.sources[0] ? defaultState(sch.sources[0]) : null));
        setTemplateId(restored && local.templateId && tpl.templates.some(t => t.id === local.templateId) ? local.templateId : null);
      })
      .catch(e => alive && setError(e instanceof Error ? e.message : "Не удалось загрузить конструктор"));
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (state) saveLocal({ state, templateId }); }, [state, templateId]);

  // Пересчёт при изменении настроек (название на расчёт не влияет)
  const requestKey = state ? JSON.stringify(toRequest(state)) : "";
  useEffect(() => {
    if (!state) return;
    const my = ++seq.current;
    const t = setTimeout(() => {
      setLoading(true);
      runReport(state)
        .then(r => { if (my === seq.current) { setResult(r); setError(null); } })
        .catch(e => { if (my === seq.current) setError(e instanceof Error ? e.message : "Ошибка расчёта"); })
        .finally(() => { if (my === seq.current) setLoading(false); });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const src = sources?.find(s => s.key === state?.source);
  const title = state ? (state.title.trim() || autoTitle(state, src)) : "Отчёт";
  const current = templates.find(t => t.id === templateId) ?? null;
  const currentState = useMemo(
    () => (current && sources ? sanitizeState(current.config, sources) : null), [current, sources]);
  const dirty = !!(current && state && currentState && !same(currentState, state));

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(n => (n === msg ? null : n)), 2500);
  }, []);

  async function save(asNew = false) {
    if (!state) return;
    setBusy("save");
    try {
      const cfg = { ...state, title };
      const t = current && current.can_edit && !asNew
        ? await templatesApi.update(current.id, title, cfg)
        : await templatesApi.create(title, cfg);
      setTemplates(list => [...list.filter(x => x.id !== t.id), t].sort((a, b) => a.name.localeCompare(b.name, "ru")));
      setTemplateId(t.id);
      setState(cfg);
      flash(asNew || !current ? "Отчёт сохранён — он виден всем в «Шаблонах»" : "Изменения сохранены");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally { setBusy(null); }
  }

  async function remove(t: ReportTemplate) {
    try {
      await templatesApi.remove(t.id);
      setTemplates(list => list.filter(x => x.id !== t.id));
      if (templateId === t.id) setTemplateId(null);
      flash(`Шаблон «${t.name}» удалён`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
    }
  }

  function openTemplate(t: ReportTemplate) {
    const s = sources && sanitizeState(t.config, sources);
    if (!s) { setError("Этот шаблон собран из данных, к которым у вас нет доступа"); return; }
    setState(s);
    setTemplateId(t.id);
  }

  function newReport() {
    if (!sources?.[0]) return;
    setState(defaultState(sources.find(s => s.key === state?.source) ?? sources[0]));
    setTemplateId(null);
    setPanelOpen(true);
  }

  async function exportAs(format: "xlsx" | "pdf") {
    if (!state) return;
    setBusy(format);
    try { await downloadReport(state, format, title); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось выгрузить отчёт"); }
    finally { setBusy(null); }
  }

  const summary = state && src ? [
    src.label,
    PRESETS.find(p => p.key === state.period.preset)?.label,
    state.groupBy.length ? `по: ${state.groupBy.map(k => src.dimensions.find(d => d.key === k)?.label.toLowerCase()).join(", ")}` : "итоги",
    Object.keys(state.filters).length ? `фильтров: ${Object.keys(state.filters).length}` : null,
  ].filter(Boolean).join(" · ") : "";

  const dates = state ? resolvePeriod(state.period) : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader title="Отчёты">
        <HeaderControls>
          <TemplatesMenu templates={templates} current={current} dirty={dirty}
            onOpen={openTemplate} onNew={newReport} onRemove={remove} onSaveAsNew={() => save(true)} />
          <button type="button" onClick={() => save(false)} disabled={!state || busy === "save"}
            className="inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-brand px-2.5 text-[12px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-60">
            {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />}
            <span className="max-sm:sr-only">{current && current.can_edit ? (dirty ? "Сохранить изменения" : "Сохранено") : "Сохранить"}</span>
          </button>
          <HeaderDivider />
          <ExportButton label="Excel" icon={FileSpreadsheet} busy={busy === "xlsx"} disabled={!result || !!busy}
            onClick={() => exportAs("xlsx")} />
          <ExportButton label="PDF" icon={FileText} busy={busy === "pdf"} disabled={!result || !!busy}
            onClick={() => exportAs("pdf")} />
        </HeaderControls>
      </PageHeader>

      <PageContent>
        {error && <ErrorBanner message={error} />}
        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2.5 text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400">
            <Check className="h-4 w-4" strokeWidth={2.4} /> {notice}
          </div>
        )}

        {!sources || !state || !dates ? (
          sources && !sources.length ? (
            <div className="card-surface px-5 py-8 text-center text-[13px] text-text-2">
              Для отчётов нужен доступ хотя бы к одному разделу: звонкам, записям или выручке.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
              <Skeleton className="h-[520px]" />
              <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-72" /><Skeleton className="h-64" /></div>
            </div>
          )
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="min-w-0">
              {/* На телефоне настройки свёрнуты в одну строку */}
              <button type="button" onClick={() => setPanelOpen(v => !v)} aria-expanded={panelOpen}
                className="card-surface mb-3 flex w-full items-center gap-3 px-4 py-3 text-left lg:hidden">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-brand" strokeWidth={1.8} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold">Настроить отчёт</span>
                  <span className="block truncate text-[11px] text-text-3">{summary}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 text-text-3 transition-transform", panelOpen && "rotate-180")} />
              </button>
              <div className={cn(!panelOpen && "max-lg:hidden")}>
                <BuilderPanel sources={sources} state={state} onChange={s => setState(s)} />
              </div>
            </div>

            <div className={cn("min-w-0 space-y-4 transition-opacity", loading && result && "opacity-60")}>
              <div className="px-1">
                <h2 className="text-[18px] font-extrabold leading-tight tracking-[-0.02em]">{title}</h2>
                <p className="mt-1 text-[12px] text-text-3">
                  {src?.label} · {periodText({ date_from: dates.from, date_to: dates.to })}
                  {state.groupBy.includes("period") && ` · ${GRAN_TEXT[effectiveGranularity(state.granularity, dates.from, dates.to)]}`}
                  {current && <> · шаблон «{current.name}»{dirty && " (изменён)"}</>}
                </p>
                {!!result?.filters.length && (
                  <p className="mt-1 text-[12px] font-semibold text-brand">
                    Только: {result.filters.map(f => `${f.label.toLowerCase()} — ${f.values.join(", ")}`).join("; ")}
                  </p>
                )}
              </div>
              {!result ? (
                <>
                  <Skeleton className="h-24" />
                  <Skeleton className="h-72" />
                </>
              ) : (
                <>
                  <TotalsTiles rep={result} />
                  {result.dimensions.length > 0 && result.rows.length > 0 &&
                    <ReportChart key={`${result.metrics.map(m => m.key).join()}|${result.dimensions.map(d => d.key).join()}`} rep={result} />}
                  {result.dimensions.length > 0 && (result.rows.length > 0
                    ? <ReportTable rep={result} />
                    : <div className="card-surface px-5 py-8 text-center text-[13px] text-text-3">Нет данных за выбранный период</div>)}
                  {!result.dimensions.length && (
                    <p className="px-1 text-[12px] text-text-3">Выберите группировку слева, чтобы увидеть таблицу и график.</p>
                  )}
                  <CompareNote rep={result} />
                </>
              )}
            </div>
          </div>
        )}
      </PageContent>
    </div>
  );
}

function ExportButton({ label, icon: Icon, busy, disabled, onClick }: {
  label: string; icon: React.ElementType; busy: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={`Скачать ${label}`}
      className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-border bg-card px-2.5 text-[12px] font-semibold text-text-2 transition-colors hover:border-brand/50 hover:text-foreground disabled:opacity-50">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />}
      {label}
      <Download className="h-3 w-3 text-text-3 max-sm:hidden" strokeWidth={2} />
    </button>
  );
}

function TemplatesMenu({ templates, current, dirty, onOpen, onNew, onRemove, onSaveAsNew }: {
  templates: ReportTemplate[]; current: ReportTemplate | null; dirty: boolean;
  onOpen: (t: ReportTemplate) => void; onNew: () => void;
  onRemove: (t: ReportTemplate) => void; onSaveAsNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const close = () => { setOpen(false); setConfirm(null); };

  return (
    <div className="relative max-sm:mr-auto" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open}
        className={cn(
          "inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-semibold transition-colors",
          open ? "border-brand text-brand" : "border-border bg-card text-text-2 hover:border-brand/50 hover:text-foreground",
        )}>
        <Bookmark className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        <span className="truncate">{current ? current.name : "Шаблоны"}</span>
        {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Есть несохранённые изменения" />}
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} strokeWidth={2.2} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[300px] max-w-[calc(100vw-24px)] rounded-lg border border-border bg-popover p-1 shadow-pop max-sm:left-0 max-sm:right-auto">
          <button type="button" onClick={() => { close(); onNew(); }}
            className="flex w-full items-center gap-2 rounded-[5px] px-2.5 py-[7px] text-left text-[12px] font-semibold text-text-2 hover:bg-accent hover:text-foreground">
            <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.8} /> Новый отчёт
          </button>
          {current && (
            <button type="button" onClick={() => { close(); onSaveAsNew(); }}
              className="flex w-full items-center gap-2 rounded-[5px] px-2.5 py-[7px] text-left text-[12px] font-semibold text-text-2 hover:bg-accent hover:text-foreground">
              <Save className="h-3.5 w-3.5" strokeWidth={1.8} /> Сохранить как новый шаблон
            </button>
          )}
          <div className="mx-1.5 my-1 h-px bg-hairline" />
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[.07em] text-text-3">Общие шаблоны</p>
          <div className="max-h-72 overflow-y-auto">
            {!templates.length && (
              <p className="px-2.5 py-2 text-[12px] leading-snug text-text-3">
                Пока пусто. Соберите отчёт и нажмите «Сохранить» — он появится здесь у всех.
              </p>
            )}
            {templates.map(t => (
              <div key={t.id} className={cn("group flex items-center gap-1 rounded-[5px] hover:bg-accent", t.id === current?.id && "bg-brand-soft")}>
                <button type="button" onClick={() => { close(); onOpen(t); }} className="min-w-0 flex-1 px-2.5 py-[6px] text-left">
                  <span className={cn("block truncate text-[12px] font-semibold", t.id === current?.id ? "text-brand" : "text-foreground")}>{t.name}</span>
                  {t.created_by && <span className="block truncate text-[10.5px] text-text-3">{t.created_by}</span>}
                </button>
                {t.can_edit && (confirm === t.id ? (
                  <button type="button" onClick={() => { setConfirm(null); onRemove(t); }}
                    className="mr-1 rounded-[5px] bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                    Удалить?
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirm(t.id)} aria-label={`Удалить шаблон «${t.name}»`}
                    className="mr-1 flex h-7 w-7 items-center justify-center rounded-[5px] text-text-3 opacity-60 hover:bg-card hover:text-red-600 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
