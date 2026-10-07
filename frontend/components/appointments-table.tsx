import { AdminAppointmentStats } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

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

  const visitBadgeClass = (pct: number) =>
    pct >= 90
      ? "border-transparent bg-emerald-500/10 text-emerald-500"
      : pct >= 75
        ? "border-transparent bg-yellow-500/10 text-yellow-500"
        : "border-transparent bg-red-500/10 text-red-500";

  const renderRow = (op: AdminAppointmentStats) => (
    <TableRow key={op.name}>
      <TableCell className="px-5 py-3 font-medium whitespace-nowrap">
        <div className="flex items-center gap-2">
          {op.name}
          {op.group === "other" && op.group_label !== "Прочие" && (
            <span className="text-[10px] text-muted-foreground font-normal">
              {op.group_label}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="px-5 py-3 text-right font-mono font-medium">{op.total}</TableCell>
      <TableCell className="px-5 py-3 text-right font-mono text-emerald-500 font-medium">{op.visits}</TableCell>
      <TableCell className="px-5 py-3 text-right font-mono">
        <Badge variant="outline" className={`font-mono font-medium ${visitBadgeClass(op.visit_pct)}`}>
          {op.visit_pct}%
        </Badge>
      </TableCell>
      <TableCell className="px-5 py-3 text-right font-mono">
        {op.noshow > 0
          ? <span className="text-red-500">{op.noshow}</span>
          : <span className="text-muted-foreground">0</span>}
      </TableCell>
      <TableCell className="px-5 py-3 text-right font-mono text-muted-foreground">{op.cancels}</TableCell>
      <TableCell className="px-5 py-3 text-right font-mono text-purple-500">{op.new_patients}</TableCell>
    </TableRow>
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>По сотрудникам</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h, i) => (
                <TableHead
                  key={h}
                  className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                >
                  {h}
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
                  <TableRow key={`group-${group}`} className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={7} className="px-5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {GROUP_LABELS[group]}
                    </TableCell>
                  </TableRow>
                  {items.map(renderRow)}
                </>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="px-5 py-3.5 font-semibold">Итого</TableCell>
              <TableCell className="px-5 py-3.5 text-right font-mono font-semibold">{total.total}</TableCell>
              <TableCell className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-500">{total.visits}</TableCell>
              <TableCell className="px-5 py-3.5 text-right font-mono">
                <Badge variant="outline" className={`font-mono font-medium ${visitBadgeClass(total.visit_pct)}`}>
                  {total.visit_pct}%
                </Badge>
              </TableCell>
              <TableCell className="px-5 py-3.5 text-right font-mono font-semibold text-red-500">{total.noshow}</TableCell>
              <TableCell className="px-5 py-3.5 text-right font-mono font-semibold text-muted-foreground">{total.cancels}</TableCell>
              <TableCell className="px-5 py-3.5 text-right font-mono font-semibold text-purple-500">{total.new_patients}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
