import { OperatorStats, formatDuration } from "@/lib/api";
import { formatPct } from "@/lib/call-metrics";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableFooter,
  TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface OperatorsTableProps {
  operators: Record<string, OperatorStats>;
}

const PROFOSMOTR_IDS = new Set(["544"]);

const HEADERS = [
  { label: "Оператор",      align: "left"  },
  { label: "Принятые",      align: "right" },
  { label: "Исходящие",     align: "right" },
  { label: "Пропущенные",   align: "right" },
  { label: "Всего",         align: "right" },
  { label: "Ср. разговор",  align: "right" },
  { label: "Ср. ожидание",  align: "right" },
  { label: "Перезвонили",   align: "right" },
  { label: "Время реакции", align: "right" },
];

function StatusPill({ children, color }: { children: React.ReactNode; color: "green" | "red" | "yellow" | "neutral" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
      color === "green"   && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      color === "red"     && "bg-red-500/10 text-red-600 dark:text-red-400",
      color === "yellow"  && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      color === "neutral" && "bg-muted text-muted-foreground",
    )}>
      {children}
    </span>
  );
}

export function OperatorsTable({ operators }: OperatorsTableProps) {
  const rows  = Object.entries(operators).filter(([key]) => key !== "total");
  const total = operators["total"];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b px-5 py-3.5">
        <CardTitle className="text-sm font-semibold">По операторам</CardTitle>
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
            {rows.map(([id, op]) => {
              const isProfosmotr = PROFOSMOTR_IDS.has(id);
              const missedPct = op.missed_pct;

              return (
                <TableRow key={id} className="border-b border-border hover:bg-muted/40 transition-colors">
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{op.name}</span>
                      {isProfosmotr && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                          Профосмотры
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right">
                    <span className="text-[13px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {op.incoming}
                    </span>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right">
                    <span className="text-[13px] font-medium tabular-nums text-blue-600 dark:text-blue-400">
                      {op.outgoing}
                    </span>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right">
                    {isProfosmotr ? (
                      <span className="text-[13px] tabular-nums text-muted-foreground">{op.missed}</span>
                    ) : (
                      <StatusPill color={missedPct > 10 ? "red" : "neutral"}>
                        {op.missed}
                        <span className="opacity-60">({formatPct(missedPct)})</span>
                      </StatusPill>
                    )}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right">
                    <span className="text-[13px] font-medium tabular-nums">{op.total}</span>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right">
                    <span className="text-[12px] tabular-nums text-muted-foreground">{formatDuration(op.avg_duration)}</span>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right">
                    <span className="text-[12px] tabular-nums text-amber-600 dark:text-amber-400">{formatDuration(op.avg_wait_time)}</span>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right">
                    {isProfosmotr ? (
                      <span className="text-[12px] tabular-nums text-muted-foreground">{op.callback_count}/{op.missed_total}</span>
                    ) : (
                      <StatusPill
                        color={op.callback_pct >= 80 ? "green" : op.callback_pct >= 50 ? "yellow" : "red"}
                      >
                        {op.callback_count}/{op.missed_total}
                        <span className="opacity-60">({op.callback_pct}%)</span>
                      </StatusPill>
                    )}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right">
                    <span className="text-[12px] tabular-nums text-muted-foreground">{formatDuration(op.avg_reaction_sec)}</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>

          {total && (
            <TableFooter className="bg-muted/30">
              <TableRow className="border-t border-border hover:bg-transparent">
                <TableCell className="px-4 py-3 text-[12px] font-semibold">Итого</TableCell>
                <TableCell className="px-4 py-3 text-right text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{total.incoming}</TableCell>
                <TableCell className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-blue-600 dark:text-blue-400">{total.outgoing}</TableCell>
                <TableCell className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">{total.missed}</TableCell>
                <TableCell className="px-4 py-3 text-right text-[13px] font-bold tabular-nums">{total.total}</TableCell>
                <TableCell className="px-4 py-3 text-right text-[12px] tabular-nums text-muted-foreground">{formatDuration(total.avg_duration)}</TableCell>
                <TableCell className="px-4 py-3 text-right text-[12px] tabular-nums text-amber-600 dark:text-amber-400">{formatDuration(total.avg_wait_time)}</TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <StatusPill color={total.callback_pct >= 80 ? "green" : total.callback_pct >= 50 ? "yellow" : "red"}>
                    {total.callback_count}/{total.missed_total}
                    <span className="opacity-60">({total.callback_pct}%)</span>
                  </StatusPill>
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-[12px] tabular-nums text-muted-foreground">{formatDuration(total.avg_reaction_sec)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}
