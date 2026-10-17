"use client";

/**
 * Настройки → База данных: скачать всю базу одним файлом.
 *  • Полная копия (.sql.gz) — pg_dump; из неё базу можно восстановить целиком.
 *  • Таблицы в CSV (.zip) — открыть в Excel, посмотреть или передать.
 */
import { useEffect, useState } from "react";
import { Database, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { ErrorBanner, SectionCard, Skeleton, Th, Td } from "@/components/ui/primitives";
import { downloadFrom, formatBytes, systemApi, type ExportInfo } from "@/lib/system-api";

const TABLE_LABELS: Record<string, string> = {
  appointments: "Записи на приём",
  calls: "Звонки",
  payment_details: "Платежи подробно",
  payments: "Платежи",
  revenue: "Выручка по способам оплаты",
  sales: "Продажи по услугам",
  services: "Услуги",
  service_categories: "Категории услуг",
  staff: "Сотрудники МедОДС",
  plans: "Планы (старые)",
  plan_months: "Планы на месяц",
  app_users: "Доступ к приложению",
  app_roles: "Роли",
  access_requests: "Запросы доступа",
  app_settings: "Настройки (сводка и др.)",
  report_templates: "Шаблоны отчётов",
  sync_runs: "Журнал обмена: сеансы",
  sync_requests: "Журнал обмена: запросы и ответы",
  alembic_version: "Версия схемы базы",
};

export function DbExportPanel() {
  const [info, setInfo] = useState<ExportInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [withLog, setWithLog] = useState(false);
  const [busy, setBusy] = useState<"sql" | "csv" | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    systemApi.exportInfo().then(x => { if (alive) setInfo(x); })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : "Не удалось получить сведения о базе"); });
    return () => { alive = false; };
  }, []);

  const logBytes = info?.tables.filter(t => info.log_tables.includes(t.name)).reduce((s, t) => s + t.bytes, 0) ?? 0;

  const run = async (fmt: "sql" | "csv") => {
    setBusy(fmt); setErr(null); setDone(null);
    try {
      await downloadFrom(`/export/db?format=${fmt}${withLog ? "&log=true" : ""}`,
                         fmt === "sql" ? "pulse-db.sql.gz" : "pulse-tables.zip");
      setDone(fmt === "sql" ? "Копия базы скачана." : "Таблицы скачаны.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось выгрузить базу");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Скачать базу целиком"
                   right={info ? `${formatBytes(info.database_bytes)} · PostgreSQL ${info.server_version.split(" ")[0]}` : undefined}>
        <div className="space-y-3.5">
          {err && <ErrorBanner message={err} />}
          {info && !info.pg_dump && (
            <div className="rounded-[8px] bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-700 dark:text-amber-300">
              На сервере пока нет pg_dump — полная копия заработает после пересборки контейнера backend.
              Таблицы в CSV скачать можно уже сейчас.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => run("sql")} disabled={busy !== null || (info !== null && !info.pg_dump)}
                    className="inline-flex h-9 items-center gap-2 rounded-[7px] bg-brand px-3.5 text-[12.5px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-60">
              {busy === "sql" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Скачать копию базы (.sql.gz)
            </button>
            <button type="button" onClick={() => run("csv")} disabled={busy !== null}
                    className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-border bg-card px-3.5 text-[12.5px] font-medium text-text-2 transition-colors hover:bg-accent disabled:opacity-60">
              {busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Таблицы в CSV (.zip)
            </button>
            {done && <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400"><Download className="h-3.5 w-3.5" />{done}</span>}
          </div>

          <label className="flex items-start gap-2 text-[12px] text-text-2">
            <input type="checkbox" className="mt-0.5 accent-brand" checked={withLog} onChange={e => setWithLog(e.target.checked)} />
            <span>
              Включить журнал запросов к МедОДС и Битрикс24{info ? ` (${formatBytes(logBytes)})` : ""}
            </span>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Что внутри" noPad right={info ? `${info.tables.length} таблиц` : undefined}>
        {!info ? (
          <div className="px-5 pb-5"><Skeleton className="h-40" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr><Th>Таблица</Th><Th right>Строк</Th><Th right>Размер</Th></tr>
              </thead>
              <tbody>
                {info.tables.map(t => (
                  <tr key={t.name} className="hover:bg-accent/60">
                    <Td>
                      <span className="font-medium">{TABLE_LABELS[t.name] ?? t.name}</span>
                      <span className="ml-2 font-mono text-[10.5px] text-text-3">{t.name}</span>
                    </Td>
                    <Td right>{t.rows_estimate.toLocaleString("ru-RU")}</Td>
                    <Td right muted>{formatBytes(t.bytes)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
