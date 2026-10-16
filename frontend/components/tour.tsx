"use client";

/**
 * Обучающий тур: экран затемняется, нужный элемент подсвечивается, рядом — подсказка.
 *
 *  • Сам запускается при первом входе сотрудника (отметка хранится на сервере у пользователя,
 *    плюс в браузере — на случай, если сервер недоступен).
 *  • Запускается в любой момент кнопкой «Как пользоваться» — целиком или по одному разделу.
 *  • Шаги и тексты — lib/tour.ts; элементы помечены атрибутом data-tour.
 *
 * Пока тур открыт, страница под затемнением не нажимается: подсказка объясняет,
 * а не меняет данные. Клавиши: ← → — листать, Esc — закрыть.
 */
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useAuth } from "@/components/auth-gate";
import type { Section } from "@/lib/permissions";
import {
  CHAPTER_LABELS, CHAPTER_ORDER, TOUR_VERSION, markTourSeen, resolve, stepsFor,
  type ChapterId, type TourCtx, type TourStep,
} from "@/lib/tour";
import { cn } from "@/lib/utils";

const SEEN_KEY = "pulse.tour.version";
const PAD = 6;        // отступ подсветки от элемента
const GAP = 12;       // от подсветки до карточки
const EDGE = 12;      // от карточки до края экрана
const MOBILE_Q = "(max-width: 767px)";

interface TourApi {
  /** Запустить тур. chapter — сразу к разделу (только он); без — с начала. */
  start: (opts?: { chapter?: ChapterId }) => void;
  running: boolean;
}

const TourContext = createContext<TourApi | null>(null);

export function useTour(): TourApi {
  const v = useContext(TourContext);
  if (!v) throw new Error("useTour вне TourProvider");
  return v;
}

// ─── Поиск элемента ───────────────────────────────────────────

function findTarget(ids: string[]): HTMLElement | null {
  for (const id of ids) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
      if (el.closest("[inert]")) continue;              // закрытая шторка меню
      const r = el.getBoundingClientRect();
      if (r.width >= 2 && r.height >= 2) return el;     // display:none даёт нулевой размер
    }
  }
  return null;
}

function scrollIntoViewIfNeeded(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.top >= 8 && r.bottom <= vh - 8) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: r.height > vh * 0.7 ? "start" : "center", behavior: reduce ? "auto" : "smooth" });
}

interface Box { x: number; y: number; w: number; h: number }

function sameBox(a: Box | null, b: Box) {
  return !!a && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
}

// ─── Хранение отметки «тур пройден» ───────────────────────────

function readLocalSeen(): number {
  try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
}
function writeLocalSeen(v: number) {
  try { localStorage.setItem(SEEN_KEY, String(v)); } catch { /* приватный режим — останется отметка на сервере */ }
}

// ─── Провайдер ────────────────────────────────────────────────

