"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-gate";
import {
  adminApi,
  type AccessRequest,
  type AdminMeta,
  type AdminUser,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronDown } from "lucide-react";

const inputCls =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20";

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

// ─── Галочки прав ────────────────────────────────────────────

function PermissionChecks({
  meta,
  value,
  onChange,
  disabled,
  canGrant,
}: {
  meta: AdminMeta;
  value: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  canGrant: (key: string) => boolean;
}) {
  const groups = Array.from(new Set(meta.permissions.map((p) => p.group)));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {g}
          </div>
          <div className="space-y-2">
            {meta.permissions
              .filter((p) => p.group === g)
              .map((p) => {
                const blocked = !canGrant(p.key);
                return (
                  <label
                    key={p.key}
                    className={`flex items-center gap-2.5 text-xs ${
                      disabled || blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    }`}
                    title={blocked && !disabled ? "Выдать это право вы не можете" : undefined}
                  >
                    <input
                      type="checkbox"
                      aria-label={p.label}
                      checked={value.includes(p.key)}
                      disabled={disabled || blocked}
                      className="accent-foreground"
                      onChange={(e) =>
                        onChange(
                          e.target.checked
                            ? [...value, p.key]
                            : value.filter((k) => k !== p.key),
                        )
                      }
                    />
                    <span className="leading-none">{p.label}</span>
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
  u,
  meta,
  roleOptions,
  canGrant,
  onChanged,
  onError,
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
  const roleLabel = meta.roles.find((r) => r.id === role)?.label ?? role;

  function pickRole(next: string) {
    setRole(next);
    setPerms(meta.roles.find((r) => r.id === next)?.permissions ?? []);
  }

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      onChanged(okMsg);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={`p-4 ${u.is_active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {u.name || "Без имени"}
            </span>
            {isSelf && (
              <Badge variant="secondary" className="h-4 text-[10px]">
                вы
              </Badge>
            )}
            {!u.is_active && (
              <Badge variant="outline" className="h-4 text-[10px] text-muted-foreground">
                Отключён
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            ID {u.id} · последний вход: {fmt(u.last_login_at)}
          </div>
        </div>

        <select
          aria-label={`Роль: ${u.name || u.id}`}
          className={inputCls}
          value={role}
          disabled={readOnly || busy}
          onChange={(e) => pickRole(e.target.value)}
        >
          {!roleOptions.some((r) => r.id === role) && (
            <option value={role}>{roleLabel}</option>
          )}
          {roleOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>

        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => setOpen((o) => !o)}
        >
          Права ({role === "owner" ? "все" : `${perms.length} из ${meta.permissions.length}`})
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>

        {dirty && !readOnly && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              run(
                () => adminApi.patchUser(u.id, { role, permissions: perms }),
                "Права сохранены",
              )
            }
          >
            Сохранить
          </Button>
        )}
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(
                () => adminApi.patchUser(u.id, { is_active: !u.is_active }),
                u.is_active ? "Доступ отключён" : "Доступ включён",
              )
            }
          >
            {u.is_active ? "Отключить" : "Включить"}
          </Button>
        )}
      </div>

      {open && (
        <>
          <Separator className="my-4" />
          <PermissionChecks
            meta={meta}
            value={role === "owner" ? meta.permissions.map((p) => p.key) : perms}
            onChange={setPerms}
            disabled={readOnly || busy || role === "owner"}
            canGrant={canGrant}
          />
          {isSelf && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Свои права менять нельзя, чтобы случайно не потерять доступ.
            </p>
          )}
          {lockedByOwner && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Запись владельца может менять только владелец.
            </p>
          )}
          {role === "owner" && !readOnly && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              У владельца всегда все права.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Запрос на доступ ────────────────────────────────────────

function RequestRow({
  r,
  roleOptions,
  onChanged,
  onError,
}: {
  r: AccessRequest;
  roleOptions: { id: string; label: string }[];
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [role, setRole] = useState(
    roleOptions.find((o) => o.id === "viewer")?.id ?? roleOptions[0]?.id ?? "viewer",
  );
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      onChanged(okMsg);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{r.name || "Без имени"}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          ID {r.id} · запрос: {fmt(r.last_requested_at)}
        </div>
      </div>
      <select
        aria-label={`Роль для запроса: ${r.name || r.id}`}
        className={inputCls}
        value={role}
        disabled={busy}
        onChange={(e) => setRole(e.target.value)}
      >
        {roleOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={busy}
        onClick={() => run(() => adminApi.approve(r.id, role), "Доступ выдан")}
      >
        Разрешить
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => run(() => adminApi.dismiss(r.id), "Запрос отклонён")}
      >
        Отклонить
      </Button>
    </Card>
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

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, u, r] = await Promise.all([
          adminApi.meta(),
          adminApi.users(),
          adminApi.requests(),
        ]);
        if (cancelled) return;
        setMeta(m);
        setUsers(u.users);
        setRequests(r.requests);
        setError(null);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (!meta) {
    return error ? (
      <div
        role="alert"
        className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400"
      >
        {error}
      </div>
    ) : (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
        Загрузка…
      </div>
    );
  }

  const isOwner = me.role === "owner";
  const roleOptions = meta.roles
    .filter((r) => isOwner || r.id !== "owner")
    .map((r) => ({ id: r.id, label: r.label }));
  const canGrant = (key: string) =>
    isOwner || (!meta.owner_only.includes(key) && can(key));

  const done = (msg: string) => {
    setNotice(msg);
    setError(null);
    reload();
  };
  const fail = (msg: string) => {
    setError(msg);
    setNotice(null);
  };

  async function add() {
    setAdding(true);
    try {
      await adminApi.addUser({
        bitrix_user_id: newId.trim(),
        name: newName.trim(),
        role: newRole,
      });
      setNewId("");
      setNewName("");
      done("Сотрудник добавлен");
    } catch (e) {
      fail(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Доступ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Кто может открывать «Пульс» и что ему разрешено.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          {notice}
        </div>
      )}

      {/* Запросы */}
      {requests.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Запросы на доступ</h2>
            <Badge variant="secondary">{requests.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Эти сотрудники открыли приложение, но их нет в списке.
          </p>
          <div className="space-y-2">
            {requests.map((r) => (
              <RequestRow
                key={r.id}
                r={r}
                roleOptions={roleOptions}
                onChanged={done}
                onError={fail}
              />
            ))}
          </div>
        </section>
      )}

      {/* Сотрудники */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Сотрудники</h2>
          <Badge variant="secondary">{users.length}</Badge>
        </div>
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow
              key={`${u.id}|${u.role}|${u.permissions.join(",")}|${u.is_active}`}
              u={u}
              meta={meta}
              roleOptions={roleOptions}
              canGrant={canGrant}
              onChanged={done}
              onError={fail}
            />
          ))}
        </div>
      </section>

      {/* Добавить */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Добавить сотрудника</h2>
        <Card className="p-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-muted-foreground">ID в Битрикс24</span>
              <input
                aria-label="ID в Битрикс24"
                className={`${inputCls} w-28`}
                inputMode="numeric"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="784"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-muted-foreground">Имя (необязательно)</span>
              <input
                aria-label="Имя"
                className={`${inputCls} w-48`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-muted-foreground">Роль</span>
              <select
                aria-label="Роль нового сотрудника"
                className={inputCls}
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                {roleOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={adding || !newId.trim()}
              onClick={add}
              className="shrink-0"
            >
              Добавить
            </Button>
          </div>
        </Card>
        <p className="text-[11px] text-muted-foreground">
          ID — число из адреса профиля сотрудника: …/company/personal/user/
          <strong>ЧИСЛО</strong>/. Проще всего дождаться, пока сотрудник сам откроет
          приложение: он появится в запросах выше, и ID вводить не придётся.
        </p>
      </section>
    </div>
  );
}
