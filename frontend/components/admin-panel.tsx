"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-gate";
import {
  adminApi,
  type AccessRequest,
  type AdminMeta,
  type AdminUser,
} from "@/lib/admin-api";

const btn = "px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors";
const btnPrimary = `${btn} bg-foreground text-background`;
const btnGhost = `${btn} border border-border hover:bg-muted/40`;
const field = "h-8 rounded-lg border border-border bg-background px-2 text-xs";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

// ─── Галочки прав ────────────────────────────────────────────

function PermissionChecks({
  meta, value, onChange, disabled, canGrant,
}: {
  meta: AdminMeta;
  value: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  canGrant: (key: string) => boolean;
}) {
  const groups = Array.from(new Set(meta.permissions.map(p => p.group)));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map(g => (
        <div key={g}>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g}</div>
          <div className="space-y-1">
            {meta.permissions.filter(p => p.group === g).map(p => {
              const blocked = !canGrant(p.key);
              return (
                <label
                  key={p.key}
                  className={`flex items-center gap-2 text-xs ${disabled || blocked ? "opacity-50" : "cursor-pointer"}`}
                  title={blocked && !disabled ? "Выдать это право вы не можете" : undefined}
                >
                  <input
                    type="checkbox"
                    aria-label={p.label}
                    checked={value.includes(p.key)}
                    disabled={disabled || blocked}
                    onChange={e =>
                      onChange(e.target.checked ? [...value, p.key] : value.filter(k => k !== p.key))
                    }
                  />
                  {p.label}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Строка сотрудника ───────────────────────────────────────

function UserRow({
  u, meta, roleOptions, canGrant, onChanged, onError,
}: {
  u: AdminUser;
  meta: AdminMeta;
  roleOptions: { id: string; label: string }[];
  canGrant: (key: string) => boolean;
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { user: me } = useAuth();
  const [role, setRole] = useState(u.role);
  const [perms, setPerms] = useState<string[]>(u.permissions);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSelf = u.id === me.id;
  const lockedByOwner = u.role === "owner" && me.role !== "owner";
  const readOnly = isSelf || lockedByOwner;
  const dirty = role !== u.role || !sameSet(perms, u.permissions);
  const roleLabel = meta.roles.find(r => r.id === role)?.label ?? role;

  function pickRole(next: string) {
    setRole(next);
    setPerms(meta.roles.find(r => r.id === next)?.permissions ?? []);   // шаблон роли заполняет галочки
  }

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try { await fn(); onChanged(okMsg); } catch (e) { onError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }

  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${u.is_active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {u.name || "Без имени"}
            {isSelf && <span className="ml-2 text-[11px] font-normal text-muted-foreground">это вы</span>}
            {!u.is_active && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal">Отключён</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">
            ID {u.id} · последний вход: {fmt(u.last_login_at)}
          </div>
        </div>

        <select
          aria-label={`Роль: ${u.name || u.id}`}
          className={field}
          value={role}
          disabled={readOnly || busy}
          onChange={e => pickRole(e.target.value)}
        >
          {/* текущая роль показывается всегда, даже если её нельзя назначить */}
          {!roleOptions.some(r => r.id === role) && <option value={role}>{roleLabel}</option>}
          {roleOptions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>

        <button className={btnGhost} onClick={() => setOpen(o => !o)}>
          Права ({role === "owner" ? "все" : `${perms.length} из ${meta.permissions.length}`})
        </button>

        {dirty && !readOnly && (
          <button
            className={btnPrimary}
            disabled={busy}
            onClick={() => run(() => adminApi.patchUser(u.id, { role, permissions: perms }), "Права сохранены")}
          >
            Сохранить
          </button>
        )}
        {!readOnly && (
          <button
            className={btnGhost}
            disabled={busy}
            onClick={() => run(() => adminApi.patchUser(u.id, { is_active: !u.is_active }),
                               u.is_active ? "Доступ отключён" : "Доступ включён")}
          >
            {u.is_active ? "Отключить" : "Включить"}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <PermissionChecks
            meta={meta}
            value={role === "owner" ? meta.permissions.map(p => p.key) : perms}
            onChange={setPerms}
            disabled={readOnly || busy || role === "owner"}
            canGrant={canGrant}
          />
          {isSelf && <p className="mt-3 text-[11px] text-muted-foreground">Свои права менять нельзя, чтобы случайно не потерять доступ.</p>}
          {lockedByOwner && <p className="mt-3 text-[11px] text-muted-foreground">Запись владельца может менять только владелец.</p>}
          {role === "owner" && !readOnly && <p className="mt-3 text-[11px] text-muted-foreground">У владельца всегда все права.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Запрос на доступ ────────────────────────────────────────

function RequestRow({
  r, roleOptions, onChanged, onError,
}: {
  r: AccessRequest;
  roleOptions: { id: string; label: string }[];
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [role, setRole] = useState(roleOptions.find(o => o.id === "viewer")?.id ?? roleOptions[0]?.id ?? "viewer");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try { await fn(); onChanged(okMsg); } catch (e) { onError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{r.name || "Без имени"}</div>
        <div className="text-[11px] text-muted-foreground">ID {r.id} · запрос: {fmt(r.last_requested_at)}</div>
      </div>
      <select aria-label={`Роль для запроса: ${r.name || r.id}`} className={field} value={role}
              disabled={busy} onChange={e => setRole(e.target.value)}>
        {roleOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <button className={btnPrimary} disabled={busy}
              onClick={() => run(() => adminApi.approve(r.id, role), "Доступ выдан")}>Разрешить</button>
      <button className={btnGhost} disabled={busy}
              onClick={() => run(() => adminApi.dismiss(r.id), "Запрос отклонён")}>Отклонить</button>
    </div>
  );
}

// ─── Панель ──────────────────────────────────────────────────

export function AdminPanel() {
  const { user: me, can } = useAuth();
  const [meta, setMeta] = useState<AdminMeta | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [adding, setAdding] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [m, u, r] = await Promise.all([adminApi.meta(), adminApi.users(), adminApi.requests()]);
      setMeta(m); setUsers(u.users); setRequests(r.requests); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (!meta) {
    return error
      ? <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-500">{error}</div>
      : null;
  }

  const isOwner = me.role === "owner";
  const roleOptions = meta.roles.filter(r => isOwner || r.id !== "owner").map(r => ({ id: r.id, label: r.label }));
  const canGrant = (key: string) => isOwner || (!meta.owner_only.includes(key) && can(key));

  const done = (msg: string) => { setNotice(msg); setError(null); reload(); };
  const fail = (msg: string) => { setError(msg); setNotice(null); };

  async function add() {
    setAdding(true);
    try {
      await adminApi.addUser({ bitrix_user_id: newId.trim(), name: newName.trim(), role: newRole });
      setNewId(""); setNewName(""); done("Сотрудник добавлен");
    } catch (e) { fail(e instanceof Error ? e.message : "Ошибка"); }
    finally { setAdding(false); }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-base font-semibold">Доступ</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Кто может открывать приложение и что ему разрешено. Если сотрудника нет в списке, приложение для него не откроется.
        </p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-500">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-600">{notice}</div>}

      {requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Запросы на доступ ({requests.length})</h2>
          <p className="text-xs text-muted-foreground">Эти сотрудники открыли приложение, но их нет в списке.</p>
          {requests.map(r => (
            <RequestRow key={r.id} r={r} roleOptions={roleOptions} onChanged={done} onError={fail} />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Сотрудники ({users.length})</h2>
        {users.map(u => (
          <UserRow
            key={`${u.id}|${u.role}|${u.permissions.join(",")}|${u.is_active}`}
            u={u} meta={meta} roleOptions={roleOptions} canGrant={canGrant}
            onChanged={done} onError={fail}
          />
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Добавить сотрудника</h2>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">ID в Битрикс24</span>
            <input aria-label="ID в Битрикс24" className={`${field} w-28`} inputMode="numeric"
                   value={newId} onChange={e => setNewId(e.target.value)} placeholder="784" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Имя (необязательно)</span>
            <input aria-label="Имя" className={`${field} w-48`}
                   value={newName} onChange={e => setNewName(e.target.value)} />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Роль</span>
            <select aria-label="Роль нового сотрудника" className={field}
                    value={newRole} onChange={e => setNewRole(e.target.value)}>
              {roleOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <button className={btnPrimary} disabled={adding || !newId.trim()} onClick={add}>Добавить</button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          ID — число из адреса профиля сотрудника: …/company/personal/user/<b>ЧИСЛО</b>/. Проще всего дождаться, пока сотрудник
          сам откроет приложение: он появится в запросах выше, и ID вводить не придётся.
        </p>
      </section>
    </div>
  );
}
