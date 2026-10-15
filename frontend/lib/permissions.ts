// Права доступа к разделам
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
  | "view:revenue"
  | "view:calls"
  | "view:appointments"
  | "view:reports"
  | "view:funnel"
  | "view:plans"
  | "view:admin";

// Какое право нужно для просмотра раздела
export const SECTION_PERMISSIONS: Partial<Record<Section, Permission>> = {
  calls:        "view:calls",
  appointments: "view:appointments",
  patients:     "view:appointments",
  revenue:      "view:revenue",
  reports:      "view:reports",
  funnel:       "view:funnel",
  plans:        "view:plans",
  doctors:      "view:revenue",
  admin:        "view:admin",
};

// Вспомогательные функции для проверки прав

/** Есть ли нужное право в списке или роль admin/owner */
export function canWith(
  permissions: string[],
  role: string,
  perm: string,
): boolean {
  if (role === "admin" || role === "owner") return true;
  return permissions.includes(perm);
}

/** Разрешён ли раздел для данного набора прав */
export function sectionAllowed(
  permissions: string[],
  role: string,
  section: Section,
): boolean {
  const required = SECTION_PERMISSIONS[section];
  if (!required) return true; // home / about — доступны всем
  return canWith(permissions, role, required);
}
