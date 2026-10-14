// Права доступа к разделам
export type Section =
  | "home"
  | "calls"
  | "appointments"
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
  revenue:      "view:revenue",
  reports:      "view:reports",
  funnel:       "view:funnel",
  plans:        "view:plans",
  doctors:      "view:revenue",
  admin:        "view:admin",
};
