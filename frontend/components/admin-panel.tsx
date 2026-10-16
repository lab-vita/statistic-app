"use client";

/**
 * Настройки → Доступ: кто открывает «Пульс» и с какой ролью.
 * Сотрудники добавляются выбором из списка портала Битрикс24, фото и должности — оттуда же.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, Loader2, Search, Trash2, UserPlus, X } from "lucide-react";
import { SectionCard, StatusPill } from "@/components/ui/primitives";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import {
  adminApi,
  type AdminMeta, type AdminUser, type Employee, type EmployeesResponse, type RoleDef,
} from "@/lib/admin-api";
import type { AdminData } from "@/components/pages/admin-page";

// ─── Общее ──────────────────────────────────────────────────

export function ago(iso: string | null): string {
  if (!iso) return "ещё не входил(а)";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 2) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

/** Может ли текущий пользователь выдавать эту роль */
export function canGrant(meta: AdminMeta, role: RoleDef): boolean {
  if (meta.me.is_owner) return true;
  if (role.id === "owner") return false;
  const mine = new Set(meta.me.permissions);
  return role.permissions.every(p => mine.has(p) && !meta.owner_only.includes(p));
}

function canTouch(meta: AdminMeta, u: AdminUser): boolean {
  if (u.id === meta.me.id) return false;
  if (meta.me.is_owner) return true;
  if (u.role === "owner") return false;
  const mine = new Set(meta.me.permissions);
  return u.permissions.every(p => mine.has(p));
}

const selectCls =
  "h-8 rounded-[7px] border border-border bg-card px-2 text-[12px] font-medium text-foreground " +
  "outline-none transition-colors hover:border-brand/50 focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-60";

export function RoleSelect({ meta, value, onChange, disabled, label }: {
  meta: AdminMeta; value: string; onChange: (v: string) => void; disabled?: boolean; label: string;
}) {
  const options = meta.roles.filter(r => r.id === value || canGrant(meta, r));
  return (
    <select aria-label={label} className={selectCls} value={value} disabled={disabled}
            onChange={e => onChange(e.target.value)}>
      {options.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  );
}

function useRowAction() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  };
  return { busy, err, run };
}

// ─── Строка сотрудника ────────────────────────────────────────

