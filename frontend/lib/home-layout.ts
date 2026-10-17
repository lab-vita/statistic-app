// ─── Раскладка главной на сервере ────────────────────────────────
//
// Виджеты главной хранятся у сотрудника на сервере (app_users.home_layout),
// поэтому главная одинаковая на любом компьютере, в браузере и в Битрикс24.
// null — сотрудник ещё ничего не настраивал: показывается раскладка по умолчанию.
//
// Сохранение — с небольшой задержкой (перетаскивание и изменение размера дают
// серию правок), а при закрытии вкладки неотправленное уходит сразу.

import { API_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import type { PlacedWidget } from "@/lib/grid";

const URL_ = () => `${API_URL}/api/auth/home-layout`;
const SAVE_DELAY = 500;
/** раньше раскладка жила в браузере — ключ больше не нужен */
const LEGACY_KEY = "grid_layout_v2";

/** undefined — с сервера ещё не загружали (на время работы вкладки держим в памяти) */
let cache: PlacedWidget[] | null | undefined;
let pending: { layout: PlacedWidget[] | null } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function cachedHomeLayout(): PlacedWidget[] | null | undefined {
  return cache;
}

export async function fetchHomeLayout(): Promise<PlacedWidget[] | null> {
  if (cache !== undefined) return cache;
  const res = await authFetch(URL_());
  if (!res.ok) throw new Error(`${res.status} — /api/auth/home-layout`);
  const body = (await res.json()) as { layout: PlacedWidget[] | null };
  cache = Array.isArray(body.layout) ? body.layout : null;
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* noop */ }
  return cache;
}

/** Сохранить раскладку (null — вернуть раскладку по умолчанию). */
export function saveHomeLayout(layout: PlacedWidget[] | null): void {
  cache = layout;
  pending = { layout };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void flush(); }, SAVE_DELAY);
}

async function flush(keepalive = false): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!pending) return;
  const body = JSON.stringify({ layout: pending.layout?.map(clean) ?? null });
  pending = null;
  try {
    const res = await authFetch(URL_(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive,
    });
    if (!res.ok) console.warn("[home-layout] не сохранилось:", res.status);
  } catch (e) {
    console.warn("[home-layout] не сохранилось:", e);
  }
}

/** Только то, что нужно для раскладки, — без лишних полей. */
function clean(p: PlacedWidget): PlacedWidget {
  return { id: p.id, type: p.type, x: p.x, y: p.y, w: p.w, h: p.h, ...(p.config ? { config: p.config } : {}) };
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { void flush(true); });
}
