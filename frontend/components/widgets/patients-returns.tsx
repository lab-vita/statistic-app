"use client";

import { Repeat } from "lucide-react";
import type { ReturnsResponse } from "@/lib/api";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, WidgetLabel } from "./widget-card";

const pct = (n: number) => `${n.toFixed(1).replace(".", ",").replace(",0", "")}%`;

/** Какая доля пациентов уже бывала у нас, сколько вернулись за 30 дней и через сколько приходят снова. */
export function PatientsReturnsWidget({ data, loading }: { data: ReturnsResponse | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;
  const cb30 = data?.came_back.find(c => c.days === 30);
  return (
    <WidgetCard>
      <WidgetHeader title="Повторные визиты" meta={data ? `${data.patients.toLocaleString("ru-RU")} пациентов за период` : undefined} />
      {!data || data.patients === 0 ? (
        <WidgetEmpty icon={Repeat} text="Нет визитов за период" />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 @[18rem]:grid-cols-3">
          <div>
            <WidgetLabel>Уже бывали</WidgetLabel>
            <p className="mt-1 text-[length:min(26px,12cqw)] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-emerald-600 dark:text-emerald-400">
              {pct(data.returning_pct)}
            </p>
            <p className="mt-1 text-[11px] text-text-3">{data.new.toLocaleString("ru-RU")} впервые</p>
          </div>
          <div>
            <WidgetLabel>Вернулись</WidgetLabel>
            <p className="mt-1 text-[length:min(26px,12cqw)] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
              {cb30 && cb30.eligible ? pct(cb30.pct) : "—"}
            </p>
            <p className="mt-1 text-[11px] text-text-3">{cb30 && cb30.eligible ? "в течение 30 дней" : "мало времени прошло"}</p>
          </div>
          <div>
            <WidgetLabel>Между визитами</WidgetLabel>
            <p className="mt-1 text-[length:min(26px,12cqw)] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
              {data.median_gap_days != null ? `${data.median_gap_days} дн.` : "—"}
            </p>
            <p className="mt-1 text-[11px] text-text-3">медиана</p>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
