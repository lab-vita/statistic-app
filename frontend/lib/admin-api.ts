import { API_URL } from "./api";
import { authFetch } from "./auth";

// /api/auth/me отдаёт ещё фото и название роли
declare module "./api" {
  interface AuthUser {
    avatar?:     string | null;
    role_label?: string;
  }
}

export interface PermissionDef { key: string; label: string; group: string; hint: string; requires: string[] }
export interface RoleDef {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  /** встроенная (Владелец) — менять нельзя */
  system: boolean;
  /** сколько сотрудников с этой ролью */
  users: number;
}
export interface AdminMeta {
  permissions: PermissionDef[];
  roles: RoleDef[];
  owner_only: string[];
  me: { id: string; is_owner: boolean; permissions: string[] };
}

export interface AdminUser {
  id: string;
  name: string;
  avatar: string | null;
  position: string | null;
  role: string;
  role_name: string;
  permissions: string[];
  is_active: boolean;
  created_at: string | null;
  last_login_at: string | null;
}

export interface AccessRequest {
  id: string;
  name: string;
  avatar: string | null;
  position: string | null;
  first_requested_at: string;
  last_requested_at: string;
}

/** Сотрудник портала Битрикс24 — для выбора, кому дать доступ */
export interface Employee {
  id: string;
  name: string;
  position: string | null;
  avatar: string | null;
  has_access: boolean;
  role: string | null;
}
export interface EmployeesResponse {
  /** full — весь список портала; search — только поиск по имени (у вебхука нет права «user») */
  mode: "full" | "search";
  users: Employee[];
  hint: string | null;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await authFetch(`${API_URL}/api/admin${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = "Не удалось выполнить действие";
    try {
      const j = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail)) msg = j.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ") || msg;
    } catch { /* тело не JSON */ }
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export interface RoleInput { name: string; description: string; permissions: string[] }

export const adminApi = {
  meta:       ()                                  => call<AdminMeta>("GET", "/meta"),
  users:      ()                                  => call<{ users: AdminUser[] }>("GET", "/users"),
  requests:   ()                                  => call<{ requests: AccessRequest[] }>("GET", "/requests"),
  employees:  (q: string)                         => call<EmployeesResponse>("GET", `/bitrix/employees?q=${encodeURIComponent(q)}`),
  addUsers:   (users: Pick<Employee, "id" | "name" | "avatar" | "position">[], role: string) =>
                call<{ added: string[]; skipped: string[] }>("POST", "/users", { users, role }),
  patchUser:  (id: string, b: { role?: string; is_active?: boolean }) =>
                call<AdminUser>("PATCH", `/users/${encodeURIComponent(id)}`, b),
  removeUser: (id: string)                        => call<void>("DELETE", `/users/${encodeURIComponent(id)}`),
  approve:    (id: string, role: string)          => call<AdminUser>("POST", `/requests/${encodeURIComponent(id)}/approve`, { role }),
  dismiss:    (id: string)                        => call<void>("DELETE", `/requests/${encodeURIComponent(id)}`),
  createRole: (b: RoleInput)                      => call<RoleDef>("POST", "/roles", b),
  updateRole: (id: string, b: Partial<RoleInput>) => call<RoleDef>("PATCH", `/roles/${encodeURIComponent(id)}`, b),
  deleteRole: (id: string)                        => call<void>("DELETE", `/roles/${encodeURIComponent(id)}`),
};

// ─── Утренняя сводка ────────────────────────────────────────

export interface DigestResult {
  at: string;
  for_day: string;
  sent: { id: string; name: string; via: "bot" | "notify" }[];
  failed: { id: string; name: string; error: string }[];
  skipped: string | null;
}

export interface DigestSettings {
  enabled: boolean;
  time: string;              // «ЧЧ:ММ» по Кемерово
  recipients: string[];      // ID сотрудников в Битрикс24
  app_url: string;
  bot_ready: boolean;
  bot_error: string | null;
  last_sent_for: string | null;
  last_result: DigestResult | null;
}

export const digestApi = {
  get:     () => call<DigestSettings>("GET", "/digest"),
  save:    (b: Partial<Pick<DigestSettings, "enabled" | "time" | "recipients" | "app_url">>) =>
             call<DigestSettings>("PUT", "/digest", b),
  preview: () => call<{ for_day: string; empty: boolean; text: string }>("GET", "/digest/preview"),
  test:    () => call<DigestResult & { digest: DigestSettings }>("POST", "/digest/test"),
};
