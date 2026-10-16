"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bot, Check, Eye, Send, TriangleAlert } from "lucide-react";
import { adminApi, digestApi, type AdminUser, type DigestResult, type DigestSettings } from "@/lib/admin-api";
import { SectionCard, Skeleton } from "@/components/ui/primitives";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

/**
 * Утренняя сводка: каждое утро бот «Пульс» присылает выбранным сотрудникам
 * личное сообщение в Битрикс24 с итогами вчерашнего дня. Каждый видит только
 * разделы, к которым у него есть доступ.
 */

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

/** Текст сводки с BB-кодами Битрикса → абзацы с жирными заголовками. */
function renderBB(text: string): ReactNode {
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />;
    const parts = line.replace(/\[url=[^\]]*\](.*?)\[\/url\]/g, "$1").split(/\[b\](.*?)\[\/b\]/g);
    return (
      <p key={i} className="leading-[1.55]">
        {parts.map((p, j) => (j % 2 ? <strong key={j} className="font-bold text-foreground">{p}</strong> : p))}
      </p>
    );
  });
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        on ? "bg-brand" : "bg-border",
      )}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full bg-card shadow-sm transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

function ResultLine({ r }: { r: DigestResult }) {
  if (r.skipped) return <span>за {fmtDay(r.for_day)}: не отправлялась — {r.skipped.toLowerCase()}</span>;
  return (
    <span>
      за {fmtDay(r.for_day)}: доставлено {r.sent.length}
      {r.failed.length > 0 && <span className="text-red-600 dark:text-red-400">, не доставлено {r.failed.length}</span>}
      {r.sent.some(s => s.via === "notify") && " (уведомлением)"}
    </span>
  );
}

