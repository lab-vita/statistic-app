"use client";

/**
 * Настройки → Роли: наборы прав с названием. Права действуют у всех, кому назначена роль.
 */
import { useMemo, useState } from "react";
import { Copy, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { adminApi, type AdminMeta, type PermissionDef, type RoleDef } from "@/lib/admin-api";
import type { AdminData } from "@/components/pages/admin-page";

type Draft = { id: string | null; name: string; description: string; permissions: string[] };

const NEW_ID = "__new__";

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Включить право вместе с теми, без которых оно не работает; выключить — вместе с зависящими. */
function togglePerm(perms: Set<string>, key: string, defs: PermissionDef[]): Set<string> {
  const next = new Set(perms);
  if (next.has(key)) {
    next.delete(key);
    let changed = true;
    while (changed) {
      changed = false;
      for (const d of defs) {
        if (next.has(d.key) && d.requires.some(r => !next.has(r))) { next.delete(d.key); changed = true; }
      }
    }
  } else {
    next.add(key);
    for (const r of defs.find(d => d.key === key)?.requires ?? []) next.add(r);
  }
  return next;
}

/** Может ли текущий пользователь менять роль (и выдавать это право) */
function controllable(meta: AdminMeta, perms: string[]): boolean {
  if (meta.me.is_owner) return true;
  const mine = new Set(meta.me.permissions);
  return perms.every(p => mine.has(p) && !meta.owner_only.includes(p));
}

function RoleEditor({ data, draft, setDraft, role, onSaved, onDeleted }: {
  data: AdminData;
  draft: Draft;
  setDraft: (d: Draft) => void;
  role: RoleDef | null;
  onSaved: (id: string) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const { meta } = data;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const groups = useMemo(() => {
    const out = new Map<string, PermissionDef[]>();
    for (const p of meta.permissions) out.set(p.group, [...(out.get(p.group) ?? []), p]);
    return [...out.entries()];
  }, [meta.permissions]);

  const isOwnRole = !!role && !meta.me.is_owner && data.users.some(u => u.id === meta.me.id && u.role === role.id);
  const readOnly = !!role && (role.system || isOwnRole || !controllable(meta, role.permissions));
  const perms = new Set(draft.permissions);
  const labelOf = (k: string) => meta.permissions.find(p => p.key === k)?.label ?? k;
  const members = role ? data.users.filter(u => u.role === role.id) : [];
  const dirty = !role
    || draft.name.trim() !== role.name
    || draft.description.trim() !== role.description
    || [...draft.permissions].sort().join() !== [...role.permissions].sort().join();

  const mayGrant = (key: string) =>
    meta.me.is_owner || (meta.me.permissions.includes(key) && !meta.owner_only.includes(key));

  async function save() {
    setBusy(true); setErr(null);
    try {
      const body = { name: draft.name.trim(), description: draft.description.trim(), permissions: draft.permissions };
      const saved = role ? await adminApi.updateRole(role.id, body) : await adminApi.createRole(body);
      await onSaved(saved.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!role) return;
    setBusy(true); setErr(null);
    try { await adminApi.deleteRole(role.id); await onDeleted(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Не удалось удалить"); setConfirmDel(false); }
    finally { setBusy(false); }
  }

  const inputCls = "w-full rounded-[7px] border border-border bg-card px-3 text-[13px] outline-none transition-colors " +
    "focus:border-brand disabled:cursor-not-allowed disabled:bg-accent/40";

  return (
    <div className="card-surface min-w-0 flex-1">
      <div className="space-y-3 border-b border-hairline px-5 py-4">
        {readOnly && (
          <p className="flex items-center gap-2 rounded-[8px] bg-accent px-3 py-2 text-[12px] text-text-2">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            {role?.system ? "Встроенная роль: у владельца всегда все права, её нельзя изменить."
              : isOwnRole ? "Это ваша роль — менять её может только владелец."
              : "У этой роли есть права, которых нет у вас, — менять её может только владелец."}
          </p>
        )}
        <label className="block">
          <span className="metric-label">Название</span>
          <input className={cn(inputCls, "mt-1 h-9 font-semibold")} value={draft.name} maxLength={60} disabled={readOnly}
                 placeholder="Например, «Старший администратор»"
                 onChange={e => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="block">
          <span className="metric-label">Описание</span>
          <input className={cn(inputCls, "mt-1 h-9")} value={draft.description} maxLength={300} disabled={readOnly}
                 placeholder="Кому подходит эта роль"
                 onChange={e => setDraft({ ...draft, description: e.target.value })} />
        </label>
      </div>

      <div className="space-y-4 px-5 py-4">
        {groups.map(([group, defs]) => (
          <fieldset key={group}>
            <legend className="metric-label mb-1.5">{group}</legend>
            <div className="grid gap-1.5 md:grid-cols-2">
              {defs.map(p => {
                const on = perms.has(p.key);
                const locked = readOnly || !mayGrant(p.key);
                return (
                  <label key={p.key} className={cn(
                    "flex items-start gap-2.5 rounded-[8px] border px-3 py-2 transition-colors",
                    on ? "border-brand/40 bg-brand-soft" : "border-border",
                    locked ? "cursor-not-allowed" : "cursor-pointer hover:border-brand/50",
                  )}>
                    <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-brand)]"
                           checked={on} disabled={locked}
                           onChange={() => setDraft({ ...draft, permissions: [...togglePerm(perms, p.key, meta.permissions)].sort() })} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium">{p.label}</span>
                      {p.hint && <span className="block text-[11px] leading-snug text-text-3">{p.hint}</span>}
                      {p.requires.length > 0 && (
                        <span className="block text-[11px] leading-snug text-text-3">
                          вместе с: {p.requires.map(labelOf).join(", ")}
                        </span>
                      )}
                      {!readOnly && !mayGrant(p.key) && (
                        <span className="block text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                          {meta.owner_only.includes(p.key) ? "выдаёт только владелец" : "нет у вас самого"}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <p className="text-[11px] text-text-3">«Главная» и «О системе» открыты всем, у кого есть доступ.</p>
      </div>

      {role && (
        <div className="border-t border-hairline px-5 py-3.5">
          <p className="metric-label mb-2">
            {members.length ? `${members.length} ${plural(members.length, "сотрудник", "сотрудника", "сотрудников")} с этой ролью` : "Роль пока никому не назначена"}
          </p>
          {members.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {members.map(u => (
                <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-accent py-0.5 pl-0.5 pr-2.5 text-[11.5px] font-medium">
                  <UserAvatar name={u.name || u.id} src={u.avatar} size={20} />
                  {u.name || `ID ${u.id}`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-3.5">
          {err && <p className="basis-full text-[12px] text-red-600 dark:text-red-400">{err}</p>}
          <button type="button" onClick={save} disabled={busy || !dirty || !draft.name.trim()}
                  className="flex h-9 items-center gap-1.5 rounded-[7px] bg-brand px-4 text-[13px] font-semibold text-brand-foreground hover:bg-brand-strong disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {role ? "Сохранить" : "Создать роль"}
          </button>
          {role && dirty && (
            <button type="button" onClick={() => setDraft({ id: role.id, name: role.name, description: role.description, permissions: role.permissions })}
                    className="h-9 rounded-[7px] border border-border bg-card px-3 text-[13px] font-medium text-text-2 hover:bg-accent">
              Отменить
            </button>
          )}
          {role && (
            confirmDel ? (
              <span className="ml-auto flex items-center gap-1.5">
                <span className="text-[12px] text-text-2">Удалить роль?</span>
                <button type="button" onClick={remove} disabled={busy}
                        className="h-9 rounded-[7px] bg-red-600 px-3 text-[13px] font-semibold text-brand-foreground hover:bg-red-700">
                  Удалить
                </button>
                <button type="button" onClick={() => setConfirmDel(false)}
                        className="h-9 rounded-[7px] border border-border bg-card px-3 text-[13px] text-text-2 hover:bg-accent">
                  Нет
                </button>
              </span>
            ) : (
              <button type="button" disabled={members.length > 0} onClick={() => setConfirmDel(true)}
                      title={members.length ? "Роль назначена сотрудникам — сначала выдайте им другую" : undefined}
                      className="ml-auto flex h-9 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium text-red-600 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-text-3 disabled:hover:bg-transparent dark:text-red-400 dark:disabled:text-text-3">
                <Trash2 className="h-3.5 w-3.5" /> Удалить
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function RolesPanel({ data, onChanged }: { data: AdminData; onChanged: () => Promise<void> }) {
  const { meta } = data;
  const [selected, setSelected] = useState<string>(meta.roles.find(r => !r.system)?.id ?? meta.roles[0]?.id ?? NEW_ID);
  const role = meta.roles.find(r => r.id === selected) ?? null;
  const [draft, setDraft] = useState<Draft>(() =>
    role ? { id: role.id, name: role.name, description: role.description, permissions: role.permissions }
         : { id: null, name: "", description: "", permissions: [] });

  const pick = (r: RoleDef | null, copyFrom?: RoleDef) => {
    if (r) {
      setSelected(r.id);
      setDraft({ id: r.id, name: r.name, description: r.description, permissions: r.permissions });
    } else {
      setSelected(NEW_ID);
      setDraft({
        id: null,
        name: copyFrom ? `${copyFrom.name} (копия)` : "",
        description: copyFrom?.description ?? "",
        permissions: copyFrom ? copyFrom.permissions.filter(p => meta.me.is_owner || (meta.me.permissions.includes(p) && !meta.owner_only.includes(p))) : [],
      });
    }
  };

  const total = meta.permissions.length;

  return (
    <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
      <div className="card-surface shrink-0 lg:w-[300px]">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h3 className="section-title">Роли</h3>
          <button type="button" onClick={() => pick(null)}
                  className="flex h-7 items-center gap-1 rounded-[7px] bg-brand px-2.5 text-[12px] font-semibold text-brand-foreground hover:bg-brand-strong">
            <Plus className="h-3.5 w-3.5" /> Новая
          </button>
        </div>
        <ul className="px-2 pb-2">
          {selected === NEW_ID && (
            <li>
              <span className="flex w-full items-center rounded-[8px] bg-brand-soft px-2.5 py-2 text-[13px] font-semibold text-brand">
                {draft.name.trim() || "Новая роль"}
              </span>
            </li>
          )}
          {meta.roles.map(r => (
            <li key={r.id} className="group relative">
              <button type="button" onClick={() => pick(r)} aria-current={selected === r.id}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-[8px] px-2.5 py-2 text-left transition-colors",
                        selected === r.id ? "bg-brand-soft" : "hover:bg-accent",
                      )}>
                <span className="min-w-0 flex-1">
                  <span className={cn("flex items-center gap-1.5 text-[13px] font-semibold", selected === r.id && "text-brand")}>
                    {r.name}
                    {r.system && <Lock className="h-3 w-3 text-text-3" aria-label="встроенная" />}
                  </span>
                  <span className="block text-[11px] text-text-3">
                    {r.users} {plural(r.users, "сотрудник", "сотрудника", "сотрудников")} · {r.system ? "все права" : `${r.permissions.length} из ${total} прав`}
                  </span>
                </span>
              </button>
              <button type="button" onClick={() => pick(null, r)} aria-label={`Создать копию роли ${r.name}`}
                      title="Создать на её основе"
                      className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-[7px] text-text-3 hover:bg-card hover:text-foreground group-hover:flex group-focus-within:flex">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <RoleEditor
        key={selected}
        data={data}
        draft={draft}
        setDraft={setDraft}
        role={selected === NEW_ID ? null : role}
        onSaved={async id => {
          await onChanged();
          setSelected(id);
        }}
        onDeleted={async () => {
          await onChanged();
          const first = meta.roles.find(r => !r.system && r.id !== selected) ?? meta.roles[0];
          if (first) pick(first);
        }}
      />
    </div>
  );
}
