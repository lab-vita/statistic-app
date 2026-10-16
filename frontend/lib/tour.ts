/**
 * Обучающий тур по «Пульсу»: шаги и главы.
 *
 * Шаг подсвечивает элемент с атрибутом data-tour="<id>" (первый видимый из target)
 * и при необходимости сначала открывает свой раздел. Если элемента на экране нет
 * (данные не пришли, у пользователя нет права), подсказка показывается по центру.
 *
 * Главы совпадают с разделами меню и показываются, только если раздел доступен.
 * Новый раздел или заметная кнопка — добавить шаг сюда и метку data-tour на элемент;
 * если изменения стоит показать всем заново — увеличить TOUR_VERSION.
 */
import { API_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import type { Section } from "@/lib/permissions";

// /api/auth/me отдаёт ещё пройденную версию тура (null — ещё не видел)
declare module "@/lib/api" {
  interface AuthUser {
    tour_version?: number | null;
  }
}

/** Версия тура. Пока пользователь не прошёл ни одной — тур запускается сам при входе. */
export const TOUR_VERSION = 1;

/** Тур пройден или закрыт — сервер больше не запускает его сам (на любом компьютере). */
export async function markTourSeen(version: number): Promise<void> {
  const res = await authFetch(`${API_URL}/api/auth/tour`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
  if (!res.ok) throw new Error(`${res.status} — /api/auth/tour`);
}

export interface TourCtx {
  can:    (perm: string) => boolean;
  canSee: (section: Section) => boolean;
  /** узкий экран: меню спрятано за кнопкой */
  mobile: boolean;
}

type Dyn<T> = T | ((c: TourCtx) => T);

export type ChapterId = "intro" | Section | "finish";

export interface TourStep {
  id:       string;
  chapter:  ChapterId;
  /** открыть этот раздел перед шагом */
  section?: Section;
  /** метки data-tour по порядку предпочтения; подсвечивается первая видимая */
  target?:  Dyn<string[]>;
  title:    string;
  text:     Dyn<string>;
  points?:  Dyn<string[]>;
  /** показывать ли шаг этому пользователю */
  show?:    (c: TourCtx) => boolean;
}

export const CHAPTER_LABELS: Record<ChapterId, string> = {
  intro:        "Знакомство",
  home:         "Главная",
  calls:        "Звонки",
  appointments: "Записи",
  patients:     "Пациенты",
  revenue:      "Выручка",
  doctors:      "Врачи",
  funnel:       "Воронка",
  plans:        "Планы",
  reports:      "Отчёты",
  admin:        "Настройки",
  about:        "О системе",
  finish:       "Готово",
};

/** Порядок глав — как в меню */
export const CHAPTER_ORDER: ChapterId[] = [
  "intro", "home", "calls", "appointments", "patients", "revenue", "doctors",
  "funnel", "plans", "reports", "admin", "about", "finish",
];

const NAV = (c: TourCtx) => (c.mobile ? ["menu-button"] : ["nav"]);
const navItem = (s: Section) => (c: TourCtx) => (c.mobile ? ["menu-button"] : [`nav-${s}`]);

export const TOUR_STEPS: TourStep[] = [
  // ─── Знакомство ────────────────────────────────────────────
  {
    id: "welcome", chapter: "intro",
    title: "Добро пожаловать в «Пульс»",
    text: "Здесь собрана аналитика клиники: звонки, записи, пациенты, выручка, планы и отчёты. " +
          "Покажу за пару минут, где что находится и как этим пользоваться.",
    points: [
      "Листать — кнопками «Далее» и «Назад» или стрелками на клавиатуре",
      "Закрыть можно в любой момент — тур всегда открывается снова из меню",
    ],
  },
  {
    id: "menu", chapter: "intro", target: NAV,
    title: "Разделы",
    text: c => c.mobile
      ? "Эта кнопка открывает меню со всеми разделами. Видны только те, к которым у вас есть доступ."
      : "Слева — все разделы приложения. Видны только те, к которым у вас есть доступ; текущий подсвечен синим.",
  },
  {
    id: "menu-toggle", chapter: "intro", target: ["nav-toggle"],
    show: c => !c.mobile,
    title: "Свернуть или развернуть меню",
    text: "Нажмите на логотип «Пульса», чтобы показать названия разделов или оставить одни значки — " +
          "так на экране больше места для цифр. Выбор запоминается.",
  },
  {
    id: "theme", chapter: "intro", target: c => (c.mobile ? ["menu-button"] : ["theme"]),
    title: "Светлая и тёмная тема",
    text: c => c.mobile
      ? "В меню внизу — переключатель темы: тёмная удобнее вечером и при ярком мониторе."
      : "Переключатель темы: тёмная удобнее вечером и при ярком мониторе.",
  },
  {
    id: "help", chapter: "intro", target: c => (c.mobile ? ["menu-button"] : ["help"]),
    title: "Этот тур — всегда под рукой",
    text: c => c.mobile
      ? "В меню есть кнопка «Как пользоваться» — она запускает тур снова, целиком или по одному разделу."
      : "Кнопка «Как пользоваться» запускает тур снова — целиком или только по разделу, который сейчас открыт.",
  },

  // ─── Главная ───────────────────────────────────────────────
  {
    id: "home-grid", chapter: "home", section: "home", target: ["home-grid"],
    title: "Главная — сводка из виджетов",
    text: "Самое важное за выбранный период на одном экране: звонки, записи, выручка, выполнение планов. " +
          "Каждый виджет показывает только то, на что у вас есть права.",
  },
  {
    id: "home-period", chapter: "home", section: "home", target: ["period"],
    title: "Период",
    text: "Выберите день, неделю, месяц, квартал или год — все цифры на странице пересчитаются. " +
          "Такая кнопка есть почти в каждом разделе.",
  },
  {
    id: "home-dates", chapter: "home", section: "home", target: ["date-nav"],
    title: "Листать периоды",
    text: "Стрелки переключают на предыдущий или следующий месяц (неделю, квартал…). " +
          "Рядом с цифрами показано, как они изменились к прошлому такому же периоду.",
  },
  {
    id: "home-refresh", chapter: "home", section: "home", target: ["refresh"],
    title: "Обновить",
    text: "Данные из МедОДС и Битрикс24 подтягиваются сами в 9, 12, 15 и 18 часов. " +
          "Эта кнопка перечитывает их на экране, если страница была открыта давно.",
  },
  {
    id: "home-customize", chapter: "home", section: "home", target: ["home-customize"],
    title: "Соберите главную под себя",
    text: "В режиме настройки виджеты можно перетаскивать, менять им размер, убирать и добавлять новые из каталога. " +
          "Раскладка сохраняется для вас; вернуть как было — одной кнопкой.",
  },

  // ─── Звонки ────────────────────────────────────────────────
  {
    id: "calls-nav", chapter: "calls", section: "calls", target: navItem("calls"),
    title: "Звонки",
    text: "Работа колл-центра: сколько звонков приняли, пропустили и перезвонили, как быстро и с каким результатом.",
  },
  {
    id: "calls-kpi", chapter: "calls", section: "calls", target: ["calls-kpi"],
    title: "Главные цифры",
    text: "Принятые, исходящие, пропущенные и средний разговор за период.",
    points: [
      "Цветная плашка — изменение к прошлому периоду: зелёная — лучше, красная — хуже",
      "Полоса внизу карточки — выполнение плана и прогноз до конца месяца",
    ],
  },
  {
    id: "calls-filter", chapter: "calls", section: "calls", target: ["filter"],
    title: "Один оператор",
    text: "Выберите оператора, чтобы увидеть только его звонки. «Все операторы» — вернуться к общей картине.",
  },
  {
    id: "calls-time", chapter: "calls", section: "calls", target: ["calls-time"],
    title: "Звонки по времени",
    text: "За день — по часам, за более длинный период — по дням или неделям. Видно, когда нагрузка выше.",
  },
  {
    id: "calls-funnel", chapter: "calls", section: "calls", target: ["calls-funnel"],
    title: "Судьба звонков и конверсия",
    text: "Чем закончились звонки: дозвонились, перезвонил сам клиент, не дозвонились. " +
          "Рядом — сколько принятых звонков превратилось в запись у каждого оператора и цель из «Планов».",
  },
  {
    id: "calls-heatmap", chapter: "calls", section: "calls", target: ["calls-heatmap"],
    title: "Тепловая карта",
    text: "Дни недели и часы: чем темнее клетка, тем больше звонков. Помогает планировать смены операторов.",
  },
  {
    id: "calls-operators", chapter: "calls", section: "calls", target: ["calls-operators"],
    title: "По операторам",
    text: "Таблица по каждому оператору. Пропущенные и перезвоны подсвечены: зелёный — норма, жёлтый — внимание, красный — проблема.",
  },

  // ─── Записи ────────────────────────────────────────────────
  {
    id: "appt-nav", chapter: "appointments", section: "appointments", target: navItem("appointments"),
    title: "Записи",
    text: "Записи на приём из МедОДС: сколько записали, кто пришёл, кто нет, сколько новых пациентов.",
  },
  {
    id: "appt-kpi", chapter: "appointments", section: "appointments", target: ["appt-kpi"],
    title: "Записи и явки",
    text: "Всего записей, явки, неявки и новые пациенты за период. Под «Всего записей» — выполнение плана, под «Явками» — цель по доле явок.",
  },
  {
    id: "appt-filter", chapter: "appointments", section: "appointments", target: ["filter"],
    title: "Один сотрудник",
    text: "Можно посмотреть записи одного сотрудника — оператора колл-центра, администратора или врача.",
  },
  {
    id: "appt-sources", chapter: "appointments", section: "appointments", target: ["appt-sources"],
    title: "Кто записывает",
    text: "Доля записей колл-центра, администраторов и других сотрудников.",
  },
  {
    id: "appt-staff", chapter: "appointments", section: "appointments", target: ["appt-staff"],
    title: "По сотрудникам",
    text: "Записи, явки и неявки каждого сотрудника, сгруппированные по ролям.",
  },

  // ─── Пациенты ──────────────────────────────────────────────
  {
    id: "patients-nav", chapter: "patients", section: "patients", target: navItem("patients"),
    title: "Пациенты",
    text: "Две темы: кто не приходит на приём и кто возвращается снова. По умолчанию — за квартал, чтобы цифр хватало для выводов.",
  },
  {
    id: "patients-noshows", chapter: "patients", section: "patients", target: ["patients-noshows"],
    title: "Неявки",
    text: "Доля неявок и отмен, ниже — по дням недели, часам приёма, новым и повторным пациентам и по врачам. " +
          "Подскажет, кому стоит звонить накануне в первую очередь.",
  },
  {
    id: "patients-returns", chapter: "patients", section: "patients", target: ["patients-returns"],
    title: "Повторные визиты",
    text: "Сколько пациентов уже бывали у вас, сколько вернулись за 30 дней и через сколько дней обычно приходят снова — в целом и по каждому врачу.",
  },

  // ─── Выручка ───────────────────────────────────────────────
  {
    id: "revenue-nav", chapter: "revenue", section: "revenue", target: navItem("revenue"),
    title: "Выручка",
    text: "Деньги за период: сколько получили, сколько платежей, средний чек и способы оплаты.",
  },
  {
    id: "revenue-kpi", chapter: "revenue", section: "revenue", target: ["revenue-kpi"],
    title: "Выручка и план",
    text: "Сумма за период с изменением к прошлому, выполнение плана по выручке, число платежей, средний чек и доля наличных, карт, безнала и кредита.",
  },
  {
    id: "revenue-chart", chapter: "revenue", section: "revenue", target: ["revenue-chart"],
    title: "Динамика",
    text: "Выручка по дням рядом с прошлым периодом — сразу видно, где отстаём.",
  },
  {
    id: "revenue-categories", chapter: "revenue", section: "revenue", target: ["revenue-categories", "revenue-doctors"],
    title: "Врачи, направления и услуги",
    text: "Ниже — рейтинг врачей по выручке, направления и самые доходные услуги в динамике.",
  },

  // ─── Врачи ─────────────────────────────────────────────────
  {
    id: "doctors-nav", chapter: "doctors", section: "doctors", target: navItem("doctors"),
    title: "Врачи",
    text: "Выручка и средний чек каждого врача за период.",
  },
  {
    id: "doctors-chart", chapter: "doctors", section: "doctors", target: ["doctors-chart"],
    title: "Рейтинг",
    text: "Переключатель над графиком показывает рейтинг по выручке или по среднему чеку.",
  },
  {
    id: "doctors-table", chapter: "doctors", section: "doctors", target: ["doctors-table"],
    title: "Детализация",
    text: "Визиты, выручка, средний чек и как он изменился к прошлому периоду, доля врача в общей выручке.",
  },

  // ─── Воронка ───────────────────────────────────────────────
  {
    id: "funnel-nav", chapter: "funnel", section: "funnel", target: navItem("funnel"),
    title: "Воронка",
    text: "Путь пациента от звонка до приёма и оплаты — где он теряется.",
  },
  {
    id: "funnel-cc", chapter: "funnel", section: "funnel", target: ["funnel-cc"],
    title: "Колл-центр",
    text: "Звонки → записи → пришли на приём. Процент на стрелке — какая доля дошла до следующего шага; цвет — сравнение с целью из «Планов».",
  },
  {
    id: "funnel-clinic", chapter: "funnel", section: "funnel", target: ["funnel-clinic"],
    title: "Вся клиника",
    text: "Все записи, кто бы их ни сделал, — явки и выручка с одного визита.",
  },
  {
    id: "funnel-operators", chapter: "funnel", section: "funnel", target: ["funnel-operators"],
    title: "По операторам",
    text: "Конверсия звонков в записи и явки по каждому оператору колл-центра.",
  },

  // ─── Планы ─────────────────────────────────────────────────
  {
    id: "plans-nav", chapter: "plans", section: "plans", target: navItem("plans"),
    title: "Планы",
    text: c => c.can("plans:edit")
      ? "Здесь задаются планы на месяц, а «Пульс» сравнивает с ними факт во всех разделах."
      : "Планы на месяц и их выполнение. Задаёт их руководитель — здесь видно факт, план и прогноз.",
  },
  {
    id: "plans-month", chapter: "plans", section: "plans", target: ["date-nav"],
    title: "Месяц",
    text: "Стрелки листают месяцы — прошлые, текущий и будущие.",
  },
  {
    id: "plans-cards", chapter: "plans", section: "plans", target: ["plans-cards"],
    title: "Выполнение",
    text: "По каждому показателю — факт, план и прогноз на конец месяца при нынешнем темпе. Нажмите на карточку, чтобы открыть её в календаре.",
  },
  {
    id: "plans-calendar", chapter: "plans", section: "plans", target: ["plans-calendar"],
    title: "По дням",
    text: c => c.can("plans:edit")
      ? "План и факт на каждый день. Нажмите на день, чтобы поправить его план вручную или сделать выходным."
      : "План и факт на каждый день выбранного показателя.",
  },
  {
    id: "plans-editor", chapter: "plans", section: "plans", target: ["plans-editor"],
    show: c => c.can("plans:edit"),
    title: "Задать план",
    text: "Впишите цифру на месяц — она сама разложится по рабочим дням. Отметьте рабочие дни недели; «Как в прошлом» возьмёт цифры прошлого месяца. " +
          "Кнопка «Сохранить» появится в шапке, когда что-то изменится.",
  },

  // ─── Отчёты ────────────────────────────────────────────────
  {
    id: "reports-nav", chapter: "reports", section: "reports", target: navItem("reports"),
    title: "Отчёты",
    text: "Конструктор: любой отчёт по звонкам, записям, пациентам, выручке и услугам — без выгрузок и Excel-формул.",
  },
  {
    id: "reports-builder", chapter: "reports", section: "reports", target: ["reports-builder"],
    title: "Настройки отчёта",
    text: "Выберите данные, период, показатели и группировку — по датам, врачам, операторам, услугам, дням недели. " +
          "Фильтры оставят только нужное, например один врач или только колл-центр.",
  },
  {
    id: "reports-result", chapter: "reports", section: "reports", target: ["reports-result"],
    title: "Результат",
    text: "Итоги со сравнением к прошлому периоду, график и таблица. Всё пересчитывается сразу, как только меняются настройки.",
  },
  {
    id: "reports-templates", chapter: "reports", section: "reports", target: ["reports-templates"],
    title: "Шаблоны",
    text: "Сохраните отчёт как общий шаблон — его откроет одной кнопкой любой, у кого есть доступ. " +
          "Период вроде «прошлый месяц» пересчитывается сам.",
  },
  {
    id: "reports-export", chapter: "reports", section: "reports", target: ["reports-export"],
    title: "Excel и PDF",
    text: "Скачать отчёт файлом: Excel — с таблицей и графиком на отдельном листе, PDF — чтобы распечатать или переслать.",
  },

  // ─── Настройки ─────────────────────────────────────────────
  {
    id: "admin-nav", chapter: "admin", section: "admin", target: c => (c.mobile ? ["menu-button"] : ["nav-admin", "admin-tabs"]),
    title: "Настройки",
    text: "Управление приложением. Вкладки зависят от ваших прав.",
  },
  {
    id: "admin-tabs", chapter: "admin", section: "admin", target: ["admin-tabs", "page-title"],
    title: "Что здесь можно",
    text: "Вкладки настроек:",
    points: c => [
      c.can("users:manage") && "«Доступ» — кому открыт «Пульс»: сотрудники из Битрикс24 и запросы на доступ",
      c.can("users:manage") && "«Роли» — наборы прав; меняете роль — меняются права у всех, кому она назначена",
      c.can("digest:manage") && "«Утренняя сводка» — когда бот присылает итоги вчерашнего дня и кому",
      c.can("logs:view") && "«Журнал обмена» — что и когда пришло из МедОДС и Битрикс24",
      c.can("data:export") && "«База данных» — скачать всю базу одним файлом",
    ].filter((x): x is string => !!x),
  },

  // ─── О системе ─────────────────────────────────────────────
  {
    id: "about", chapter: "about", section: "about", target: c => (c.mobile ? ["menu-button"] : ["nav-about"]),
    title: "О системе",
    text: "Версия приложения и история изменений: что появилось нового и что исправлено.",
  },

  // ─── Готово ────────────────────────────────────────────────
  {
    id: "finish", chapter: "finish", section: "home", target: c => (c.mobile ? ["menu-button"] : ["help"]),
    title: "Вот и всё",
    text: "Если что-то забудется — «Как пользоваться» в меню покажет тур снова, целиком или по одному разделу.",
  },
];

/** Шаги, доступные этому пользователю, по порядку глав */
export function stepsFor(c: TourCtx): TourStep[] {
  return TOUR_STEPS.filter(s => {
    if (s.chapter !== "intro" && s.chapter !== "finish" && !c.canSee(s.chapter)) return false;
    return !s.show || s.show(c);
  });
}

export function resolve<T>(v: Dyn<T> | undefined, c: TourCtx): T | undefined {
  return typeof v === "function" ? (v as (c: TourCtx) => T)(c) : v;
}
