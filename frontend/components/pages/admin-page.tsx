"use client";

import { useState, useEffect } from "react";
import { fetchMe, type AuthUser } from "@/lib/api";
import { PageContent, SectionCard, Skeleton, ErrorBanner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface User { id: string; name: string; role: string; last_seen?: string; }

async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/admin/users", { credentials: "include" });
  if (!res.ok) throw new Error("Ошибка загрузки");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.users ?? []);
}
async function addUser(id: string, name: string, role: string) {
  const res = await fetch("/api/admin/users", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name, role }),
  });
  if (!res.ok) throw new Error("Ошибка добавления");
}
async function deleteUser(id: string) {
  const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Ошибка удаления");
}
async function updateUserRole(id: string, role: string) {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Ошибка обновления");
}

const ROLES = [
  { value: "owner",   label: "Владелец"      },
  { value: "admin",   label: "Администратор" },
  { value: "viewer",  label: "Наблюдатель"   },
];
const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец", admin: "Администратор", viewer: "Наблюдатель"
};

export function AdminPage() {
  const [me,      setMe]      = useState<AuthUser | null>(null);
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [newId,   setNewId]   = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [adding,  setAdding]  = useState(false);

  useEffect(() => {
    Promise.all([fetchMe(), fetchUsers()])
      .then(([m, u]) => { setMe(m); setUsers(u); })
      .catch(e => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!newId.trim()) return;
    setAdding(true);
    try {
      await addUser(newId.trim(), newName.trim(), newRole);
      const u = await fetchUsers();
      setUsers(u);
      setNewId(""); setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally { setAdding(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить сотрудника?")) return;
    try {
      await deleteUser(id);
      setUsers(u => u.filter(x => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function handleRoleChange(id: string, role: string) {
    try {
      await updateUserRole(id, role);
      setUsers(u => u.map(x => x.id === id ? { ...x, role } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-5">
        <span className="text-[13px] font-bold">Доступ</span>
        <span className="text-[12px] text-muted-foreground/60">Кто может открывать «Пульс» и что ему разрешено</span>
      </header>

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            {/* Users list */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-[13px] font-semibold">Сотрудники</h3>
                <span className="text-[11px] text-muted-foreground/60">{users.length} чел.</span>
              </div>
              <div className="divide-y divide-border">
                {users.length === 0 && (
                  <div className="px-4 py-8 text-center text-[12px] text-muted-foreground/50">
                    Нет сотрудников
                  </div>
                )}
                {users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                      {(u.name?.[0] ?? u.id[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold">{u.name || `ID ${u.id}`}</span>
                        {me && u.id === me.id && (
                          <span className="text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5">вы</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                        ID {u.id}{u.last_seen ? ` · последний вход: ${u.last_seen}` : ""}
                      </div>
                    </div>
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      disabled={me?.id === u.id}
                      className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-60"
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    {me?.id !== u.id && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors text-base"
                        title="Удалить"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add form */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-[13px] font-semibold">Добавить сотрудника</h3>
              </div>
              <div className="p-4">
                <div className="flex gap-3 flex-wrap items-end">
                  {[
                    { label: "ID в Битрикс24", val: newId, set: setNewId, ph: "784", w: 100, type: "text" },
                    { label: "Имя (необязательно)", val: newName, set: setNewName, ph: "Имя Фамилия", w: 180, type: "text" },
                  ].map((f, i) => (
                    <div key={i}>
                      <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 mb-1.5">{f.label}</p>
                      <input
                        type={f.type} value={f.val} placeholder={f.ph}
                        onChange={e => f.set(e.target.value)}
                        style={{ width: f.w }}
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-[13px] outline-none focus:border-foreground/30 transition-colors"
                      />
                    </div>
                  ))}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground/60 mb-1.5">Роль</p>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-[13px]">
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={handleAdd} disabled={!newId.trim() || adding}
                    className="px-4 py-1.5 rounded-md bg-foreground text-background text-[13px] font-semibold disabled:opacity-50 transition-opacity"
                  >
                    {adding ? "Добавление…" : "Добавить"}
                  </button>
                </div>
                <p className="mt-3 text-[12px] text-muted-foreground/50 leading-relaxed max-w-[520px]">
                  ID — число из адреса профиля сотрудника: …/company/personal/user/<strong>ЧИСЛО</strong>/.
                  Проще дождаться, пока сотрудник сам откроет приложение — он появится в запросах выше автоматически.
                </p>
              </div>
            </div>
          </>
        )}
      </PageContent>
    </div>
  );
}
