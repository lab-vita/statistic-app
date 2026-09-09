import { AdminAppointmentStats } from "@/lib/api";

interface AppointmentsTableProps {
  byAdmin: Record<string, AdminAppointmentStats>;
  total: AdminAppointmentStats;
}

export function AppointmentsTable({ byAdmin, total }: AppointmentsTableProps) {
  const rows = Object.values(byAdmin).sort((a, b) => b.total - a.total);

  const headers = [
    "Администратор", "Записей", "Явки", "% явки",
    "Неявки", "Отмены", "Новые пациенты",
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-medium">По администраторам</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {headers.map((h, i) => (
                <th key={h}
                  className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(op => (
              <tr key={op.name} className="hover:bg-muted/40 transition-colors">
                <td className="px-5 py-3.5 font-medium whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {op.is_callcenter && (
                      <span className="inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                        КЦ
                      </span>
                    )}
                    {op.name}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-medium">{op.total}</td>
                <td className="px-5 py-3.5 text-right font-mono text-emerald-500 font-medium">{op.visits}</td>
                <td className="px-5 py-3.5 text-right font-mono">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                    op.visit_pct >= 90 ? "bg-emerald-500/10 text-emerald-500"
                    : op.visit_pct >= 75 ? "bg-yellow-500/10 text-yellow-500"
                    : "bg-red-500/10 text-red-500"
                  }`}>
                    {op.visit_pct}%
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right font-mono">
                  {op.noshow > 0
                    ? <span className="text-red-500">{op.noshow}</span>
                    : <span className="text-muted-foreground">0</span>}
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">{op.cancels}</td>
                <td className="px-5 py-3.5 text-right font-mono text-purple-500">{op.new_patients}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-5 py-3.5 font-semibold">Итого</td>
              <td className="px-5 py-3.5 text-right font-mono font-semibold">{total.total}</td>
              <td className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-500">{total.visits}</td>
              <td className="px-5 py-3.5 text-right font-mono">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                  total.visit_pct >= 90 ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-yellow-500/10 text-yellow-500"
                }`}>
                  {total.visit_pct}%
                </span>
              </td>
              <td className="px-5 py-3.5 text-right font-mono font-semibold text-red-500">{total.noshow}</td>
              <td className="px-5 py-3.5 text-right font-mono font-semibold text-muted-foreground">{total.cancels}</td>
              <td className="px-5 py-3.5 text-right font-mono font-semibold text-purple-500">{total.new_patients}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}