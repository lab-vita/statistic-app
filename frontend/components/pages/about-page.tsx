"use client";

import { Activity, Monitor, Server, CheckCircle2, Sparkles, Wrench, Shield } from "lucide-react";
import { PageHeader, PageContent } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const APP_VERSION_FRONTEND = "0.11.0";
const APP_VERSION_BACKEND  = "0.12.0";
const APP_UPDATED          = "15 октября 2026";

// ─── Типы ────────────────────────────────────────────────────

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

// ─── История изменений ───────────────────────────────────────
// Новые версии — сверху. Пишем для пользователя: что стало можно и что
// исправлено, без технических подробностей.

const FRONTEND_RELEASES: Release[] = [
  {
    version: "0.11.0",
    date: "15 октября 2026",
    title: "Пациенты, направления и средний чек",
    changes: [
      { kind: "new",     text: "Раздел «Пациенты»: неявки по врачам, дням недели и часам приёма, новые и повторные пациенты" },
      { kind: "new",     text: "Повторные визиты: какая доля пациентов возвращается, через сколько дней и к какому врачу" },
      { kind: "new",     text: "В «Выручке» — направления и услуги в динамике по дням, неделям или месяцам" },
      { kind: "new",     text: "В «Врачах» — средний чек и его изменение к прошлому периоду" },
      { kind: "new",     text: "Три новых виджета для главной: неявки, повторные визиты, выручка по направлениям" },
      { kind: "fix",     text: "Периоды больше не сдвигаются на день назад, а стрелки листают целые месяцы, кварталы и годы" },
    ],
  },
  {
    version: "0.10.0",
    date: "15 октября 2026",
    title: "Адаптив, воронка и утренняя сводка",
    changes: [
      { kind: "new",     text: "Удобно на любом экране: на телефоне меню открывается кнопкой, шапка и таблицы не вылезают за край, на больших мониторах контент не растягивается" },
      { kind: "new",     text: "Настройки утренней сводки: время, получатели, пример сообщения и кнопка «Отправить мне сейчас»" },
      { kind: "new",     text: "Воронка разделена на «Колл-центр» и «Всю клинику» — записи администраторов больше не теряются" },
      { kind: "improve", text: "Внутри Битрикс24 окно приложения подстраивается под экран — без двойной прокрутки" },
      { kind: "fix",     text: "Конверсия больше не бывает выше 100%, а в дни без звонков линия на графике прерывается, а не падает в ноль" },
      { kind: "fix",     text: "Раздел «Отчёты» снова показывает итоги и таблицы" },
    ],
  },
  {
    version: "0.9.0",
    date: "14 октября 2026",
    title: "Новый дизайн и главная из виджетов",
    changes: [
      { kind: "new",     text: "Новый дизайн «Пульс» по макету Labvita: светлые карточки, крупные цифры, единый фирменный цвет" },
      { kind: "new",     text: "Главная собирается из виджетов: перетаскивание, изменение размера, каталог с превью" },
      { kind: "new",     text: "Виджеты для всех разделов — звонки, записи, выручка, врачи, воронка, планы и отчёты" },
      { kind: "improve", text: "Готовая раскладка главной по умолчанию — сразу видно всё важное" },
      { kind: "fix",     text: "Раздел «Врачи» больше не падает, если у оплаты не указан врач" },
    ],
  },
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
    version: "0.12.0",
    date: "15 октября 2026",
    title: "Аналитика пациентов и статусы записей",
    changes: [
      { kind: "new",     text: "Расчёт неявок и отмен по врачам, дням недели и часам; повторных визитов и удержания по врачам" },
      { kind: "new",     text: "Выручка по направлениям и услугам с разбивкой по времени; средний чек по врачам" },
      { kind: "fix",     text: "Статусы записей (пришёл / не пришёл / отменено) обновляются по дню приёма и сверяются с МедОДС — история пересобрана с января" },
    ],
  },
  {
    version: "0.11.0",
    date: "15 октября 2026",
    title: "Утренняя сводка и честная конверсия",
    changes: [
      { kind: "new",     text: "Утренняя сводка: бот «Пульс» каждое утро присылает в Битрикс24 итоги вчерашнего дня — каждому только по его разделам" },
      { kind: "new",     text: "Перед сводкой вчерашний день дособирается целиком, вечерние звонки и записи не теряются" },
      { kind: "new",     text: "Для записей колл-центра считается, кто пришёл, не пришёл или ещё ждёт приёма" },
      { kind: "improve", text: "Настройки, которые меняются из интерфейса, хранятся на сервере" },
      { kind: "fix",     text: "Конверсия считает записи по дню создания и пациента один раз — без значений больше 100%" },
      { kind: "fix",     text: "Отчёты отдают итоги и строки в формате, который ждёт интерфейс" },
    ],
  },
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

