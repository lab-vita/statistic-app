"use client";

import { useEffect } from "react";

/**
 * Подгонка окна приложения под Битрикс24.
 *
 * Битрикс показывает приложение во фрейме высотой не меньше 600 px и не знает,
 * сколько места на экране. Если фрейм выше видимой части страницы, прокручиваются
 * и страница Битрикса, и само приложение («двойная прокрутка»): шапка и
 * меню приложения уезжают за край.
 *
 * Здесь фрейм сам узнаёт, сколько его видно (IntersectionObserver во фрейме
 * меряет пересечение с окном браузера, а не с фреймом), и просит портал
 * выставить ровно такую высоту — тем же сообщением resizeWindow, что шлёт
 * официальная библиотека BX24. Ширину оставляем «100%», чтобы фрейм тянулся
 * вместе с окном.
 */

interface FrameInfo { origin: string; appSid: string }

/** Имя фрейма Битрикс задаёт как «домен|1|APP_SID». */
function frameInfo(): FrameInfo | null {
  if (typeof window === "undefined") return null;
  let inFrame = false;
  try { inFrame = window.self !== window.top; } catch { inFrame = true; }
  if (!inFrame) return null;
  const m = window.name.match(/^([^|]+)\|([01])\|([0-9a-z]+)$/i);
  if (!m) return null;
  return { origin: `${m[2] === "1" ? "https" : "http"}://${m[1]}`, appSid: m[3] };
}

let callbackSeq = 0;

function resizeFrame(info: FrameInfo, height: number): Promise<void> {
  return new Promise(resolve => {
    const callback = `pulse_resize_${++callbackSeq}`;
    const done = () => { window.removeEventListener("message", onMessage); clearTimeout(timer); resolve(); };
    const onMessage = (e: MessageEvent) => {
      if (e.origin === info.origin && typeof e.data === "string" && e.data.startsWith(`${callback}:`)) done();
    };
    // портал может и не ответить — не ждём дольше секунды
    const timer = setTimeout(done, 1000);
    window.addEventListener("message", onMessage);
    window.parent.postMessage(
      { method: "resizeWindow", params: { width: "100%", height: Math.round(height) }, appSid: info.appSid, callback },
      info.origin,
    );
  });
}

/** Нижняя граница видимой части фрейма, в его координатах (null — не удалось). */
function visibleBottom(): Promise<number | null> {
  return new Promise(resolve => {
    if (typeof IntersectionObserver === "undefined") return resolve(null);
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:100%;pointer-events:none;visibility:hidden";
    document.body.appendChild(probe);
    const finish = (v: number | null) => { io.disconnect(); probe.remove(); clearTimeout(timer); resolve(v); };
    const io = new IntersectionObserver(([entry]) => {
      const r = entry?.intersectionRect;
      finish(r && r.height > 0 ? r.bottom : null);
    }, { threshold: [0, 1] });
    const timer = setTimeout(() => finish(null), 1500);
    io.observe(probe);
  });
}

const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

export function useBitrixFrameFit() {
  useEffect(() => {
    const info = frameInfo();
    if (!info) return;

    let busy = false;
    let lastWidth = window.innerWidth;

    async function fit() {
      if (busy) return;
      busy = true;
      try {
        // 1) временно делаем фрейм заведомо выше экрана, 2) меряем, сколько видно,
        // 3) оставляем ровно видимую часть. Без шага 1 фрейм не смог бы вырасти,
        // когда окно браузера стало выше.
        const tall = Math.max(window.screen?.availHeight ?? 0, window.innerHeight, 900);
        await resizeFrame(info!, tall);
        await nextFrame();
        const bottom = await visibleBottom();
        if (bottom && bottom > 200) await resizeFrame(info!, Math.floor(bottom));
      } finally {
        await nextFrame();
        lastWidth = window.innerWidth;
        busy = false;
      }
    }

    // Ширина фрейма меняется вместе с окном браузера — тогда пересчитываем.
    // Изменения только высоты — это наши же resizeWindow, их пропускаем.
    let t: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (busy || window.innerWidth === lastWidth) return;
      clearTimeout(t);
      t = setTimeout(fit, 250);
    };

    fit();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, []);
}
