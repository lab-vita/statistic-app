import { AdminAppointmentStats } from "@/lib/api";

interface AppointmentsTableProps {
  byAdmin: Record<string, AdminAppointmentStats>;
  total: AdminAppointmentStats;
}

const GROUP_ORDER = ["callcenter", "admin", "other"] as const;
const GROUP_LABELS: Record<string, string> = {
  callcenter: "Колл-центр",
  admin:      "Администраторы",
  other:      "Прочие",
};

const headers = [
  "Сотрудник", "Записей", "Явки", "% явки",
  "Неявки", "Отмены", "Новые пациенты",
];

export function AppointmentsTable({ byAdmin, total }: AppointmentsTableProps) {
  const rows = Object.values(byAdmin);

  const grouped = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = rows.filter(r => r.group === g).sort((a, b) => b.total - a.total);
    return acc;
  }, {} as Record<string, AdminAppointmentStats[]>);

  const visitColor = (pct: number) =>
    pct >= 90 ? "bg-emerald-500/10 text-emerald-500"
    : pct >= 75 ? "bg-yellow-500/10 text-yellow-500"
    : "bg-red-500/10 text-red-500";

  const renderRow = (op: AdminAppointmentStats) => (
    <tr key={op.name} className="hover:bg-muted/40 transition-colors">
      <td className="px-5 py-3 font-medium whitespace-nowrap">
        <div className="flex items-center gap-2">
          {op.name}
          {op.group === "other" && op.group_label !== "Прочие" && (
            <span className="text-[10px] text-muted-foreground font-normal">
              {op.group_label}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3 text-right font-mono font-medium">{op.total}</td>
      <td className="px-5 py-3 text-right font-mono text-emerald-500 font-medium">{op.visits}</td>
      <td className="px-5 py-3 text-right font-mono">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${visitColor(op.visit_pct)}`}>
          {op.visit_pct}%
        </span>
      </td>
      <td className="px-5 py-3 text-right font-mono">
        {op.noshow > 0
          ? <span className="text-red-500">{op.noshow}</span>
          : <span className="text-muted-foreground">0</span>}
      </td>
      <td className="px-5 py-3 text-right font-mono text-muted-foreground">{op.cancels}</td>
      <td className="px-5 py-3 text-right font-mono text-purple-500">{op.new_patients}</td>
    </tr>
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-medium">По сотрудникам</h3>
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
            {GROUP_ORDER.map(group => {
              const items = grouped[group];
              if (!items?.length) return null;
              return (
                <>
                  <tr key={`group-${group}`} className="bg-muted/20">
                    <td colSpan={7} className="px-5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {GROUP_LABELS[group]}
                    </td>
                  </tr>
                  {items.map(renderRow)}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-5 py-3.5 font-semibold">Итого</td>
              <td className="px-5 py-3.5 text-right font-mono font-semibold">{total.total}</td>
              <td className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-500">{total.visits}</td>
              <td className="px-5 py-3.5 text-right font-mono">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${visitColor(total.visit_pct)}`}>
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
