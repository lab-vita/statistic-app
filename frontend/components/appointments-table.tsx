import { AdminAppointmentStats } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableFooter,
  TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface AppointmentsTableProps {
  byAdmin: Record<string, AdminAppointmentStats>;
  total:   AdminAppointmentStats;
}

const GROUP_ORDER  = ["callcenter", "admin", "other"] as const;
const GROUP_LABELS: Record<string, string> = {
  callcenter: "Колл-центр",
  admin:      "Администраторы",
  other:      "Прочие",
};

const HEADERS = [
  { label: "Сотрудник",       align: "left"  },
  { label: "Записей",         align: "right" },
  { label: "Явки",            align: "right" },
  { label: "% явки",          align: "right" },
  { label: "Неявки",          align: "right" },
  { label: "Отмены",          align: "right" },
  { label: "Новые пациенты",  align: "right" },
];

function VisitPill({ pct }: { pct: number }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
      pct >= 90 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : pct >= 75 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "bg-red-500/10 text-red-600 dark:text-red-400"
    )}>
      {pct}%
    </span>
  );
}

function renderRow(op: AdminAppointmentStats) {
  return (
    <TableRow key={op.name} className="border-b border-border hover:bg-muted/40 transition-colors">
      <TableCell className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium">{op.name}</span>
          {op.group === "other" && op.group_label !== "Прочие" && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
              {op.group_label}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 text-right text-[13px] font-medium tabular-nums">{op.total}</TableCell>
      <TableCell className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{op.visits}</TableCell>
      <TableCell className="px-4 py-3 text-right"><VisitPill pct={op.visit_pct} /></TableCell>
      <TableCell className="px-4 py-3 text-right text-[13px] tabular-nums">
        {op.noshow > 0
          ? <span className="text-red-600 dark:text-red-400 font-medium">{op.noshow}</span>
          : <span className="text-muted-foreground/40">0</span>}
      </TableCell>
      <TableCell className="px-4 py-3 text-right text-[12px] tabular-nums text-muted-foreground">{op.cancels}</TableCell>
      <TableCell className="px-4 py-3 text-right text-[12px] tabular-nums text-violet-600 dark:text-violet-400">{op.new_patients}</TableCell>
    </TableRow>
  );
}

export function AppointmentsTable({ byAdmin, total }: AppointmentsTableProps) {
  const rows = Object.values(byAdmin);
  const grouped = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = rows.filter(r => r.group === g).sort((a, b) => b.total - a.total);
    return acc;
  }, {} as Record<string, AdminAppointmentStats[]>);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b px-5 py-3.5">
        <CardTitle className="text-sm font-semibold">По сотрудникам</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              {HEADERS.map(({ label, align }) => (
                <TableHead
                  key={label}
                  className={cn(
                    "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap",
                    align === "right" ? "text-right" : "text-left"
                  )}
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {GROUP_ORDER.map(group => {
              const items = grouped[group];
              if (!items?.length) return null;
              return (
                <>
                  <TableRow key={`group-${group}`} className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                    <TableCell colSpan={7} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      {GROUP_LABELS[group]}
                    </TableCell>
                  </TableRow>
                  {items.map(renderRow)}
                </>
              );
            })}
          </TableBody>
          <TableFooter className="bg-muted/30">
            <TableRow className="border-t border-border hover:bg-transparent">
              <TableCell className="px-4 py-3 text-[12px] font-semibold">Итого</TableCell>
              <TableCell className="px-4 py-3 text-right text-[13px] font-bold tabular-nums">{total.total}</TableCell>
              <TableCell className="px-4 py-3 text-right text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{total.visits}</TableCell>
              <TableCell className="px-4 py-3 text-right"><VisitPill pct={total.visit_pct} /></TableCell>
              <TableCell className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-red-600 dark:text-red-400">{total.noshow}</TableCell>
              <TableCell className="px-4 py-3 text-right text-[12px] tabular-nums text-muted-foreground">{total.cancels}</TableCell>
              <TableCell className="px-4 py-3 text-right text-[12px] tabular-nums text-violet-600 dark:text-violet-400">{total.new_patients}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
