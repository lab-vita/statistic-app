export type Section = "home" | "calls" | "appointments" | "revenue" | "reports" | "plans" | "admin" | "about";

export const ROLE_LABELS: Record<string, string> = {
  owner:   "Владелец",
  admin:   "Администратор",
  viewer:  "Наблюдатель",
};

const SECTION_PERMISSIONS: Record<Section, string> = {
  home:         "view:calls",
  calls:        "view:calls",
  appointments: "view:appointments",
  revenue:      "view:revenue",
  reports:      "view:reports",
  plans:        "view:plans",
  admin:        "users:manage",
  about:        "view:calls",   // доступен всем авторизованным пользователям
};

export function canSeeSection(permissions: string[], section: Section): boolean {
  return permissions.includes(SECTION_PERMISSIONS[section]);
}

export function hasPerm(permissions: string[], perm: string): boolean {
  return permissions.includes(perm);
}

// Алиасы для совместимости с auth-gate.tsx
export function canWith(permissions: string[], role: string, perm: string): boolean {
  if (role === "owner") return true;
  return permissions.includes(perm);
}

export function sectionAllowed(permissions: string[], role: string, section: Section): boolean {
  if (role === "owner") return true;
  return canSeeSection(permissions, section);
}
