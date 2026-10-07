import { OperatorStats, formatDuration } from "@/lib/api";
import { formatPct } from "@/lib/call-metrics";
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

interface OperatorsTableProps {
  operators: Record<string, OperatorStats>;
}

// Жданова — профосмотры, не красим её метрики
const PROFOSMOTR_IDS = new Set(["544"]);

const headers = [
  "Оператор",
  "Принятые",
  "Исходящие",
  "Пропущенные",
  "Всего",
  "Ср. разговор",
  "Ср. ожидание",
  "Перезвонили",
  "Время реакции",
];

export function OperatorsTable({ operators }: OperatorsTableProps) {
  const rows  = Object.entries(operators).filter(([key]) => key !== "total");
  const total = operators["total"];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>По операторам</CardTitle>
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
            {rows.map(([id, op]) => {
              const isProfosmotr = PROFOSMOTR_IDS.has(id);
              // пропущено ÷ поступило (принятые + пропущенные) — считает сервер
              const missedPct = op.missed_pct;

              return (
                <TableRow key={id}>
                  <TableCell className="px-5 py-3.5 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {op.name}
                      {isProfosmotr && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Профосмотры
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-5 py-3.5 text-right font-mono text-emerald-500 font-medium">{op.incoming}</TableCell>
                  <TableCell className="px-5 py-3.5 text-right font-mono text-blue-500 font-medium">{op.outgoing}</TableCell>
                  <TableCell className="px-5 py-3.5 text-right font-mono">
                    {isProfosmotr ? (
                      <span className="text-muted-foreground">{op.missed}</span>
                    ) : (
                      <Badge
                        variant="outline"
                        title={`${op.missed} из ${op.received} поступивших звонков`}
                        className={`gap-1 font-mono font-medium ${
                          missedPct > 10
                            ? "border-transparent bg-red-500/10 text-red-500"
                            : "border-transparent bg-muted text-muted-foreground"
                        }`}
                      >
                        {op.missed} <span className="opacity-60">({formatPct(missedPct)})</span>
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-3.5 text-right font-mono font-medium">{op.total}</TableCell>
                  <TableCell className="px-5 py-3.5 text-right font-mono text-muted-foreground">{formatDuration(op.avg_duration)}</TableCell>
                  <TableCell className="px-5 py-3.5 text-right font-mono text-yellow-500">{formatDuration(op.avg_wait_time)}</TableCell>
                  <TableCell className="px-5 py-3.5 text-right font-mono">
                    {isProfosmotr ? (
                      <span className="text-muted-foreground">{op.callback_count}/{op.missed_total}</span>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`gap-1 font-mono font-medium border-transparent ${
                          op.callback_pct >= 80
                            ? "bg-emerald-500/10 text-emerald-500"
                            : op.callback_pct >= 50
                              ? "bg-yellow-500/10 text-yellow-500"
                              : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {op.callback_count}/{op.missed_total}
                        <span className="opacity-60">({op.callback_pct}%)</span>
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                    {formatDuration(op.avg_reaction_sec)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {total && (
            <TableFooter>
              <TableRow>
                <TableCell className="px-5 py-3.5 font-semibold">Итого</TableCell>
                <TableCell className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-500">{total.incoming}</TableCell>
                <TableCell className="px-5 py-3.5 text-right font-mono font-semibold text-blue-500">{total.outgoing}</TableCell>
                <TableCell className="px-5 py-3.5 text-right font-mono font-semibold">{total.missed}</TableCell>
                <TableCell className="px-5 py-3.5 text-right font-mono font-semibold">{total.total}</TableCell>
                <TableCell className="px-5 py-3.5 text-right font-mono text-muted-foreground">{formatDuration(total.avg_duration)}</TableCell>
                <TableCell className="px-5 py-3.5 text-right font-mono text-yellow-500">{formatDuration(total.avg_wait_time)}</TableCell>
                <TableCell className="px-5 py-3.5 text-right font-mono">
                  <Badge
                    variant="outline"
                    className={`gap-1 font-mono font-medium border-transparent ${
                      total.callback_pct >= 80
                        ? "bg-emerald-500/10 text-emerald-500"
                        : total.callback_pct >= 50
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "bg-red-500/10 text-red-500"
                    }`}
                  >
                    {total.callback_count}/{total.missed_total}
                    <span className="opacity-60">({total.callback_pct}%)</span>
                  </Badge>
                </TableCell>
                <TableCell className="px-5 py-3.5 text-right font-mono text-muted-foreground">{formatDuration(total.avg_reaction_sec)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}
