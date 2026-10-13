"use client";

import { Activity, Smartphone, Server, CheckCircle2, Clock, Sparkles, Wrench, Shield } from "lucide-react";

const APP_VERSION_FRONTEND = "0.8.0";
const APP_VERSION_BACKEND  = "0.10.0";
const APP_UPDATED          = "13 октября 2026";

// ─── Типы ────────────────────────────────────────────────────────────────────

type ChangeKind = "new" | "fix" | "improve" | "security";

interface Change {
  kind: ChangeKind;
  text: string;
}

interface Release {
  version: string;
  date: string;
  title: string;
  changes: Change[];
}

// ─── Данные ──────────────────────────────────────────────────────────────────

const FRONTEND_RELEASES: Release[] = [
  {
    version: "0.8.0",
    date: "11–13 октября 2026",
    title: "Переработка интерфейса",
    changes: [
      { kind: "new",     text: "Полностью переписан интерфейс — быстрее, чище, удобнее" },
      { kind: "improve", text: "Улучшена система входа: токен Bitrix24 теперь передаётся во всех запросах" },
      { kind: "fix",     text: "Исправлены ошибки в графиках и страницах" },
      { kind: "security",text: "Усилен контроль доступа к разделам" },
    ],
  },
  {
    version: "0.7.0",
    date: "8–9 октября 2026",
    title: "Редизайн",
    changes: [
      { kind: "new",     text: "Новая дизайн-система: цвета, отступы, шрифты" },
      { kind: "new",     text: "Добавлено руководство по стилю DESIGN.md" },
      { kind: "fix",     text: "Устранены визуальные рассинхронизации компонентов" },
    ],
  },
  {
    version: "0.6.0",
    date: "4–7 октября 2026",
    title: "Ребрендинг в Пульс + новые виджеты звонков",
    changes: [
      { kind: "new",     text: "Приложение переименовано в «Пульс» с новой визуальной системой" },
      { kind: "new",     text: "Виджеты: воронка звонков, потерянные клиенты, время реакции" },
      { kind: "new",     text: "Виджеты: динамика, прогноз плана, качество операторов" },
      { kind: "improve", text: "Обновлена инфраструктура до Node 24" },
      { kind: "security",text: "Обновлены уязвимые зависимости" },
    ],
  },
  {
    version: "0.5.0",
    date: "29 сентября – 1 октября 2026",
    title: "Раздел «Выручка» и конструктор дашборда",
    changes: [
      { kind: "new",     text: "Новый раздел Выручка: статистика, графики по дням, топ врачей и услуг" },
      { kind: "new",     text: "Конструктор дашборда: перетаскивание виджетов, изменение размеров" },
      { kind: "new",     text: "Каталог виджетов с превью" },
      { kind: "improve", text: "Защита от наложения виджетов при перетаскивании" },
    ],
  },
  {
    version: "0.4.0",
    date: "13 сентября 2026",
    title: "Конверсия и разбивка по группам",
    changes: [
      { kind: "new",     text: "Блок конверсии в разделе Звонки" },
      { kind: "new",     text: "Разбивка записей по группам (колл-центр / врач)" },
    ],
  },
  {
    version: "0.3.0",
    date: "11–12 сентября 2026",
    title: "Раздел «Планы» и навигация по периодам",
    changes: [
      { kind: "new",     text: "Новый раздел Планы: редактирование и массовое заполнение" },
      { kind: "new",     text: "Прогресс-бары выполнения планов в карточках звонков и записей" },
      { kind: "new",     text: "Переключатель период (день / неделя / месяц) с навигацией" },
    ],
  },
  {
    version: "0.2.0",
    date: "10 сентября 2026",
    title: "Отчёты и дельты",
    changes: [
      { kind: "new",     text: "Новый раздел Отчёты: пресеты, фильтры, сравнительные таблицы" },
      { kind: "new",     text: "Показатели изменений (↑ / ↓) по сравнению с прошлым периодом" },
      { kind: "new",     text: "Фильтр по группам администраторов в разделе Записи" },
      { kind: "improve", text: "Таблицы операторов и записей: группировка по роли" },
    ],
  },
  {
    version: "0.1.0",
    date: "9 сентября 2026",
    title: "Первый запуск",
    changes: [
      { kind: "new",     text: "Главная страница с дневным срезом показателей" },
      { kind: "new",     text: "Разделы: Главная, Звонки, Записи" },
      { kind: "new",     text: "Боковое меню и переключатель светлой / тёмной темы" },
    ],
  },
];

