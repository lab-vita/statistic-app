"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchMe, type Me } from "@/lib/api";
import {
  AUTH_DISABLED,
  AUTH_LOST_EVENT,
  captureTokenFromHash,
  getToken,
} from "@/lib/auth";
import { canWith, sectionAllowed, type Section } from "@/lib/permissions";

interface AuthValue {
  user: Me;
  can: (perm: string) => boolean;
  canSee: (section: Section) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Текущий пользователь и проверки прав. Работает только внутри <AuthGate>. */
export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth вне AuthGate");
  return v;
}

type State =
  | { kind: "checking" }
  | { kind: "denied" }
  | { kind: "error" }
  | { kind: "ok"; me: Me };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">{title}</h2>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/**
 * Пускает к дашборду только тех, кто пришёл из Битрикс24 и есть в списке доступа.
 * Токен и права проверяет сервер при каждом запросе; здесь мы лишь узнаём, кто вошёл
 * (/api/auth/me), чтобы показать нужные разделы.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: "checking" });

  const load = useCallback(async () => {
    setState({ kind: "checking" });
    try {
      const me = await fetchMe();
      setState({ kind: "ok", me });
    } catch {
      // 401 → authFetch уже стёр токен и сообщил интерфейсу; иначе — сбой сети/сервера
      setState(getToken() || AUTH_DISABLED ? { kind: "error" } : { kind: "denied" });
    }
  }, []);

  useEffect(() => {
    if (!AUTH_DISABLED) {
      captureTokenFromHash();
      if (!getToken()) {
        setState({ kind: "denied" });
        return;
      }
    }
    load();
    const onLost = () => setState({ kind: "denied" });
    window.addEventListener(AUTH_LOST_EVENT, onLost);
    return () => window.removeEventListener(AUTH_LOST_EVENT, onLost);
  }, [load]);

  const value = useMemo<AuthValue | null>(() => {
    if (state.kind !== "ok") return null;
    const { permissions, role } = state.me;
    return {
      user: state.me,
      can: (perm) => canWith(permissions, role, perm),
      canSee: (section) => sectionAllowed(permissions, role, section),
    };
  }, [state]);

  if (state.kind === "checking") return null;
  if (state.kind === "denied") {
    return (
      <Card title="Доступ ограничен">
        Это приложение доступно только внутри портала Битрикс24.
        <br />
        Откройте его через левое меню.
      </Card>
    );
  }
  if (state.kind === "error") {
    return (
      <Card title="Не удалось проверить доступ">
        <p className="mb-4">Проверьте соединение и попробуйте ещё раз.</p>
        <button
          onClick={load}
          className="rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background"
        >
          Повторить
        </button>
      </Card>
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
