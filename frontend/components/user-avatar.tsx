"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map(p => p[0]!.toUpperCase()).join("");
}

/**
 * Фото сотрудника из Битрикс24, а если его нет или оно не загрузилось — инициалы.
 * size — диаметр в px.
 */
export function UserAvatar({ name, src, size = 32, className }: {
  name: string; src?: string | null; size?: number; className?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const showPhoto = !!src && broken !== src;
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-bold text-text-2",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) }}
      aria-hidden="true"
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- фото с CDN Битрикс24, оптимизация не нужна
        <img src={src!} alt="" className="h-full w-full object-cover" loading="lazy"
             referrerPolicy="no-referrer" onError={() => setBroken(src!)} />
      ) : initials(name || "?")}
    </span>
  );
}
