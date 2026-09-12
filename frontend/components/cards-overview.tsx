"use client";

import { useEffect, useState } from "react";
import { OperatorStats, formatDuration, fetchPlanRange, PlanRangeResponse } from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Timer, PhoneCall, Zap } from "lucide-react";

interface CardsOverviewProps {
  stats:    OperatorStats;
  dateFrom: string;
  dateTo:   string;
}

export function CardsOverview({ stats: s, dateFrom, dateTo }: CardsOverviewProps) {
  const [plan, setPlan] = useState<PlanRangeResponse | null>(null);

  useEffect(() => {
    fetchPlanRange(dateFrom, dateTo).then(setPlan).catch(() => {});
  }, [dateFrom, dateTo]);

  const missedPct = s.incoming > 0 ? Math.round(s.missed / s.incoming * 100) : 0;

  // % выполнения плана
  const incomingPlanTotal = plan?.totals.calls_incoming ?? 0;
  const outgoingPlanTotal = plan?.totals.calls_outgoing ?? 0;
  const missedPlanPct     = plan?.fixed.calls_missed_pct ?? 6;

  const incomingPlanPct = incomingPlanTotal > 0 ? Math.round(s.incoming / incomingPlanTotal * 100) : null;
  const outgoingPlanPct = outgoingPlanTotal > 0 ? Math.round(s.outgoing / outgoingPlanTotal * 100) : null;
  // Для пропущенных: факт% <= план% — хорошо
  const missedFactPct   = s.incoming > 0 ? Math.round(s.missed / s.incoming * 100) : 0;
  const missedPlanPctVal = missedFactPct > 0
    ? Math.round(missedFactPct / missedPlanPct * 100)
    : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Входящие" value={s.incoming} sub="успешно принятые"
          accent="green" icon={<PhoneIncoming className="h-4 w-4 text-emerald-500" />}
          deltaPct={s.incoming_delta_pct} deltaDir={s.incoming_delta_dir}
          planValue={incomingPlanTotal}
          planLabel={incomingPlanTotal > 0 ? `план ${incomingPlanTotal}` : undefined}
          planPct={incomingPlanPct}
        />
        <StatCard
          title="Исходящие" value={s.outgoing} sub="совершённые звонки"
          accent="blue" icon={<PhoneOutgoing className="h-4 w-4 text-blue-500" />}
          deltaPct={s.outgoing_delta_pct} deltaDir={s.outgoing_delta_dir}
          planValue={outgoingPlanTotal}
          planLabel={outgoingPlanTotal > 0 ? `план ${outgoingPlanTotal}` : undefined}
          planPct={outgoingPlanPct}
        />
        <StatCard
          title="Пропущенные" value={s.missed} sub={`${missedPct}% от входящих`}
          accent="red" icon={<PhoneMissed className="h-4 w-4 text-red-500" />}
          deltaPct={s.missed_delta_pct} deltaDir={s.missed_delta_dir}
          deltaInvert
          planValue={missedPlanPct}
          planLabel={`порог ≤ ${missedPlanPct}%`}
          planPct={missedPlanPctVal}
          planInvert
        />
        <StatCard
          title="Ср. разговор" value={formatDuration(s.avg_duration)} sub="успешные звонки"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          deltaPct={s.avg_duration_delta_pct} deltaDir={s.avg_duration_delta_dir}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Ср. ожидание" value={formatDuration(s.avg_wait_time)} sub="клиент ждал до сброса"
          accent="yellow" icon={<Timer className="h-4 w-4 text-yellow-500" />}
        />
        <StatCard
          title="Перезвонили" value={`${s.callback_count} / ${s.missed_total}`}
          sub={`${s.callback_pct}% пропущенных`}
          accent="green" icon={<PhoneCall className="h-4 w-4 text-emerald-500" />}
          deltaPct={s.callback_pct_delta_pct} deltaDir={s.callback_pct_delta_dir}
        />
        <StatCard
          title="Ср. реакция" value={formatDuration(s.avg_reaction_sec)} sub="до перезвона"
          accent="blue" icon={<Zap className="h-4 w-4 text-blue-500" />}
        />
      </div>
    </div>
  );
}