const BACKEND_RELEASES: Release[] = [
  {
    version: "0.10.0",
    date: "11–13 октября 2026",
    title: "Авторизация через Bitrix24",
    changes: [
      { kind: "improve", text: "Все запросы к API теперь передают токен Bitrix24" },
      { kind: "security",text: "Усилен контроль доступа к разделам через auth-gate" },
    ],
  },
  {
    version: "0.9.0",
    date: "3–4 октября 2026",
    title: "Продакшн-деплой и управление доступом",
    changes: [
      { kind: "new",     text: "Production-конфигурация: Docker, docker-compose, Apache" },
      { kind: "new",     text: "Вход через Bitrix24: таблица пользователей, token-авторизация" },
      { kind: "new",     text: "Роли и права доступа, панель администратора, заявки на доступ" },
      { kind: "security",text: "Обновлены уязвимые зависимости FastAPI и Starlette" },
    ],
  },
  {
    version: "0.8.0",
    date: "26–28 сентября 2026",
    title: "Детализация платежей и связка звонков",
    changes: [
      { kind: "new",     text: "Сбор детализации платежей из МедОДС" },
      { kind: "new",     text: "Нормализация телефонов в базе данных (миграция)" },
      { kind: "new",     text: "Автоматическая связка звонков с записями по номеру телефона и времени" },
      { kind: "fix",     text: "Исправлен расчёт конца месяца и продаж по дням в backfill" },
      { kind: "fix",     text: "Устранены ошибки уникальности при нормализации названий услуг" },
    ],
  },
  {
    version: "0.7.0",
    date: "25 сентября 2026",
    title: "Большой рефакторинг бэкенда",
    changes: [
      { kind: "improve", text: "Вся аналитика звонков и записей вынесена в отдельные сервисы" },
      { kind: "improve", text: "Общие утилиты и константы статусов МедОДС централизованы" },
      { kind: "improve", text: "Планировщик: параллельный сбор данных, единая сессия на коллектор" },
      { kind: "new",     text: "Подключены Alembic-миграции для управления схемой БД" },
    ],
  },
  {
    version: "0.6.0",
    date: "21–24 сентября 2026",
    title: "Сотрудники",
    changes: [
      { kind: "new",     text: "Сбор и хранение данных о сотрудниках из МедОДС" },
      { kind: "improve", text: "Модель Сотрудник заменила устаревшую модель Врач" },
      { kind: "fix",     text: "Исправлена конвертация дат при загрузке сотрудников" },
    ],
  },
  {
    version: "0.5.0",
    date: "19–21 сентября 2026",
    title: "Каталог услуг и связка с продажами",
    changes: [
      { kind: "new",     text: "Каталог услуг с категориями из МедОДС" },
      { kind: "new",     text: "Флаг исключения услуг/категорий из аналитики" },
      { kind: "new",     text: "Автоматическая связка продаж с услугами" },
    ],
  },
  {
    version: "0.4.0",
    date: "17–19 сентября 2026",
    title: "Выручка и продажи",
    changes: [
      { kind: "new",     text: "Сбор выручки по типам оплат из МедОДС" },
      { kind: "new",     text: "API выручки: общая статистика, по дням, по типам" },
      { kind: "new",     text: "Сбор продаж через WebSocket (ActionCable)" },
      { kind: "new",     text: "Экспорт всех таблиц в CSV" },
    ],
  },
  {
    version: "0.3.0",
    date: "13 сентября 2026",
    title: "Конверсия и группы",
    changes: [
      { kind: "new",     text: "Эндпоинт конверсии звонков в записи" },
      { kind: "new",     text: "Разбивка записей по группам в API" },
    ],
  },
  {
    version: "0.2.0",
    date: "10–11 сентября 2026",
    title: "Отчёты, дельты и планы",
    changes: [
      { kind: "new",     text: "API отчётов: звонки и записи с пресетами и фильтрами" },
      { kind: "new",     text: "Изменения period-over-period для звонков и записей" },
      { kind: "new",     text: "API планов: просмотр, редактирование, массовое заполнение" },
      { kind: "new",     text: "Группы и роли администраторов" },
    ],
  },
  {
    version: "0.1.0",
    date: "9 сентября 2026",
    title: "Первый запуск",
    changes: [
      { kind: "new",     text: "Автоматический сбор данных по расписанию (4 раза в день)" },
      { kind: "new",     text: "Backfill — загрузка исторических данных с 1 января 2026" },
      { kind: "new",     text: "Базовые API: звонки, записи" },
    ],
  },
];

