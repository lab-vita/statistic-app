"use client";

import { Activity, Monitor, Server, CheckCircle2, Sparkles, Wrench, Shield, CircleHelp, ArrowRight } from "lucide-react";
import { PageHeader, PageContent } from "@/components/ui/primitives";
import { useTour } from "@/components/tour";
import { cn } from "@/lib/utils";

const APP_VERSION_FRONTEND = "0.18.0";
const APP_VERSION_BACKEND  = "0.19.0";
const APP_UPDATED          = "17 октября 2026";

// ─── Типы ────────────────────────────────────────────────────────

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

// ─── История изменений ───────────────────────────────────────────
// Новые версии — сверху, один выпуск на день. Пишем для пользователя:
// что стало можно и что исправлено, коротко и без технических подробностей.

const FRONTEND_RELEASES: Release[] = [
  {
    version: "0.18.0",
    date: "17 октября 2026",
    title: "Главная одинаковая везде",
    changes: [
      { kind: "improve", text: "Раскладка главной хранится на сервере — одинаковая на любом компьютере и в Битрикс24" },
      { kind: "new",     text: "По умолчанию на главной все виджеты; лишнее убирается в «Настроить»" },
    ],
  },
  {
    version: "0.17.0",
    date: "16 октября 2026",
    title: "Роли, планы, журнал обмена и обучающий тур",
    changes: [
      { kind: "new",     text: "Обучающий тур: сам при первом входе, повторно — «Как пользоваться» в меню" },
      { kind: "new",     text: "Роли с набором прав; сотрудники добавляются из списка Битрикс24 с фото и должностью" },
      { kind: "new",     text: "«Планы»: план на месяц сам раскладывается по рабочим дням; выручка, цели по конверсии и явкам, кнопка «Как в прошлом»" },
      { kind: "new",     text: "Выполнение плана и прогноз во всех разделах — за любой период" },
      { kind: "new",     text: "В настройках — журнал обмена с МедОДС и Битрикс24 и выгрузка всей базы" },
      { kind: "fix",     text: "Снова работают добавление и удаление сотрудников; «Воронка» открывается всем, у кого есть право; план попадает в карточки и сводку" },
    ],
  },
  {
    version: "0.12.0",
    date: "15 октября 2026",
    title: "Отчёты, пациенты и работа на телефоне",
    changes: [
      { kind: "new",     text: "Конструктор отчётов: показатели, группировки, фильтры, общие шаблоны, выгрузка в Excel и PDF" },
      { kind: "new",     text: "Раздел «Пациенты»: неявки и повторные визиты; в «Выручке» — направления, во «Врачах» — средний чек" },
      { kind: "new",     text: "Удобно на телефоне и в узком окне Битрикс24; воронка разделена на колл-центр и всю клинику" },
      { kind: "new",     text: "Настройки утренней сводки" },
      { kind: "fix",     text: "Конверсия больше не бывает выше 100%, периоды не сдвигаются на день" },
    ],
  },
  {
    version: "0.9.0",
    date: "14 октября 2026",
    title: "Новый дизайн и главная из виджетов",
    changes: [
      { kind: "new",     text: "Дизайн по макету Labvita" },
      { kind: "new",     text: "Главная из виджетов всех разделов: перетаскивание, размеры, каталог с превью" },
      { kind: "fix",     text: "«Врачи» не падают, если у оплаты не указан врач" },
    ],
  },
  {
    version: "0.8.0",
    date: "11–13 октября 2026",
    title: "Переработка интерфейса",
    changes: [
      { kind: "improve", text: "Интерфейс переписан — быстрее и удобнее" },
      { kind: "security",text: "Вход через Битрикс24 во всех запросах, строже доступ к разделам" },
    ],
  },
  {
    version: "0.7.0",
    date: "8–9 октября 2026",
    title: "Редизайн",
    changes: [
      { kind: "new",     text: "Дизайн-система: цвета, отступы, шрифты" },
    ],
  },
  {
    version: "0.6.0",
    date: "4–7 октября 2026",
    title: "«Пульс»",
    changes: [
      { kind: "new",     text: "Новое название и оформление; виджеты воронки звонков, потерянных клиентов, времени реакции и качества операторов" },
      { kind: "security",text: "Обновлены зависимости" },
    ],
  },
  {
    version: "0.5.0",
    date: "29 сентября – 1 октября 2026",
    title: "Выручка и настраиваемая главная",
    changes: [
      { kind: "new",     text: "Раздел «Выручка»; виджеты главной можно перетаскивать и менять размер" },
    ],
  },
  {
    version: "0.4.0",
    date: "13 сентября 2026",
    title: "Конверсия",
    changes: [
      { kind: "new",     text: "Конверсия в «Звонках», разбивка записей по группам" },
    ],
  },
  {
    version: "0.3.0",
    date: "11–12 сентября 2026",
    title: "Планы",
    changes: [
      { kind: "new",     text: "Раздел «Планы», выполнение плана в карточках, переключатель периода" },
    ],
  },
  {
    version: "0.2.0",
    date: "10 сентября 2026",
    title: "Отчёты",
    changes: [
      { kind: "new",     text: "Раздел «Отчёты», изменения к прошлому периоду, фильтр по группам в «Записях»" },
    ],
  },
  {
    version: "0.1.0",
    date: "9 сентября 2026",
    title: "Первый запуск",
    changes: [
      { kind: "new",     text: "«Главная», «Звонки», «Записи», светлая и тёмная тема" },
    ],
  },
];

