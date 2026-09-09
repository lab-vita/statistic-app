import { OperatorStats, formatDuration } from "@/lib/api";

interface OperatorsTableProps {
  operators: Record<string, OperatorStats>;
}

export function OperatorsTable({ operators }: OperatorsTableProps) {
  const rows  = Object.entries(operators).filter(([key]) => key !== "total");
  const total = operators["total"];

  const headers = [
    "Оператор",
    "Входящие",
    "Исходящие",
    "Пропущенные",
    "Всего",
    "Ср. разговор",
    "Ср. ожидание",
    "Перезвонили",
    "Время реакции",
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-medium">По операторам</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {headers.map((h, i) => (
                <th key={h} className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(([id, op]) => {
              const missedPct = op.incoming > 0
                ? Math.round((op.missed / op.incoming) * 100) : 0;
              return (
                <tr key={id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3.5 font-medium whitespace-nowrap">{op.name}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-emerald-500 font-medium">{op.incoming}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-blue-500 font-medium">{op.outgoing}</td>
                  <td className="px-5 py-3.5 text-right font-mono">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                      missedPct > 10 ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"
                    }`}>
                      {op.missed} <span className="opacity-60">({missedPct}%)</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-medium">{op.total}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">{formatDuration(op.avg_duration)}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-yellow-500">{formatDuration(op.avg_wait_time)}</td>
                  <td className="px-5 py-3.5 text-right font-mono">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                      op.callback_pct >= 80 ? "bg-emerald-500/10 text-emerald-500"
                      : op.callback_pct >= 50 ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-red-500/10 text-red-500"
                    }`}>
                      {op.callback_count}/{op.missed_total}
                      <span className="opacity-60">({op.callback_pct}%)</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                    {formatDuration(op.avg_reaction_sec)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {total && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="px-5 py-3.5 font-semibold">Итого</td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-500">{total.incoming}</td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold text-blue-500">{total.outgoing}</td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold">{total.missed}</td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold">{total.total}</td>
                <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">{formatDuration(total.avg_duration)}</td>
                <td className="px-5 py-3.5 text-right font-mono text-yellow-500">{formatDuration(total.avg_wait_time)}</td>
                <td className="px-5 py-3.5 text-right font-mono">
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                    total.callback_pct >= 80 ? "bg-emerald-500/10 text-emerald-500"
                    : total.callback_pct >= 50 ? "bg-yellow-500/10 text-yellow-500"
                    : "bg-red-500/10 text-red-500"
                  }`}>
                    {total.callback_count}/{total.missed_total}
                    <span className="opacity-60">({total.callback_pct}%)</span>
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">{formatDuration(total.avg_reaction_sec)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}