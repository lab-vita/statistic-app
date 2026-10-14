"use client";

import { Stethoscope } from "lucide-react";
import type { PaymentDoctorResponse } from "@/lib/api";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, C, num, rub } from "./widget-card";

const initials = (surname: string, name: string) =>
  `${surname.charAt(0)}${name.charAt(0)}`.toUpperCase() || "—";

export function DoctorsTopWidget({ data, loading }: { data: PaymentDoctorResponse | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;

  const doctors = (data?.doctors ?? []).filter(d => d.total_paid > 0);
  const max = doctors[0]?.total_paid ?? 0;

  return (
    <WidgetCard>
      <WidgetHeader title="Топ врачей по выручке" meta="доля — от всей выручки за период" />
      {doctors.length === 0 ? (
        <WidgetEmpty icon={Stethoscope} text="Нет оплат за период" />
      ) : (
        <ol className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {doctors.map(d => {
            const full = (d.doctor_name ?? "").trim();
            const surname = d.doctor_surname || full.split(" ")[0] || "";
            const rest = full.replace(surname, "").trim();
            return (
              <li key={d.doctor_id} className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand">
                  {initials(surname, rest)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline gap-2 text-[12px]">
                    <span className="min-w-0 flex-1 truncate font-semibold" title={`${surname} ${rest}`.trim()}>
                      {surname} <span className="font-normal text-text-3">{rest}</span>
                    </span>
                    <span className="hidden shrink-0 text-[11px] tabular-nums text-text-3 @[22rem]:inline">{num(d.count)} виз.</span>
                    <span className="shrink-0 font-bold tabular-nums">{rub(d.total_paid)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${max > 0 ? (d.total_paid / max) * 100 : 0}%`, background: C.green }} />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-text-3">{Math.round(d.pct)}%</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </WidgetCard>
  );
}