export function TourProvider({ section, onNavigate, children }: {
  section: Section;
  onNavigate: (s: Section) => void;
  children: React.ReactNode;
}) {
  const { user, can, canSee } = useAuth();
  const [mobile, setMobile] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(-1);                 // -1 — тур закрыт
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [manual, setManual] = useState(false);            // запущен кнопкой, а не сам
  const [from, setFrom] = useState<Section>("home");      // где был пользователь при запуске

  const ctx = useMemo<TourCtx>(() => ({ can, canSee, mobile }), [can, canSee, mobile]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_Q);
    const on = () => setMobile(mq.matches);
    const t = setTimeout(on, 0);
    mq.addEventListener("change", on);
    return () => { clearTimeout(t); mq.removeEventListener("change", on); };
  }, []);

  const goTo = useCallback((i: number, list: TourStep[] = steps) => {
    const s = list[i];
    if (!s) return;
    if (s.section && s.section !== section) onNavigate(s.section);
    setIndex(i);
  }, [steps, section, onNavigate]);

  const start = useCallback((opts?: { chapter?: ChapterId }) => {
    const c: TourCtx = { can, canSee, mobile: window.matchMedia(MOBILE_Q).matches };
    const list = stepsFor(c);
    if (!list.length) return;
    let lo = 0, hi = list.length - 1;
    if (opts?.chapter) {
      const idx = list.map((s, i) => (s.chapter === opts.chapter ? i : -1)).filter(i => i >= 0);
      if (idx.length) { lo = idx[0]; hi = idx[idx.length - 1]; }
    }
    setMobile(c.mobile);
    setSteps(list);
    setRange([lo, hi]);
    setManual(!!opts);
    setFrom(section);
    const s = list[lo];
    if (s.section && s.section !== section) onNavigate(s.section);
    setIndex(lo);
  }, [can, canSee, section, onNavigate]);

  const close = useCallback(() => {
    setIndex(-1);
    writeLocalSeen(TOUR_VERSION);
    if ((user.tour_version ?? 0) < TOUR_VERSION) markTourSeen(TOUR_VERSION).catch(() => { /* отметка осталась в браузере */ });
  }, [user.tour_version]);

  // Первый вход: тур запускается сам
  const startRef = useRef(start);
  useEffect(() => { startRef.current = start; });
  useEffect(() => {
    const server = user.tour_version ?? 0;
    const local = readLocalSeen();
    if (server >= TOUR_VERSION) return;
    if (local >= TOUR_VERSION) {
      // в этом браузере уже видели, а сервер не знает (например, не было связи) — сообщить
      markTourSeen(TOUR_VERSION).catch(() => {});
      return;
    }
    const t = setTimeout(() => startRef.current(), 700);
    return () => clearTimeout(t);
  }, [user.tour_version]);

  // Подписка на «следующую главу» — продолжить после раздела
  const extendToNextChapter = useCallback(() => {
    const cur = steps[range[1]]?.chapter;
    const next = steps.findIndex((s, i) => i > range[1] && s.chapter !== cur && s.chapter !== "finish");
    if (next < 0) return;
    const ch = steps[next].chapter;
    let end = next;
    while (steps[end + 1]?.chapter === ch) end++;
    setRange([range[0], end]);
    goTo(next);
  }, [steps, range, goTo]);

  const jumpToChapter = useCallback((ch: ChapterId) => {
    const idx = steps.map((s, i) => (s.chapter === ch ? i : -1)).filter(i => i >= 0);
    if (!idx.length) return;
    setRange([idx[0], idx[idx.length - 1]]);
    goTo(idx[0]);
  }, [steps, goTo]);

  const api = useMemo<TourApi>(() => ({ start, running: index >= 0 }), [start, index]);
  const step = index >= 0 ? steps[index] : null;

  return (
    <TourContext.Provider value={api}>
      {children}
      {step && (
        <TourOverlay
          key="tour"
          step={step}
          index={index}
          range={range}
          steps={steps}
          ctx={ctx}
          manual={manual}
          from={from}
          onPrev={() => goTo(Math.max(range[0], index - 1))}
          onNext={() => (index >= range[1] ? close() : goTo(index + 1))}
          onClose={close}
          onChapter={jumpToChapter}
          onNextChapter={extendToNextChapter}
        />
      )}
    </TourContext.Provider>
  );
}

// ─── Затемнение и карточка ────────────────────────────────────

