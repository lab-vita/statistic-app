"use client";

import { Wallet } from "lucide-react";
import type { PaymentStatsResponse } from "@/lib/api";
import { WidgetCard, WidgetHeader, WidgetSkeleton, WidgetEmpty, C } from "./widget-card";

const rub = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(v)) + " ₽";

export function RevenueMethodsWidget({ data, loading }: { data: PaymentStatsResponse | null; loading: boolean }) {
  if (loading) return <WidgetSkeleton />;

  const rows = data ? [
    { key: "cash",     label: "Наличными", value: data.by_cash,     color: C.green  },
    { key: "card",     label: "Картой",    value: data.by_card,     color: C.blue   },
    { key: "cashless", label: "Безнал",    value: data.by_cashless, color: C.amber  },
    { key: "credit",   label: "Кредит",    value: data.by_credit,   color: C.violet },
    { key: "balance",  label: "С баланса", value: data.by_balance,  color: C.slate  },
  ].filter(r => r.value > 0) : [];
  const total = data?.total_paid ?? 0;

  return (
    <WidgetCard>
      <WidgetHeader title="Способы оплаты" meta={data ? rub(total) : undefined} />
      {rows.length === 0 ? (
        <WidgetEmpty icon={Wallet} text="Нет платежей за период" />
      ) : (
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
          {rows.map(r => {
            const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
            return (
              <div key={r.key}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-text-2">{r.label}</span>
                  <span className="tabular-nums">
                    <span className="text-text-3">{rub(r.value)}</span>
                    <span className="ml-2 font-bold">{pct}%</span>
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: r.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