// ─── Утилиты ─────────────────────────────────────────────────────────────────

const KIND_META: Record<ChangeKind, { label: string; className: string; icon: React.ElementType }> = {
  new:      { label: "Новое",    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: Sparkles      },
  improve:  { label: "Улучшение",className: "bg-blue-500/10   text-blue-600   dark:text-blue-400",   icon: Wrench        },
  fix:      { label: "Исправление", className: "bg-amber-500/10 text-amber-600  dark:text-amber-400",  icon: CheckCircle2  },
  security: { label: "Безопасность",className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",icon: Shield        },
};

function Badge({ kind }: { kind: ChangeKind }) {
  const { label, className, icon: Icon } = KIND_META[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      {label}
    </span>
  );
}

function ReleaseCard({ release, isLatest }: { release: Release; isLatest: boolean }) {
  return (
    <div className={`rounded-xl border ${
      isLatest ? "border-foreground/20 bg-accent/40" : "border-border bg-card"
    } p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold font-mono">v{release.version}</span>
            {isLatest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Текущая
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold mt-0.5">{release.title}</p>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground shrink-0">
          <Clock className="h-3 w-3" />
          <span className="text-[11px]">{release.date}</span>
        </div>
      </div>
      <ul className="space-y-2">
        {release.changes.map((c, i) => (
          <li key={i} className="flex items-start gap-2">
            <Badge kind={c.kind} />
            <span className="text-[12px] text-muted-foreground leading-snug pt-0.5">{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VersionBlock({
  icon: Icon, title, version, releases,
}: {
  icon: React.ElementType;
  title: string;
  version: string;
  releases: Release[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-foreground/10 flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">Текущая версия: <span className="font-mono font-bold">{version}</span></p>
        </div>
      </div>
      <div className="space-y-2.5">
        {releases.map((r, i) => (
          <ReleaseCard key={r.version} release={r} isLatest={i === 0} />
        ))}
      </div>
    </section>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export function AboutPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Шапка */}
      <header className="shrink-0 border-b border-border bg-background px-6 h-[52px] flex items-center gap-3">
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground">
          <Activity className="h-3.5 w-3.5 text-background" strokeWidth={2.5} />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
        </div>
        <div>
          <span className="text-[14px] font-semibold">О приложении</span>
          <span className="ml-2 text-[12px] text-muted-foreground">Пульс · Аналитика</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

          {/* Карточка версии */}
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground">
              <Activity className="h-7 w-7 text-background" strokeWidth={2} />
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-[15px] font-bold">Пульс — Аналитика</p>
              <p className="text-[12px] text-muted-foreground">
                Единый центр статистики клиники: звонки, записи, выручка, планы и отчёты в одном месте.
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                Обновлено {APP_UPDATED}
              </p>
            </div>
            <div className="flex sm:flex-col gap-3 sm:gap-1 sm:text-right shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Интерфейс</p>
                <p className="text-[13px] font-mono font-bold">v{APP_VERSION_FRONTEND}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Сервер</p>
                <p className="text-[13px] font-mono font-bold">v{APP_VERSION_BACKEND}</p>
              </div>
            </div>
          </div>

          {/* Легенда значков */}
          <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Обозначения</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KIND_META) as ChangeKind[]).map(k => <Badge key={k} kind={k} />)}
            </div>
          </div>

          {/* История изменений интерфейса */}
          <VersionBlock
            icon={Smartphone}
            title="История изменений интерфейса"
            version={APP_VERSION_FRONTEND}
            releases={FRONTEND_RELEASES}
          />

          {/* История изменений сервера */}
          <VersionBlock
            icon={Server}
            title="История изменений сервера"
            version={APP_VERSION_BACKEND}
            releases={BACKEND_RELEASES}
          />

        </div>
      </div>
    </div>
  );
}
