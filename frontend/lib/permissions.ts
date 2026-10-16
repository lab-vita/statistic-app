// Права доступа к разделам. Каталог прав и роли — на сервере (app/core/permissions.py),
// права пользователя приходят в /api/auth/me уже посчитанными по его роли.
export type Section =
  | "home"
  | "calls"
  | "appointments"
  | "patients"
  | "revenue"
  | "reports"
  | "funnel"
  | "plans"
  | "doctors"
  | "admin"
  | "about";

export type Permission =
  | "view:calls"
  | "view:appointments"
  | "view:patients"
  | "view:revenue"
  | "view:funnel"
  | "view:plans"
  | "view:reports"
  | "plans:edit"
  | "digest:manage"
  | "data:collect"
  | "users:manage";

/** Какие права открывают раздел (хватит любого). Без записи — раздел доступен всем. */
export const SECTION_PERMISSIONS: Partial<Record<Section, Permission[]>> = {
  calls:        ["view:calls"],
  appointments: ["view:appointments"],
  patients:     ["view:patients"],
  revenue:      ["view:revenue"],
  doctors:      ["view:revenue"],
  funnel:       ["view:funnel"],
  plans:        ["view:plans"],
  reports:      ["view:reports"],
  admin:        ["users:manage", "digest:manage"],
};

/** Есть ли право. У владельца — все права. */
export function canWith(permissions: string[], role: string, perm: string): boolean {
  if (role === "owner") return true;
  return permissions.includes(perm);
}

/** Разрешён ли раздел для данного набора прав */
export function sectionAllowed(permissions: string[], role: string, section: Section): boolean {
  const required = SECTION_PERMISSIONS[section];
  if (!required) return true; // home / about — доступны всем
  return required.some(p => canWith(permissions, role, p));
}
