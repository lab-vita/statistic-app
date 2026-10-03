/**
 * Вход через Битрикс24.
 *
 * Битрикс открывает приложение → наш сервер проверяет пользователя и перенаправляет
 * на  /#t=<токен>.  Здесь токен забирается из адреса, прячется (адрес очищается)
 * и дальше добавляется ко всем запросам к API.
 *
 * Хранение: в памяти + sessionStorage. Куки не используются — в iframe их блокируют
 * многие браузеры (Safari, Chrome с блокировкой сторонних cookie).
 */
const KEY = "stats_token";
let memoryToken: string | null = null;

export const AUTH_LOST_EVENT = "stats-auth-lost";

/** Локальная разработка без Битрикс24: NEXT_PUBLIC_AUTH_DISABLED=true в .env.local */
export const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === "true";

export function captureTokenFromHash(): void {
  if (typeof window === "undefined") return;
  const match = window.location.hash.match(/[#&]t=([^&]+)/);
  if (!match) return;
  memoryToken = decodeURIComponent(match[1]);
  try {
    sessionStorage.setItem(KEY, memoryToken);
  } catch {
    /* хранилище недоступно — останется токен в памяти */
  }
  // Убираем токен из адресной строки и истории
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = sessionStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  return memoryToken;
}

export function clearToken(): void {
  memoryToken = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** fetch с токеном. Ответ 401 = вход потерян/просрочен → сообщаем интерфейсу. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && !AUTH_DISABLED) {
    clearToken();
    window.dispatchEvent(new Event(AUTH_LOST_EVENT));
  }
  return res;
}
