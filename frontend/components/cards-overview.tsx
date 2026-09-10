import { OperatorStats, formatDuration } from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Timer, PhoneCall, Zap } from "lucide-react";

interface CardsOverviewProps {
  stats: OperatorStats;
}

export function CardsOverview({ stats: s }: CardsOverviewProps) {
  const missedPct = s.incoming > 0
    ? Math.round(s.missed / s.incoming * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Входящие" value={s.incoming} sub="успешно принятые"
          accent="green" icon={<PhoneIncoming className="h-4 w-4 text-emerald-500" />}
          deltaPct={s.incoming_delta_pct} deltaDir={s.incoming_delta_dir}
        />
        <StatCard
          title="Исходящие" value={s.outgoing} sub="совершённые звонки"
          accent="blue" icon={<PhoneOutgoing className="h-4 w-4 text-blue-500" />}
          deltaPct={s.outgoing_delta_pct} deltaDir={s.outgoing_delta_dir}
        />
        <StatCard
          title="Пропущенные" value={s.missed} sub={`${missedPct}% от входящих`}
          accent="red" icon={<PhoneMissed className="h-4 w-4 text-red-500" />}
          deltaPct={s.missed_delta_pct} deltaDir={s.missed_delta_dir}
          deltaInvert
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
