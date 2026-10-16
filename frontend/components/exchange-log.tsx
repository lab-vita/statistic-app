"use client";

/**
 * Настройки → Журнал обмена: всё, что «Пульс» получает из МедОДС и Битрикс24.
 * Сверху — состояние каждого сборщика, ниже — сеансы обмена (запуск сборщика целиком)
 * или все запросы подряд. Любой запрос открывается целиком: параметры, ответ, описание данных.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Copy, Download, Loader2,
  RefreshCw, Search, X, XCircle,
} from "lucide-react";
import { Empty, ErrorBanner, Skeleton, StatusPill, TabGroup } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  downloadFrom, formatBytes, formatMs, formatPeriod, formatTime, systemApi,
  type JobState, type LogOverview, type RunStatus, type SyncRequest, type SyncRequestDetail,
  type SyncRun, type SyncRunDetail,
} from "@/lib/system-api";

const VIEW_RUNS = "Сеансы";
const VIEW_REQS = "Все запросы";

const controlCls =
  "h-8 rounded-[7px] border border-border bg-card px-2 text-[12px] font-medium text-foreground outline-none " +
  "transition-colors hover:border-brand/50 focus-visible:border-brand";

const STATUS: Record<RunStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  ok:      { label: "успешно",        cls: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 },
  warning: { label: "с ошибками",     cls: "text-amber-600 dark:text-amber-400",     Icon: AlertTriangle },
  error:   { label: "не выполнен",    cls: "text-red-600 dark:text-red-400",         Icon: XCircle },
  running: { label: "идёт",           cls: "text-blue-600 dark:text-blue-400",       Icon: Loader2 },
};

function StatusIcon({ status, className }: { status: RunStatus; className?: string }) {
  const s = STATUS[status] ?? STATUS.ok;
  return <s.Icon className={cn("h-4 w-4 shrink-0", s.cls, className)} strokeWidth={2} aria-label={s.label} />;
}

function SourcePill({ source, label }: { source: string; label: string }) {
  return <StatusPill color={source === "medods" ? "violet" : "blue"}>{label}</StatusPill>;
}

function ago(iso: string | null): string {
  if (!iso) return "ни разу";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч ${min % 60} мин назад`;
  return formatTime(iso);
}

/** Успешного сбора не было дольше hours часов — карточку стоит подсветить */
function olderThanHours(iso: string | null, hours: number): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() > hours * 3600_000;
}

// ─── Состояние сборщиков ──────────────────────────────────────

function JobCard({ j, active, onClick }: { j: JobState; active: boolean; onClick: () => void }) {
  const last = j.last;
  const stale = olderThanHours(j.last_ok_at, 26);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "card-surface flex min-w-0 flex-col gap-1 px-3.5 py-3 text-left transition-colors hover:bg-accent/60",
        active && "ring-2 ring-brand",
      )}
    >
      <div className="flex items-start gap-1.5">
        {last ? <StatusIcon status={last.status} className="mt-px" />
              : <span className="mt-px h-4 w-4 shrink-0 rounded-full border border-border" />}
        <span className="min-w-0 flex-1 text-[12.5px] font-bold leading-snug">{j.title}</span>
      </div>
      <div><SourcePill source={j.source} label={j.source_label} /></div>
      <p className="text-[11px] leading-snug text-text-3">
        {last ? <>Последний: {ago(last.started_at)}, {STATUS[last.status]?.label}</> : "Ещё не запускался"}
      </p>
      <p className={cn("text-[11px] leading-snug", stale ? "font-semibold text-amber-600 dark:text-amber-400" : "text-text-3")}>
        Успешный: {ago(j.last_ok_at)}
      </p>
    </button>
  );
}

function Overview({ ov, job, onJob }: { ov: LogOverview; job: string; onJob: (j: string) => void }) {
  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(165px,1fr))]">
        {ov.jobs.map(j => (
          <JobCard key={j.job} j={j} active={job === j.job} onClick={() => onJob(job === j.job ? "" : j.job)} />
        ))}
      </div>
      <p className="text-[11px] text-text-3">
        За сутки: запросов {ov.day.requests.toLocaleString("ru-RU")}
        {ov.day.failed > 0 && <span className="font-semibold text-red-600 dark:text-red-400">, с ошибкой {ov.day.failed}</span>}
        , получено {formatBytes(ov.day.bytes)} · журнал занимает {formatBytes(ov.storage_bytes)}.
        {" "}Запросы хранятся {ov.keep_request_days} дней, сеансы — {ov.keep_run_days}. Пароли, адрес вебхука и токены не записываются.
      </p>
    </div>
  );
}