// ─── Оформление ──────────────────────────────────────────────

const KIND_META: Record<ChangeKind, { label: string; className: string; icon: React.ElementType }> = {
  new:      { label: "Новое",        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: Sparkles     },
  improve:  { label: "Улучшение",    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",          icon: Wrench       },
  fix:      { label: "Исправление",  className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",       icon: CheckCircle2 },
  security: { label: "Безопасность", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",    icon: Shield       },
};

function Badge({ kind }: { kind: ChangeKind }) {
  const { label, className, icon: Icon } = KIND_META[kind];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-bold", className)}>
      <Icon className="h-3 w-3" strokeWidth={2.4} />
      {label}
    </span>
  );
}

function ReleaseCard({ release, current }: { release: Release; current: boolean }) {
  return (
    <article className={cn("card-surface px-4 py-4 sm:px-5", current && "ring-1 ring-brand/30")}>
      <header className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-mono text-[13px] font-extrabold tabular-nums">v{release.version}</span>
        {current && (
          <span className="rounded-[5px] bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.06em] text-brand-foreground">
            текущая
          </span>
        )}
        <span className="ml-auto text-[11px] text-text-3">{release.date}</span>
      </header>
      <h3 className="mt-1 text-[13.5px] font-bold leading-snug">{release.title}</h3>
      <ul className="mt-3 space-y-2">
        {release.changes.map((c, i) => (
          <li key={i} className="flex flex-col items-start gap-1 sm:flex-row sm:gap-2.5">
            <span className="sm:w-[104px] sm:shrink-0"><Badge kind={c.kind} /></span>
            <span className="text-[12.5px] leading-snug text-text-2">{c.text}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ReleaseColumn({
  icon: Icon, title, version, releases,
}: {
  icon: React.ElementType;
  title: string;
  version: string;
  releases: Release[];
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center gap-3 px-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-brand-soft text-brand">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold tracking-[-0.01em]">{title}</h2>
          <p className="text-[11px] text-text-3">
            версия <span className="font-mono font-bold text-text-2">{version}</span> · {releases.length} выпусков
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {releases.map((r, i) => <ReleaseCard key={r.version} release={r} current={i === 0} />)}
      </div>
    </section>
  );
}

// ─── Страница ────────────────────────────────────────────────

export function AboutPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader title="О системе">
        <span className="text-[12px] text-text-3 max-sm:basis-full">Версии и история изменений</span>
      </PageHeader>

      <PageContent>
        {/* О приложении */}
        <div className="card-surface flex flex-col gap-5 px-5 py-5 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-brand text-brand-foreground">
              <Activity className="h-6 w-6" strokeWidth={2} />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-extrabold tracking-[-0.02em]">Пульс — аналитика Labvita</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-text-2">
                Звонки, записи, пациенты, выручка, планы и отчёты клиники в одном месте. Данные обновляются в 9, 12, 15 и 18 часов,
                а утром бот присылает сводку за вчера.
              </p>
            </div>
          </div>
          <dl className="grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-[10px] bg-hairline text-center md:w-[360px]">
            {[
              { label: "Интерфейс", value: `v${APP_VERSION_FRONTEND}` },
              { label: "Сервер",    value: `v${APP_VERSION_BACKEND}` },
              { label: "Обновлено", value: APP_UPDATED.replace(/ \d{4}$/, "") },
            ].map(x => (
              <div key={x.label} className="bg-card px-2 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[.07em] text-text-3">{x.label}</dt>
                <dd className="mt-0.5 font-mono text-[13px] font-bold tabular-nums">{x.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Обозначения */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[.07em] text-text-3">Обозначения</span>
          {(Object.keys(KIND_META) as ChangeKind[]).map(k => <Badge key={k} kind={k} />)}
        </div>

        {/* История: интерфейс слева, сервер справа */}
        <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-5">
          <ReleaseColumn icon={Monitor} title="Интерфейс" version={APP_VERSION_FRONTEND} releases={FRONTEND_RELEASES} />
          <ReleaseColumn icon={Server}  title="Сервер"    version={APP_VERSION_BACKEND}  releases={BACKEND_RELEASES} />
        </div>
      </PageContent>
    </div>
  );
}
