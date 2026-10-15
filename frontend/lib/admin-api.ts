import { API_URL } from "./api";
import { authFetch } from "./auth";

export interface PermissionDef { key: string; label: string; group: string }
export interface RoleDef { id: string; label: string; permissions: string[] }
export interface AdminMeta { permissions: PermissionDef[]; roles: RoleDef[]; owner_only: string[] }

export interface AdminUser {
  id: string;
  name: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  created_at: string | null;
  last_login_at: string | null;
}

export interface AccessRequest {
  id: string;
  name: string;
  first_requested_at: string;
  last_requested_at: string;
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

export const adminApi = {
  meta:     ()                                  => call<AdminMeta>("GET", "/meta"),
  users:    ()                                  => call<{ users: AdminUser[] }>("GET", "/users"),
  requests: ()                                  => call<{ requests: AccessRequest[] }>("GET", "/requests"),
  addUser:  (b: { bitrix_user_id: string; name?: string; role: string; permissions?: string[] }) =>
              call<AdminUser>("POST", "/users", b),
  patchUser:(id: string, b: { role?: string; permissions?: string[]; is_active?: boolean }) =>
              call<AdminUser>("PATCH", `/users/${encodeURIComponent(id)}`, b),
  approve:  (id: string, role: string)          => call<AdminUser>("POST", `/requests/${encodeURIComponent(id)}/approve`, { role }),
  dismiss:  (id: string)                        => call<void>("DELETE", `/requests/${encodeURIComponent(id)}`),
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
