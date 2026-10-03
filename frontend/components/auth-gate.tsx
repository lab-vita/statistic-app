"use client";

import { useEffect, useState } from "react";
import {
  AUTH_DISABLED,
  AUTH_LOST_EVENT,
  captureTokenFromHash,
  getToken,
} from "@/lib/auth";

type State = "checking" | "ok" | "denied";

/**
 * Пускает к дашборду только тех, кто пришёл из Битрикс24 (есть токен).
 * Токен проверяет сервер при каждом запросе — это лишь «экран-заглушка»,
 * чтобы не показывать пустой интерфейс с ошибками.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    if (AUTH_DISABLED) {
      setState("ok");
      return;
    }
    captureTokenFromHash();
    setState(getToken() ? "ok" : "denied");

    const onLost = () => setState("denied");
    window.addEventListener(AUTH_LOST_EVENT, onLost);
    return () => window.removeEventListener(AUTH_LOST_EVENT, onLost);
  }, []);

  if (state === "ok") return <>{children}</>;
  if (state === "checking") return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">Доступ ограничен</h2>
        <p className="text-sm text-muted-foreground">
          Это приложение доступно только внутри портала Битрикс24.
          <br />
          Откройте его через левое меню.
        </p>
      </div>
    </div>
  );
}