function TourOverlay({
  step, index, range, steps, ctx, manual, from,
  onPrev, onNext, onClose, onChapter, onNextChapter,
}: {
  step: TourStep; index: number; range: [number, number]; steps: TourStep[]; ctx: TourCtx;
  manual: boolean; from: Section;
  onPrev: () => void; onNext: () => void; onClose: () => void;
  onChapter: (c: ChapterId) => void; onNextChapter: () => void;
}) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [searching, setSearching] = useState(true);
  const [box, setBox] = useState<Box | null>(null);
  const [card, setCard] = useState({ w: 360, h: 220 });
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [lost, setLost] = useState(0);                    // элемент пропал со страницы — искать снова
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const ids = useMemo(() => resolve(step.target, ctx) ?? [], [step, ctx]);

  // Найти элемент шага (страница могла только что открыться и ещё грузить данные)
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    const attempt = () => {
      if (cancelled) return;
      const found = ids.length ? findTarget(ids) : null;
      if (found) {
        scrollIntoViewIfNeeded(found);
        setEl(found); setSearching(false);
        return;
      }
      const elapsed = Date.now() - startedAt;
      if (!ids.length || elapsed > 3500) {
        setEl(null); setBox(null); setSearching(false);
        return;
      }
      // элемента долго нет (данные ещё грузятся) — показать подсказку по центру, но продолжать искать
      if (elapsed > 450) { setBox(null); setSearching(false); }
      timer = setTimeout(attempt, 120);
    };
    timer = setTimeout(() => { setSearching(true); attempt(); }, 30);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ids, index, lost]);

  // Следить за положением элемента: прокрутка, загрузка данных, смена размера окна
  useEffect(() => {
    if (!el) return;
    let raf = 0;
    const tick = () => {
      if (!el.isConnected) { setEl(null); setLost(n => n + 1); return; }
      const r = el.getBoundingClientRect();
      const next = { x: r.left, y: r.top, w: r.width, h: r.height };
      setBox(prev => (sameBox(prev, next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [el]);

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    const t = setTimeout(on, 0);
    window.addEventListener("resize", on);
    return () => { clearTimeout(t); window.removeEventListener("resize", on); };
  }, []);

  // Размер карточки — для расчёта, куда её поставить
  useLayoutEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => {
      const w = node.offsetWidth, h = node.offsetHeight;
      setCard(c => (c.w === w && c.h === h ? c : { w, h }));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // Фокус на главной кнопке при каждом шаге — чтобы Enter листал дальше
  useEffect(() => {
    if (!searching) primaryRef.current?.focus({ preventScroll: true });
  }, [index, searching]);

  // Клавиатура
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); onNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); onPrev(); }
      else if (e.key === "Tab" && cardRef.current) {
        const f = [...cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (!f.length) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        else if (i < 0) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, onNext, onPrev]);

  // ─── Геометрия ──────────────────────────────────────────
  const vw = vp.w || 1024, vh = vp.h || 768;
  // пока ищем элемент следующего шага, подсветка остаётся на прежнем месте, потом переезжает
  const hole = box ? {
    x: Math.max(4, box.x - PAD),
    y: Math.max(4, box.y - PAD),
    r: Math.min(vw - 4, box.x + box.w + PAD),
    b: Math.min(vh - 4, box.y + box.h + PAD),
  } : null;

  let pos: { left: number; top: number; width?: number };
  const narrow = vw < 640;
  if (narrow) {
    // телефон: карточка снизу во всю ширину, а если подсвечено внизу — сверху
    const width = vw - EDGE * 2;
    const holeCenter = hole ? (hole.y + hole.b) / 2 : 0;
    const top = hole && holeCenter > vh * 0.55 ? EDGE : vh - card.h - EDGE;
    pos = { left: EDGE, top: Math.max(EDGE, top), width };
  } else if (!hole) {
    pos = { left: (vw - card.w) / 2, top: Math.max(EDGE, (vh - card.h) / 2) };
  } else {
    const clampX = (x: number) => Math.min(Math.max(EDGE, x), vw - card.w - EDGE);
    const clampY = (y: number) => Math.min(Math.max(EDGE, y), vh - card.h - EDGE);
    const cx = (hole.x + hole.r) / 2, cy = (hole.y + hole.b) / 2;
    if (vw - hole.r - GAP >= card.w + EDGE)        pos = { left: hole.r + GAP, top: clampY(cy - card.h / 2) };
    else if (vh - hole.b - GAP >= card.h + EDGE)   pos = { left: clampX(cx - card.w / 2), top: hole.b + GAP };
    else if (hole.y - GAP >= card.h + EDGE)        pos = { left: clampX(cx - card.w / 2), top: hole.y - GAP - card.h };
    else if (hole.x - GAP >= card.w + EDGE)        pos = { left: hole.x - GAP - card.w, top: clampY(cy - card.h / 2) };
    else                                           pos = { left: clampX(vw - card.w - EDGE * 2), top: clampY(vh - card.h - EDGE * 2) };
  }

  // ─── Содержимое ─────────────────────────────────────────
  const total = range[1] - range[0] + 1;
  const n = index - range[0] + 1;
  const isFirst = index === range[0];
  const isLast = index === range[1];
  const text = resolve(step.text, ctx) ?? "";
  const points = resolve(step.points, ctx) ?? [];
  const isWelcome = step.id === "welcome";
  const chapters = CHAPTER_ORDER.filter(c => c !== "intro" && c !== "finish" && steps.some(s => s.chapter === c));
  const fromChapter = manual && from !== "home" && chapters.includes(from) ? from : null;
  const nextChapter = (() => {
    if (!isLast) return null;
    const after = steps.slice(index + 1).find(s => s.chapter !== step.chapter && s.chapter !== "finish");
    return after ? after.chapter : null;
  })();

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="presentation">
      {/* Слой, который ловит нажатия: страница под туром не нажимается */}
      <div className={cn("absolute inset-0", !hole && "bg-[var(--tour-scrim)]")} aria-hidden="true" />

      {hole && (
        <div
          aria-hidden="true"
          className="tour-spotlight pointer-events-none absolute rounded-[10px] transition-[left,top,width,height] duration-300 ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none"
          style={{ left: hole.x, top: hole.y, width: hole.r - hole.x, height: hole.b - hole.y }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        className={cn(
          "absolute flex max-h-[calc(100dvh-24px)] flex-col overflow-hidden rounded-[12px] bg-popover text-popover-foreground shadow-pop",
          "transition-[left,top,opacity] duration-200 ease-out motion-reduce:transition-none",
          narrow ? "" : "w-[360px]",
          searching && !box ? "opacity-0" : "opacity-100",
        )}
        style={{ left: pos.left, top: pos.top, width: pos.width }}
      >
        <div className="flex items-center gap-2 px-4 pt-3.5">
          <span className="metric-label min-w-0 flex-1 truncate">
            {CHAPTER_LABELS[step.chapter]}
            <span className="ml-1.5 normal-case tracking-normal tabular-nums">· {n} из {total}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть тур"
            className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-text-3 transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="mx-4 mt-2 h-[3px] overflow-hidden rounded-full bg-accent" aria-hidden="true">
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${(n / total) * 100}%` }} />
        </div>

        <div className="min-h-0 overflow-y-auto px-4 pb-1 pt-3" aria-live="polite">
          <h2 id="tour-title" className="text-[14.5px] font-bold leading-snug tracking-[-0.01em]">{step.title}</h2>
          <p id="tour-text" className="mt-1.5 text-[12.5px] leading-relaxed text-text-2">{text}</p>
          {points.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {points.map(p => (
                <li key={p} className="flex gap-2 text-[12px] leading-snug text-text-2">
                  <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}

          {isWelcome && chapters.length > 1 && (
            <div className="mt-3.5">
              <p className="metric-label mb-1.5">Или сразу к разделу</p>
              <div className="flex flex-wrap gap-1.5">
                {chapters.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChapter(c)}
                    className={cn(
                      "rounded-full border px-2.5 py-[3px] text-[11px] font-semibold transition-colors",
                      c === fromChapter
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border bg-card text-text-2 hover:border-brand hover:text-brand",
                    )}
                  >
                    {CHAPTER_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-3">
          {isWelcome ? (
            <button type="button" onClick={onClose}
              className="mr-auto h-8 rounded-[7px] px-2 text-[12px] font-semibold text-text-3 transition-colors hover:bg-accent hover:text-foreground">
              Не сейчас
            </button>
          ) : (
            <button type="button" onClick={onPrev} disabled={isFirst}
              className="mr-auto inline-flex h-8 items-center gap-1 rounded-[7px] border border-border bg-card px-2.5 text-[12px] font-semibold text-text-2 transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Назад
            </button>
          )}

          {isWelcome && fromChapter && (
            <button type="button" onClick={() => onChapter(fromChapter)}
              className="inline-flex h-8 items-center rounded-[7px] border border-border bg-card px-2.5 text-[12px] font-semibold text-text-2 transition-colors hover:bg-accent">
              Только «{CHAPTER_LABELS[fromChapter]}»
            </button>
          )}
          {isLast && nextChapter && (
            <button type="button" onClick={onNextChapter}
              className="inline-flex h-8 items-center gap-1 rounded-[7px] border border-border bg-card px-2.5 text-[12px] font-semibold text-text-2 transition-colors hover:bg-accent">
              Дальше: {CHAPTER_LABELS[nextChapter]}
            </button>
          )}

          <button ref={primaryRef} type="button" onClick={onNext}
            className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-brand px-3.5 text-[12px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong">
            {isLast ? <><Check className="h-3.5 w-3.5" strokeWidth={2.2} /> Готово</>
              : isWelcome ? <>Начать <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} /></>
              : <>Далее <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} /></>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
