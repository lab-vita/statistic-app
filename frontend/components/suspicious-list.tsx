import { SuspiciousItem } from "@/lib/api";
import { AlertTriangle } from "lucide-react";

interface SuspiciousListProps {
  items: SuspiciousItem[];
}

export function SuspiciousList({ items }: SuspiciousListProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-emerald-500 font-medium">✓ Подозрительных записей не обнаружено</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-500/20 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-red-500/20 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h3 className="text-sm font-medium text-red-500">
          Подозрительные записи — {items.length}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Пациент", "Дата", "Время", "Администратор", "Статус", "Причина"].map((h, i) => (
                <th key={h} className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap ${i === 0 ? "text-left" : i === 5 ? "text-left" : "text-right"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.medods_id} className="hover:bg-muted/40 transition-colors">
                <td className="px-5 py-3.5 font-medium whitespace-nowrap">{item.client}</td>
                <td className="px-5 py-3.5 text-right font-mono text-muted-foreground whitespace-nowrap">{item.date}</td>
                <td className="px-5 py-3.5 text-right font-mono text-muted-foreground whitespace-nowrap">{item.time}</td>
                <td className="px-5 py-3.5 text-right text-muted-foreground whitespace-nowrap">{item.admin}</td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {item.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {item.reasons.map((r) => (
                      <span key={r} className="inline-flex rounded-md bg-red-500/10 px-2 py-0.5 text-xs text-red-500">
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}