const BACKEND_RELEASES: Release[] = [
  {
    version: "0.19.0",
    date: "17 октября 2026",
    title: "Раскладка главной на сервере",
    changes: [
      { kind: "new",     text: "Раскладка виджетов хранится у каждого сотрудника" },
    ],
  },
  {
    version: "0.18.0",
    date: "16 октября 2026",
    title: "Роли, планы и журнал обмена",
    changes: [
      { kind: "new",     text: "Роли хранятся на сервере; права сотрудника берутся из его роли" },
      { kind: "new",     text: "Справочник сотрудников Битрикс24 с фото и должностями" },
      { kind: "new",     text: "План месяца хранится целиком; план и факт по дням для всех показателей; цели за квартал и год" },
      { kind: "new",     text: "Журнал запросов к МедОДС и Битрикс24, выгрузка базы" },
      { kind: "new",     text: "Отметка о пройденном туре; аватарка бота" },
      { kind: "security",text: "Нельзя выдать права шире своих; пароли и токены не попадают в журнал" },
    ],
  },
  {
    version: "0.13.0",
    date: "15 октября 2026",
    title: "Отчёты, пациенты и утренняя сводка",
    changes: [
      { kind: "new",     text: "Расчёт отчётов конструктора, шаблоны, файлы Excel и PDF" },
      { kind: "new",     text: "Неявки, повторные визиты, выручка по направлениям, средний чек" },
      { kind: "new",     text: "Утренняя сводка в Битрикс24 — каждому по его разделам" },
      { kind: "fix",     text: "Статусы записей сверяются с МедОДС; конверсия считается без повторов" },
    ],
  },
  {
    version: "0.10.0",
    date: "11–13 октября 2026",
    title: "Вход через Битрикс24",
    changes: [
      { kind: "security",text: "Все запросы — с токеном Битрикс24, строже доступ к разделам" },
    ],
  },
  {
    version: "0.9.0",
    date: "3–4 октября 2026",
    title: "Запуск на сервере и доступ",
    changes: [
      { kind: "new",     text: "Рабочая установка на сервере, вход через Битрикс24, роли и заявки на доступ" },
      { kind: "security",text: "Обновлены зависимости" },
    ],
  },
  {
    version: "0.8.0",
    date: "26–28 сентября 2026",
    title: "Платежи и связка звонков",
    changes: [
      { kind: "new",     text: "Детализация платежей; связка звонков с записями по телефону и времени" },
      { kind: "fix",     text: "Расчёт конца месяца и продаж по дням" },
    ],
  },
  {
    version: "0.7.0",
    date: "25 сентября 2026",
    title: "Переработка сервера",
    changes: [
      { kind: "improve", text: "Расчёты вынесены в отдельные модули, данные собираются параллельно" },
    ],
  },
  {
    version: "0.6.0",
    date: "21–24 сентября 2026",
    title: "Сотрудники",
    changes: [
      { kind: "new",     text: "Сотрудники загружаются из МедОДС" },
    ],
  },
  {
    version: "0.5.0",
    date: "19–21 сентября 2026",
    title: "Каталог услуг",
    changes: [
      { kind: "new",     text: "Услуги с категориями, исключение из аналитики, связка продаж с услугами" },
    ],
  },
  {
    version: "0.4.0",
    date: "17–19 сентября 2026",
    title: "Выручка",
    changes: [
      { kind: "new",     text: "Выручка по типам оплаты и по дням, продажи, выгрузка таблиц в CSV" },
    ],
  },
  {
    version: "0.3.0",
    date: "13 сентября 2026",
    title: "Конверсия",
    changes: [
      { kind: "new",     text: "Конверсия звонков в записи, разбивка записей по группам" },
    ],
  },
  {
    version: "0.2.0",
    date: "10–11 сентября 2026",
    title: "Отчёты и планы",
    changes: [
      { kind: "new",     text: "Отчёты по звонкам и записям, изменения к прошлому периоду, планы" },
    ],
  },
  {
    version: "0.1.0",
    date: "9 сентября 2026",
    title: "Первый запуск",
    changes: [
      { kind: "new",     text: "Сбор данных 4 раза в день, загрузка истории с 1 января 2026" },
    ],
  },
];

// ─── Оформление ──────────────────────────────────────────────────

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

// ─── Страница ────────────────────────────────────────────────────

export function AboutPage() {
  const tour = useTour();
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
                Метрики и отчёты медицинского центра в одном месте с ежедневным обновлением данных
                и автоматической рассылкой сводки.
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

        {/* Обучающий тур */}
        <div className="card-surface flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-brand-soft text-brand">
            <CircleHelp className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">Как пользоваться «Пульсом»</p>
            <p className="mt-0.5 text-[12px] leading-snug text-text-2">
              Короткий тур по приложению: где что находится и что означают цифры. Можно пройти целиком или выбрать один раздел.
            </p>
          </div>
          <button type="button" onClick={() => tour.start({})}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-[7px] bg-brand px-3.5 text-[12px] font-semibold text-brand-foreground transition-colors hover:bg-brand-strong sm:self-center">
            Пройти тур <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
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
