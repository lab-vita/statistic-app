"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchMe, type Me } from "@/lib/api";
import {
  AUTH_DISABLED,
  AUTH_LOST_EVENT,
  captureTokenFromHash,
  getToken,
} from "@/lib/auth";
import { canWith, sectionAllowed, type Section } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Activity, ShieldAlert, WifiOff } from "lucide-react";

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

function AuthCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="card-surface flex w-full max-w-sm flex-col items-center p-8 text-center">
        {/* Brand */}
        <div className="mb-6 flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-[9px] bg-brand text-brand-foreground">
            <Activity className="h-4.5 w-4.5" strokeWidth={2.5} />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Пульс</span>
        </div>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {children && <div className="mt-5 w-full">{children}</div>}
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
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!AUTH_DISABLED) {
        captureTokenFromHash();
        if (!getToken()) {
          if (!cancelled) setState({ kind: "denied" });
          return;
        }
      }
      try {
        const me = await fetchMe();
        if (!cancelled) setState({ kind: "ok", me });
      } catch {
        if (!cancelled) setState(getToken() || AUTH_DISABLED ? { kind: "error" } : { kind: "denied" });
      }
    })();
    const onLost = () => setState({ kind: "denied" });
    window.addEventListener(AUTH_LOST_EVENT, onLost);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_LOST_EVENT, onLost);
    };
  }, [attempt]);

  const retry = () => {
    setState({ kind: "checking" });
    setAttempt((a) => a + 1);
  };

  const value = useMemo<AuthValue | null>(() => {
    if (state.kind !== "ok") return null;
    const { permissions, role } = state.me;
    return {
      user: state.me,
      can: (perm) => canWith(permissions, role, perm),
      canSee: (section) => sectionAllowed(permissions, role, section),
    };
  }, [state]);

  if (state.kind === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <span className="text-xs text-muted-foreground">Загрузка…</span>
        </div>
      </div>
    );
  }

  if (state.kind === "denied") {
    return (
      <AuthCard
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Доступ ограничен"
        description="«Пульс» доступен только внутри портала Битрикс24. Откройте его через левое меню."
      />
    );
  }

  if (state.kind === "error") {
    return (
      <AuthCard
        icon={<WifiOff className="h-6 w-6" />}
        title="Не удалось проверить доступ"
        description="Проверьте соединение и попробуйте ещё раз."
      >
        <Button onClick={retry} className="w-full">
          Повторить
        </Button>
      </AuthCard>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