export function DigestSettingsCard({ meId }: { meId?: string }) {
  const [cfg, setCfg]       = useState<DigestSettings | null>(null);
  const [users, setUsers]   = useState<AdminUser[]>([]);
  const [draft, setDraft]   = useState<Pick<DigestSettings, "enabled" | "time" | "recipients" | "app_url"> | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [preview, setPreview] = useState<{ text: string; for_day: string } | null>(null);
  const [busy, setBusy]     = useState<"preview" | "test" | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function load(next: DigestSettings) {
    setCfg(next);
    setDraft({ enabled: next.enabled, time: next.time, recipients: next.recipients, app_url: next.app_url });
  }

  useEffect(() => {
    Promise.all([digestApi.get(), adminApi.users()])
      .then(([d, u]) => { load(d); setUsers(u.users); })
      .catch(e => setError(e instanceof Error ? e.message : "Ошибка загрузки"));
  }, []);

  const active = useMemo(() => users.filter(u => u.is_active), [users]);

  const dirty = !!cfg && !!draft && (
    draft.enabled !== cfg.enabled || draft.time !== cfg.time || draft.app_url !== cfg.app_url ||
    [...draft.recipients].sort().join() !== [...cfg.recipients].sort().join()
  );

  async function save() {
    if (!draft) return;
    setSaving(true); setError(null);
    try {
      load(await digestApi.save(draft));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить"); }
    finally { setSaving(false); }
  }

  async function showPreview() {
    if (preview) { setPreview(null); return; }
    setBusy("preview"); setError(null);
    try { setPreview(await digestApi.preview()); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось построить сводку"); }
    finally { setBusy(null); }
  }

  async function sendTest() {
    setBusy("test"); setTestMsg(null); setError(null);
    try {
      const r = await digestApi.test();
      setCfg(r.digest);
      if (r.sent.length) {
        setTestMsg({ ok: true, text: r.sent[0].via === "bot"
          ? "Отправлено — проверьте сообщения от бота «Пульс» в Битрикс24"
          : "Отправлено уведомлением: бот пока недоступен, см. подсказку выше" });
      } else {
        setTestMsg({ ok: false, text: r.failed[0]?.error ?? r.skipped ?? "Не отправлено" });
      }
    } catch (e) { setTestMsg({ ok: false, text: e instanceof Error ? e.message : "Не отправлено" }); }
    finally { setBusy(null); }
  }

  if (!cfg || !draft) {
    return error
      ? <SectionCard title="Утренняя сводка"><p className="text-[12px] text-red-600 dark:text-red-400">{error}</p></SectionCard>
      : <Skeleton className="h-56" />;
  }

  const toggleRecipient = (id: string) =>
    setDraft(d => d && ({ ...d, recipients: d.recipients.includes(id) ? d.recipients.filter(r => r !== id) : [...d.recipients, id] }));

  const labelCls = "mb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3";
  const inputCls = "h-8 rounded-[7px] border border-border bg-card px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-brand";

  return (
    <SectionCard
      title="Утренняя сводка"
      right={cfg.last_result ? <ResultLine r={cfg.last_result} /> : "ещё не отправлялась"}
    >
      <div className="space-y-5">
        <p className="max-w-[640px] text-[12px] leading-relaxed text-text-2">
          Каждое утро бот «Пульс» присылает в личные сообщения Битрикс24 итоги вчерашнего дня: звонки,
          приёмы, выручку, выполнение плана и что требует внимания. Перед отправкой вчерашний день
          дособирается целиком. Каждый получатель видит только разделы, к которым у него есть доступ.
        </p>

        {cfg.bot_error && (
          <div className="flex gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Бот «Пульс» не создан — сводка придёт обычным уведомлением</p>
              <p className="mt-0.5">{cfg.bot_error}</p>
            </div>
          </div>
        )}

        {/* Включение и время */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <label className="flex cursor-pointer items-center gap-2.5">
            <Toggle on={draft.enabled} onChange={v => setDraft(d => d && ({ ...d, enabled: v }))} label="Отправлять сводку" />
            <span className="text-[13px] font-semibold">Отправлять каждое утро</span>
          </label>
          <div>
            <p className={labelCls}>Время, по Кемерово</p>
            <input
              type="time" step={300} value={draft.time}
              onChange={e => e.target.value && setDraft(d => d && ({ ...d, time: e.target.value }))}
              className={cn(inputCls, "w-[120px] tabular-nums")}
              aria-label="Время отправки"
            />
          </div>
          <div className="min-w-0 flex-1 basis-[280px]">
            <p className={labelCls}>Ссылка на «Пульс» в портале</p>
            <input
              type="url" value={draft.app_url} placeholder="https://mfk-sfera.bitrix24.ru/marketplace/app/…"
              onChange={e => setDraft(d => d && ({ ...d, app_url: e.target.value }))}
              className={cn(inputCls, "w-full")}
              aria-label="Ссылка на приложение в портале"
            />
          </div>
        </div>
        <p className="-mt-3 text-[11px] text-text-3">
          Ссылка нужна для кнопки «Открыть «Пульс»» под сводкой: откройте приложение в Битрикс24 и скопируйте адрес из строки браузера.
        </p>

        {/* Получатели */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className={cn(labelCls, "mb-0")}>Кому отправлять</p>
            <span className="text-[11px] text-text-3">выбрано {active.filter(u => draft.recipients.includes(u.id)).length} из {active.length}</span>
          </div>
          {active.length === 0 ? (
            <p className="text-[12px] text-text-3">Нет активных сотрудников</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {active.map(u => {
                const on = draft.recipients.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-[8px] border px-3 py-2 transition-colors",
                      on ? "border-brand/40 bg-brand-soft" : "border-border hover:bg-accent",
                    )}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleRecipient(u.id)} className="h-3.5 w-3.5 accent-[var(--color-brand)]" />
                    <UserAvatar name={u.name || u.id} src={u.avatar} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {u.name || `ID ${u.id}`}{meId === u.id && <span className="text-text-3"> · вы</span>}
                      </span>
                      <span className="block text-[11px] text-text-3">{u.role_name}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {cfg.last_result && cfg.last_result.failed.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3.5 py-2.5 text-[12px] text-red-600 dark:text-red-400">
            <p className="font-semibold">Не доставлено в прошлый раз:</p>
            {cfg.last_result.failed.map(f => <p key={f.id}>{f.name || `ID ${f.id}`} — {f.error}</p>)}
          </div>
        )}

        {error && <p className="text-[12px] font-medium text-red-600 dark:text-red-400">{error}</p>}

        {/* Действия */}
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
          <button
            type="button" onClick={save} disabled={!dirty || saving}
            className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-brand px-3.5 text-[12.5px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-50"
          >
            {saved ? <><Check className="h-3.5 w-3.5" />Сохранено</> : saving ? "Сохранение…" : "Сохранить"}
          </button>
          <button
            type="button" onClick={showPreview} disabled={busy === "preview"}
            className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-border bg-card px-3 text-[12.5px] font-medium text-text-2 transition-colors hover:bg-accent disabled:opacity-60"
          >
            <Eye className="h-3.5 w-3.5" />{preview ? "Скрыть пример" : busy === "preview" ? "Готовлю…" : "Как она выглядит"}
          </button>
          <button
            type="button" onClick={sendTest} disabled={busy === "test"}
            className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-border bg-card px-3 text-[12.5px] font-medium text-text-2 transition-colors hover:bg-accent disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />{busy === "test" ? "Отправляю…" : "Отправить мне сейчас"}
          </button>
          {dirty && !saving && <span className="text-[11px] text-amber-600 dark:text-amber-400">есть несохранённые изменения</span>}
        </div>
        {testMsg && (
          <p className={cn("-mt-2 text-[12px] font-medium", testMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {testMsg.text}
          </p>
        )}

        {preview && (
          <div className="rounded-[10px] border border-border bg-background p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] text-text-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-foreground"><Bot className="h-3.5 w-3.5" /></span>
              <span><span className="font-semibold text-text-2">Пульс</span> · так сводка за {fmtDay(preview.for_day)} выглядит для вас</span>
            </div>
            <div className="max-w-[560px] rounded-[10px] bg-card px-4 py-3 text-[13px] text-text-2 shadow-card">
              {renderBB(preview.text)}
              {cfg.app_url && (
                <div className="mt-3 rounded-[7px] bg-brand py-1.5 text-center text-[12.5px] font-semibold text-brand-foreground">Открыть «Пульс»</div>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
