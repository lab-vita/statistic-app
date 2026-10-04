/**
 * Права: ключи совпадают с бэкендом (backend/app/core/permissions.py).
 * Сервер проверяет права при каждом запросе; здесь они нужны только чтобы
 * не показывать человеку то, к чему у него всё равно нет доступа.
 */
export type Section = "home" | "calls" | "appointments" | "revenue" | "reports" | "plans" | "admin";

/** Какое право открывает раздел. null — доступно любому, кто есть в списке. */
export const SECTION_PERMISSION: Record<Section, string | null> = {
  home:         null,
  calls:        "view:calls",
  appointments: "view:appointments",
  revenue:      "view:revenue",
  reports:      "view:reports",
  plans:        "view:plans",
  admin:        "users:manage",
};

export const ROLE_LABELS: Record<string, string> = {
  owner:  "Владелец",
  admin:  "Администратор",
  viewer: "Наблюдатель",
};

export function canWith(permissions: readonly string[], role: string, perm: string): boolean {
  return role === "owner" || permissions.includes(perm);
}

export function sectionAllowed(permissions: readonly string[], role: string, section: Section): boolean {
  const need = SECTION_PERMISSION[section];
  return need === null || canWith(permissions, role, need);
}
