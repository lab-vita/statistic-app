export type Section = "home" | "calls" | "appointments" | "revenue" | "reports" | "plans" | "admin";

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
};

export function canSeeSection(permissions: string[], section: Section): boolean {
  return permissions.includes(SECTION_PERMISSIONS[section]);
}

export function hasPerm(permissions: string[], perm: string): boolean {
  return permissions.includes(perm);
}