function UserRow({ u, meta, meId, onChanged }: {
  u: AdminUser; meta: AdminMeta; meId: string; onChanged: () => Promise<void>;
}) {
  const { busy, err, run } = useRowAction();
  const [confirm, setConfirm] = useState(false);
  const editable = canTouch(meta, u);

  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5", !u.is_active && "opacity-60")}>
      <UserAvatar name={u.name || u.id} src={u.avatar} size={36} />
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold">{u.name || `ID ${u.id}`}</span>
          {u.id === meId && <StatusPill color="blue">вы</StatusPill>}
          {!u.is_active && <StatusPill color="muted">отключён</StatusPill>}
        </div>
        <p className="truncate text-[11px] text-text-3">
          {u.position ? `${u.position} · ` : ""}{u.last_login_at ? `входил(а) ${ago(u.last_login_at)}` : "ещё не входил(а)"}
        </p>
        {err && <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">{err}</p>}
      </div>

      <div className="flex items-center gap-2">
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-3" aria-hidden="true" />}
        <RoleSelect meta={meta} value={u.role} label={`Роль: ${u.name}`} disabled={!editable || busy}
                    onChange={role => run(async () => { await adminApi.patchUser(u.id, { role }); await onChanged(); })} />
        {editable && (
          <button
            type="button"
            onClick={() => run(async () => { await adminApi.patchUser(u.id, { is_active: !u.is_active }); await onChanged(); })}
            disabled={busy}
            className="h-8 rounded-[7px] border border-border bg-card px-2.5 text-[12px] font-medium text-text-2 transition-colors hover:bg-accent disabled:opacity-60"
          >
            {u.is_active ? "Отключить" : "Включить"}
          </button>
        )}
        {editable && (confirm ? (
          <span className="flex items-center gap-1">
            <button type="button" disabled={busy}
                    onClick={() => run(async () => { await adminApi.removeUser(u.id); await onChanged(); })}
                    className="h-8 rounded-[7px] bg-red-600 px-2.5 text-[12px] font-semibold text-brand-foreground hover:bg-red-700">
              Убрать
            </button>
            <button type="button" aria-label="Не убирать" onClick={() => setConfirm(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-[7px] text-text-3 hover:bg-accent">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <button type="button" aria-label={`Убрать доступ: ${u.name}`} title="Убрать из списка доступа"
                  onClick={() => setConfirm(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-[7px] text-text-3 transition-colors hover:bg-red-500/10 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        ))}
      </div>
    </li>
  );
}

// ─── Запросы на доступ ──────────────────────────────────────

function Requests({ data, onChanged }: { data: AdminData; onChanged: () => Promise<void> }) {
  const { meta } = data;
  const fallback = meta.roles.find(r => r.id === "viewer" && canGrant(meta, r))?.id
    ?? meta.roles.find(r => canGrant(meta, r) && r.id !== "owner")?.id ?? "viewer";
  const [roles, setRoles] = useState<Record<string, string>>({});
  const { busy, err, run } = useRowAction();
  if (data.requests.length === 0) return null;

  return (
    <SectionCard title="Просят доступ" right={`${data.requests.length}`} noPad>
      <p className="px-4 pb-1 text-[12px] text-text-3 sm:px-5">
        Эти сотрудники открывали «Пульс», но их нет в списке. Выберите роль и разрешите — или отклоните.
      </p>
      {err && <p className="px-4 text-[12px] text-red-600 dark:text-red-400 sm:px-5">{err}</p>}
      <ul className="divide-y divide-hairline">
        {data.requests.map(r => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
            <UserAvatar name={r.name || r.id} src={r.avatar} size={36} />
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate text-[13px] font-semibold">{r.name || `ID ${r.id}`}</p>
              <p className="truncate text-[11px] text-text-3">
                {r.position ? `${r.position} · ` : ""}открывал(а) {ago(r.last_requested_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RoleSelect meta={meta} label={`Роль: ${r.name}`} value={roles[r.id] ?? fallback}
                          onChange={v => setRoles(s => ({ ...s, [r.id]: v }))} disabled={busy} />
              <button type="button" disabled={busy}
                      onClick={() => run(async () => { await adminApi.approve(r.id, roles[r.id] ?? fallback); await onChanged(); })}
                      className="flex h-8 items-center gap-1.5 rounded-[7px] bg-brand px-3 text-[12px] font-semibold text-brand-foreground hover:bg-brand-strong disabled:opacity-60">
                <Check className="h-3.5 w-3.5" /> Разрешить
              </button>
              <button type="button" disabled={busy}
                      onClick={() => run(async () => { await adminApi.dismiss(r.id); await onChanged(); })}
                      className="h-8 rounded-[7px] border border-border bg-card px-3 text-[12px] font-medium text-text-2 hover:bg-accent disabled:opacity-60">
                Отклонить
              </button>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ─── Добавление из Битрикс24 ────────────────────────────────

function AddDialog({ meta, onClose, onAdded }: {
  meta: AdminMeta; onClose: () => void; onAdded: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<EmployeesResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, Employee>>(new Map());
  const defaultRole = meta.roles.find(r => r.id === "viewer" && canGrant(meta, r))?.id
    ?? meta.roles.find(r => canGrant(meta, r) && r.id !== "owner")?.id ?? "viewer";
  const [role, setRole] = useState(defaultRole);
  const { busy, err, run } = useRowAction();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // поиск с задержкой; полный список сервер отдаёт и при пустой строке
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      adminApi.employees(q)
        .then(r => { if (alive) { setRes(r); setLoadErr(null); } })
        .catch(e => { if (alive) setLoadErr(e instanceof Error ? e.message : "Не удалось получить список"); });
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const toggle = (e: Employee) => setPicked(prev => {
    const next = new Map(prev);
    if (next.has(e.id)) next.delete(e.id); else next.set(e.id, e);
    return next;
  });

  const list = res?.users ?? [];
  const searchTooShort = res?.mode === "search" && q.trim().length < 3;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/30 p-3 sm:p-8"
         role="dialog" aria-modal="true" aria-label="Добавить сотрудников"
         onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card-surface flex max-h-[calc(100vh-24px)] w-full max-w-[560px] flex-col sm:max-h-[calc(100vh-64px)]">
        <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-bold">Добавить сотрудников</h2>
            <p className="text-[11px] text-text-3">Список сотрудников портала Битрикс24</p>
          </div>
          <button type="button" aria-label="Закрыть" onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-[7px] text-text-3 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 px-5 pt-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-3" />
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                   placeholder="Имя, фамилия или должность"
                   className="h-9 w-full rounded-[7px] border border-border bg-card pl-8 pr-3 text-[13px] outline-none focus:border-brand" />
          </label>
          {res?.hint && (
            <p className="flex gap-2 rounded-[8px] bg-amber-500/10 px-3 py-2 text-[11.5px] leading-snug text-amber-700 dark:text-amber-300">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" /> {res.hint}
            </p>
          )}
          {picked.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...picked.values()].map(p => (
                <button key={p.id} type="button" onClick={() => toggle(p)}
                        className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft py-0.5 pl-0.5 pr-2 text-[11.5px] font-medium">
                  <UserAvatar name={p.name} src={p.avatar} size={20} />
                  {p.name}
                  <X className="h-3 w-3 text-text-3" aria-label="убрать" />
                </button>
              ))}
            </div>
          )}
        </div>

        <ul className="mt-2 min-h-[160px] flex-1 overflow-y-auto px-2 pb-2">
          {loadErr ? (
            <li className="px-3 py-6 text-center text-[12px] text-red-600 dark:text-red-400">{loadErr}</li>
          ) : !res ? (
            <li className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-text-3" /></li>
          ) : searchTooShort ? (
            <li className="px-3 py-6 text-center text-[12px] text-text-3">Введите хотя бы 3 буквы имени или фамилии</li>
          ) : list.length === 0 ? (
            <li className="px-3 py-6 text-center text-[12px] text-text-3">Никого не нашлось</li>
          ) : list.map(e => {
            const on = picked.has(e.id);
            const roleName = e.role ? meta.roles.find(r => r.id === e.role)?.name ?? e.role : null;
            return (
              <li key={e.id}>
                <label className={cn(
                  "flex items-center gap-3 rounded-[8px] px-3 py-2 transition-colors",
                  e.has_access ? "cursor-default opacity-60" : "cursor-pointer hover:bg-accent",
                  on && "bg-brand-soft",
                )}>
                  <input type="checkbox" checked={on || e.has_access} disabled={e.has_access}
                         onChange={() => toggle(e)} className="h-3.5 w-3.5 accent-[var(--color-brand)]" />
                  <UserAvatar name={e.name} src={e.avatar} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{e.name}</span>
                    <span className="block truncate text-[11px] text-text-3">
                      {e.has_access ? `уже есть доступ · ${roleName}` : e.position || "—"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-3.5">
          <span className="text-[12px] text-text-3">Роль</span>
          <RoleSelect meta={meta} value={role} onChange={setRole} label="Роль для выбранных" />
          {err && <span className="basis-full text-[12px] text-red-600 dark:text-red-400">{err}</span>}
          <button type="button" disabled={picked.size === 0 || busy}
                  onClick={() => run(async () => {
                    await adminApi.addUsers([...picked.values()].map(({ id, name, avatar, position }) => ({ id, name, avatar, position })), role);
                    await onAdded();
                    onClose();
                  })}
                  className="ml-auto flex h-9 items-center gap-1.5 rounded-[7px] bg-brand px-4 text-[13px] font-semibold text-brand-foreground hover:bg-brand-strong disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Дать доступ{picked.size ? ` (${picked.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Вкладка ────────────────────────────────────────────────

export function AccessPanel({ data, meId, onChanged }: {
  data: AdminData; meId: string; onChanged: () => Promise<void>;
}) {
  const { meta, users } = data;
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [adding, setAdding] = useState(false);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter(u =>
      (!roleFilter || u.role === roleFilter) &&
      (!s || u.name.toLowerCase().includes(s) || (u.position ?? "").toLowerCase().includes(s)),
    );
  }, [users, q, roleFilter]);
  const active = users.filter(u => u.is_active).length;

  return (
    <>
      <Requests data={data} onChanged={onChanged} />

      <SectionCard
        title="Сотрудники с доступом"
        right={`${active} активных${users.length > active ? ` · ${users.length - active} отключено` : ""}`}
        noPad
      >
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-5">
          <label className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-3" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Найти сотрудника"
                   aria-label="Найти сотрудника"
                   className="h-8 w-full rounded-[7px] border border-border bg-card pl-8 pr-3 text-[12px] outline-none focus:border-brand" />
          </label>
          <select aria-label="Фильтр по роли" className={selectCls} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">Все роли</option>
            {meta.roles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.users})</option>)}
          </select>
          <button type="button" onClick={() => setAdding(true)}
                  className="flex h-8 items-center gap-1.5 rounded-[7px] bg-brand px-3 text-[12px] font-semibold text-brand-foreground hover:bg-brand-strong">
            <UserPlus className="h-3.5 w-3.5" /> Добавить
          </button>
        </div>
        <ul className="divide-y divide-hairline border-t border-hairline">
          {shown.length === 0 ? (
            <li className="px-5 py-8 text-center text-[12px] text-text-3">Никого не нашлось</li>
          ) : shown.map(u => (
            <UserRow key={`${u.id}|${u.role}|${u.is_active}`} u={u} meta={meta} meId={meId} onChanged={onChanged} />
          ))}
        </ul>
      </SectionCard>

      {adding && <AddDialog meta={meta} onClose={() => setAdding(false)} onAdded={onChanged} />}
    </>
  );
}