// ─── Запрос ───────────────────────────────────────────────────

function RequestRow({ r, onOpen }: { r: SyncRequest; onOpen: (id: number) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(r.id)}
        className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60 sm:px-5"
      >
        <span className={cn(
          "mt-[3px] h-2 w-2 shrink-0 rounded-full",
          r.ok ? "bg-emerald-500" : "bg-red-500",
        )} aria-label={r.ok ? "успешно" : "ошибка"} />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold">{r.title}</span>
          <span className={cn("mt-0.5 block text-[11.5px]", r.ok ? "text-text-2" : "text-red-600 dark:text-red-400")}>
            {r.summary || "—"}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] tabular-nums text-text-3">
            <span>{formatTime(r.at)}</span>
            <span className="font-mono">{r.method} {r.endpoint}</span>
            {r.status_code !== null && <span>HTTP {r.status_code}</span>}
            <span>{formatMs(r.duration_ms)}</span>
            <span>{formatBytes(r.response_bytes)}</span>
            {r.records !== null && <span>записей: {r.records}</span>}
          </span>
        </span>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
      </button>
    </li>
  );
}

const SHOW_CHARS = 200_000;

function CodeBlock({ text, label }: { text: string; label: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? text : text.slice(0, SHOW_CHARS);
  return (
    <div>
      <pre
        aria-label={label}
        className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-all rounded-[8px] bg-background px-3 py-2.5 font-mono text-[11px] leading-[1.5] text-foreground"
      >
        {shown}
      </pre>
      {text.length > SHOW_CHARS && !all && (
        <button type="button" onClick={() => setAll(true)}
                className="mt-1.5 text-[11.5px] font-semibold text-brand hover:underline">
          Показано {SHOW_CHARS.toLocaleString("ru-RU")} из {text.length.toLocaleString("ru-RU")} символов — показать всё
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="metric-label">{label}</div>
      <div className="text-[12px]">{children}</div>
    </div>
  );
}

function RequestDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const [d, setD] = useState<SyncRequestDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dl, setDl] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    systemApi.request(id).then(x => { if (alive) setD(x); })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : "Не удалось открыть запрос"); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    if (!d?.body) return;
    try { await navigator.clipboard.writeText(d.body); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* буфер недоступен в iframe — остаётся «Скачать» */ }
  };
  const download = async () => {
    setDl(true);
    try { await downloadFrom(`/logs/requests/${id}/body`, `request-${id}.txt`); }
    catch (e) { setErr(e instanceof Error ? e.message : "Не удалось скачать"); }
    finally { setDl(false); }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <aside
        role="dialog" aria-modal="true" aria-label="Запрос к внешней системе"
        className="absolute inset-y-0 right-0 flex w-full max-w-[860px] flex-col bg-card shadow-pop"
      >
        <div className="flex items-start gap-3 border-b border-hairline px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {d && <SourcePill source={d.source} label={d.source_label} />}
              {d && (d.ok ? <StatusPill color="green">{d.status_code ? `HTTP ${d.status_code}` : "успешно"}</StatusPill>
                          : <StatusPill color="red">{d.status_code ? `HTTP ${d.status_code}` : "ошибка"}</StatusPill>)}
              <span className="text-[11px] text-text-3">запрос №{id}</span>
            </div>
            <h2 className="mt-1 text-[14px] font-bold leading-snug">{d?.title ?? "Загрузка…"}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Закрыть"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] text-text-3 hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {err && <ErrorBanner message={err} />}
          {!d && !err && <><Skeleton className="h-16" /><Skeleton className="h-64" /></>}
          {d && (
            <>
              <div className={cn("rounded-[8px] px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                                 d.ok ? "bg-accent text-foreground" : "bg-red-500/10 text-red-700 dark:text-red-300")}>
                {d.summary || "Описание не собрано"}
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Когда">{formatTime(d.at)}</Field>
                <Field label="Длительность">{formatMs(d.duration_ms)}</Field>
                <Field label="Размер ответа">{formatBytes(d.response_bytes)}</Field>
                <Field label="Записей">{d.records ?? "—"}</Field>
              </div>

              <Field label="Адрес">
                <span className="break-all font-mono text-[11.5px]">{d.method} {d.url}</span>
              </Field>

              {d.params !== null && d.params !== undefined && (
                <Field label="Что запросили (параметры)">
                  <CodeBlock label="Параметры запроса"
                             text={typeof d.params === "string" ? d.params : JSON.stringify(d.params, null, 2)} />
                </Field>
              )}

              {d.fields && d.fields.length > 0 && (
                <Field label={`Поля одной записи (${d.fields.length})`}>
                  <div className="flex flex-wrap gap-1">
                    {d.fields.map(f => (
                      <span key={f} className="rounded-[5px] bg-accent px-1.5 py-0.5 font-mono text-[10.5px] text-text-2">{f}</span>
                    ))}
                  </div>
                </Field>
              )}

              {d.error && (
                <Field label="Ошибка">
                  <CodeBlock label="Текст ошибки" text={d.error} />
                </Field>
              )}

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="metric-label flex-1">
                    Ответ целиком{d.content_type ? ` · ${d.content_type.split(";")[0]}` : ""}
                  </span>
                  {d.body !== null && (
                    <>
                      <button type="button" onClick={copy}
                              className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-border bg-card px-2.5 text-[11.5px] font-medium text-text-2 hover:bg-accent">
                        <Copy className="h-3.5 w-3.5" /> {copied ? "Скопировано" : "Копировать"}
                      </button>
                      <button type="button" onClick={download} disabled={dl}
                              className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-border bg-card px-2.5 text-[11.5px] font-medium text-text-2 hover:bg-accent disabled:opacity-60">
                        {dl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Скачать
                      </button>
                    </>
                  )}
                </div>
                {d.body === null ? (
                  <p className="text-[12px] text-text-3">
                    {d.endpoint.includes("sign_in") || d.endpoint === "/"
                      ? "Служебный шаг входа в МедОДС — ответ не сохраняется, в нём токены сессии."
                      : "Ответа нет: запрос не дошёл до сервера."}
                  </p>
                ) : (
                  <>
                    {d.body_truncated && (
                      <p className="text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">
                        Ответ был больше лимита журнала и сохранён не полностью.
                      </p>
                    )}
                    <CodeBlock label="Тело ответа" text={d.body} />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── Сеанс ────────────────────────────────────────────────────

const LEVEL_CLS: Record<string, string> = {
  ERROR: "text-red-600 dark:text-red-400",
  CRITICAL: "text-red-600 dark:text-red-400",
  WARNING: "text-amber-600 dark:text-amber-400",
};

function RunDetailView({ id, onOpenReq }: { id: number; onOpenReq: (id: number) => void }) {
  const [d, setD] = useState<{ run: SyncRunDetail; requests: SyncRequest[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    systemApi.run(id).then(x => { if (alive) setD(x); })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : "Не удалось открыть сеанс"); });
    return () => { alive = false; };
  }, [id]);

  if (err) return <div className="px-5 pb-4"><ErrorBanner message={err} /></div>;
  if (!d) return <div className="px-5 pb-4"><Skeleton className="h-24" /></div>;
  const { run, requests } = d;
  return (
    <div className="space-y-3 border-t border-hairline bg-background/50 pb-2 pt-3">
      <div className="grid gap-3 px-4 sm:grid-cols-4 sm:px-5">
        <Field label="Запущен">{formatTime(run.started_at)}{run.user_name ? ` · ${run.user_name}` : ""}</Field>
        <Field label="Длительность">{formatMs(run.duration_ms)}</Field>
        <Field label="Запросов">{run.requests}{run.failed ? <span className="text-red-600 dark:text-red-400"> · с ошибкой {run.failed}</span> : null}</Field>
        <Field label="Получено">{run.records.toLocaleString("ru-RU")} записей · {formatBytes(run.bytes)}</Field>
      </div>

      {run.error && (
        <div className="px-4 sm:px-5">
          <Field label="Ошибка"><CodeBlock label="Ошибка сеанса" text={run.error} /></Field>
        </div>
      )}

      {run.events.length > 0 && (
        <div className="px-4 sm:px-5">
          <div className="metric-label mb-1">Что происходило</div>
          <ol className="space-y-0.5 rounded-[8px] bg-card px-3 py-2 font-mono text-[11px] leading-[1.55]">
            {run.events.map((e, i) => (
              <li key={i} className={cn("whitespace-pre-wrap break-words", LEVEL_CLS[e.level] ?? "text-text-2")}>
                <span className="text-text-3">{formatTime(e.at, false)}</span> {e.msg}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <div className="metric-label mb-0.5 px-4 sm:px-5">Запросы по порядку ({requests.length})</div>
        {requests.length === 0
          ? <p className="px-4 text-[12px] text-text-3 sm:px-5">Запросов не было.</p>
          : <ul className="divide-y divide-hairline">
              {requests.map(r => <RequestRow key={r.id} r={r} onOpen={onOpenReq} />)}
            </ul>}
      </div>
    </div>
  );
}

function RunRow({ r, open, onToggle, onOpenReq }: {
  r: SyncRun; open: boolean; onToggle: () => void; onOpenReq: (id: number) => void;
}) {
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 sm:px-5">
        <StatusIcon status={r.status} className="mt-px" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold">{r.title}</span>
            {r.period_from && <span className="text-[12px] text-text-2">за {formatPeriod(r.period_from, r.period_to)}</span>}
            <SourcePill source={r.source} label={r.source_label} />
            <StatusPill>{r.trigger_label}{r.user_name ? ` · ${r.user_name}` : ""}</StatusPill>
          </span>
          <span className={cn("mt-0.5 block text-[11.5px]", r.status === "error" ? "text-red-600 dark:text-red-400" : "text-text-2")}>
            {r.summary || (r.status === "running" ? "Идёт…" : "—")}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] tabular-nums text-text-3">
            <span>{formatTime(r.started_at)}</span>
            <span>запросов: {r.requests}{r.failed ? ` (ошибок ${r.failed})` : ""}</span>
            <span>записей: {r.records.toLocaleString("ru-RU")}</span>
            <span>{formatBytes(r.bytes)}</span>
            <span>{formatMs(r.duration_ms)}</span>
          </span>
        </span>
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-text-3 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && <RunDetailView id={r.id} onOpenReq={onOpenReq} />}
    </li>
  );
}

// ─── Панель ───────────────────────────────────────────────────

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExchangeLogPanel() {
  const [ov, setOv] = useState<LogOverview | null>(null);
  const [view, setView] = useState(VIEW_RUNS);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");       // "" | problems
  const [job, setJob] = useState("");
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [outside, setOutside] = useState(false);  // только запросы вне сеансов

  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [reqs, setReqs] = useState<SyncRequest[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<number | null>(null);
  const [openReq, setOpenReq] = useState<number | null>(null);
  const seq = useRef(0);

  const runFilters = useMemo(() => ({ source, job, status, date }), [source, job, status, date]);
  const reqFilters = useMemo(() => ({
    source, date, only_errors: status === "problems", q: qApplied, run: outside ? "none" : undefined,
  }), [source, date, status, qApplied, outside]);

  const load = useCallback(async (append = false) => {
    const my = ++seq.current;
    setLoading(true); setErr(null);
    try {
      if (view === VIEW_RUNS) {
        const before = append ? runs[runs.length - 1]?.id : undefined;
        const res = await systemApi.runs(runFilters, before);
        if (my !== seq.current) return;
        setRuns(prev => append ? [...prev, ...res.runs] : res.runs);
        setMore(res.more);
      } else {
        const before = append ? reqs[reqs.length - 1]?.id : undefined;
        const res = await systemApi.requests(reqFilters, before);
        if (my !== seq.current) return;
        setReqs(prev => append ? [...prev, ...res.requests] : res.requests);
        setMore(res.more);
      }
    } catch (e) {
      if (my === seq.current) setErr(e instanceof Error ? e.message : "Не удалось загрузить журнал");
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [view, runFilters, reqFilters, runs, reqs]);

  const loadOverview = useCallback(() => {
    systemApi.overview().then(setOv).catch(() => { /* карточки не главное — список покажет ошибку */ });
  }, []);

  // перезагрузка при смене вида или фильтров
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  useEffect(() => {
    const t = setTimeout(() => { void loadRef.current(false); }, 0);
    return () => clearTimeout(t);
  }, [view, runFilters, reqFilters]);
  useEffect(() => {
    const t = setTimeout(loadOverview, 0);
    return () => clearTimeout(t);
  }, [loadOverview]);

  const refresh = () => { loadOverview(); void load(false); };
  const closeReq = useCallback(() => setOpenReq(null), []);

  const list = view === VIEW_RUNS ? runs : reqs;

  return (
    <div className="space-y-4">
      {ov ? <Overview ov={ov} job={job} onJob={j => { setJob(j); setView(VIEW_RUNS); }} />
          : <Skeleton className="h-28" />}

      <div className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3 sm:px-5">
          <TabGroup items={[VIEW_RUNS, VIEW_REQS]} active={view} onChange={setView} small />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select aria-label="Источник" className={controlCls} value={source} onChange={e => setSource(e.target.value)}>
              <option value="">МедОДС и Битрикс24</option>
              <option value="medods">Только МедОДС</option>
              <option value="bitrix">Только Битрикс24</option>
            </select>
            <select aria-label="Статус" className={controlCls} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Все</option>
              <option value="problems">Только с ошибками</option>
            </select>
            {view === VIEW_RUNS && (
              <select aria-label="Сборщик" className={controlCls} value={job} onChange={e => setJob(e.target.value)}>
                <option value="">Все сборщики</option>
                {(ov?.jobs ?? []).map(j => <option key={j.job} value={j.job}>{j.title}</option>)}
              </select>
            )}
            <input type="date" aria-label="День" className={controlCls} value={date} max={today()}
                   onChange={e => setDate(e.target.value)} />
            {date && (
              <button type="button" onClick={() => setDate("")} aria-label="Сбросить день"
                      className="flex h-8 w-8 items-center justify-center rounded-[7px] text-text-3 hover:bg-accent">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={refresh} aria-label="Обновить журнал"
                    className="flex h-8 w-8 items-center justify-center rounded-[7px] text-text-3 hover:bg-accent hover:text-foreground">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {view === VIEW_REQS && (
          <form
            className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5 sm:px-5"
            onSubmit={e => { e.preventDefault(); setQApplied(q); }}
          >
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Поиск по запросам и ответам</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-3" />
              <input value={q} onChange={e => setQ(e.target.value)}
                     placeholder="Поиск: номер телефона, фамилия, метод, текст ответа…"
                     className={cn(controlCls, "w-full pl-8")} />
            </label>
            <button type="submit" className="h-8 rounded-[7px] bg-brand px-3 text-[12px] font-semibold text-brand-foreground hover:bg-brand-strong">
              Найти
            </button>
            <label className="flex items-center gap-1.5 text-[12px] text-text-2">
              <input type="checkbox" checked={outside} onChange={e => setOutside(e.target.checked)} className="accent-brand" />
              только вне сеансов (вход, поиск сотрудников)
            </label>
          </form>
        )}

        {err && <div className="p-4"><ErrorBanner message={err} /></div>}

        {!err && list.length === 0 && !loading && (
          <div className="p-4">
            <Empty text={job || source || status || date || qApplied
              ? "По этим условиям ничего не найдено"
              : "Журнал пока пуст — записи появятся после ближайшего сбора данных"} />
          </div>
        )}

        {list.length === 0 && loading && <div className="space-y-2 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}

        {view === VIEW_RUNS && runs.length > 0 && (
          <ul className="divide-y divide-hairline">
            {runs.map(r => (
              <RunRow key={r.id} r={r} open={openRun === r.id}
                      onToggle={() => setOpenRun(openRun === r.id ? null : r.id)} onOpenReq={setOpenReq} />
            ))}
          </ul>
        )}
        {view === VIEW_REQS && reqs.length > 0 && (
          <ul className="divide-y divide-hairline">
            {reqs.map(r => <RequestRow key={r.id} r={r} onOpen={setOpenReq} />)}
          </ul>
        )}

        {more && (
          <div className="border-t border-hairline p-3 text-center">
            <button type="button" onClick={() => void load(true)} disabled={loading}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-border bg-card px-3 text-[12px] font-medium text-text-2 hover:bg-accent disabled:opacity-60">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Показать ещё
            </button>
          </div>
        )}
      </div>

      {openReq !== null && <RequestDrawer key={openReq} id={openReq} onClose={closeReq} />}
    </div>
  );
}
