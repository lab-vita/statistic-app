"use client";

import { CalendarX } from "lucide-react";
import type { NoshowsResponse } from "@/lib/api";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, DeltaBadge, WidgetLabel } from "./widget-card";

const pct = (n: number) => `${n.toFixed(1).replace(".", ",").replace(",0", "")}%`;

/** Доля неявок за период и столбики по дням недели (самый «плохой» день — ярче). */
export function PatientsNoshowsWidget({ data, loading }: { data: NoshowsResponse | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;
  const t = data?.total;
  const days = (data?.by_weekday ?? []).filter(d => d.appointments > 0);
  const max = Math.max(...days.map(d => d.noshow_pct), 1);
  const worst = [...days].sort((a, b) => b.noshow_pct - a.noshow_pct)[0];

  return (
    <WidgetCard>
      <WidgetHeader title="Неявки" meta={t ? `${t.noshow} из ${t.visits + t.noshow} приёмов` : undefined} />
      {!t || t.visits + t.noshow === 0 ? (
        <WidgetEmpty icon={CalendarX} text="Нет прошедших приёмов за период" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-end gap-2.5">
            <span className="text-[length:min(30px,14cqw)] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{pct(t.noshow_pct)}</span>
            <DeltaBadge pct={t.noshow_pct_delta_pct} dir={t.noshow_pct_delta_dir} invert />
          </div>
          <WidgetLabel className="mt-3">по дням недели{worst ? ` · чаще всего ${worst.label.toLowerCase()}` : ""}</WidgetLabel>
          <div className="mt-1.5 flex min-h-[48px] flex-1 items-end gap-1.5">
            {days.map(d => (
              <div key={d.weekday} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${pct(d.noshow_pct)}`}>
                <span className="text-[9.5px] font-semibold tabular-nums text-text-3">{pct(d.noshow_pct)}</span>
                <div className="w-full max-w-[28px] rounded-t-[4px] bg-brand"
                  style={{ height: `${Math.max(6, (d.noshow_pct / max) * 100)}%`, opacity: 0.35 + 0.65 * (d.noshow_pct / max) }} />
                <span className="text-[10px] text-text-3">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
