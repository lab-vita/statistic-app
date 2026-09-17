# CONTEXT.md — Контекст проекта Labvita Analytics

> Этот файл предназначен для быстрого ввода в контекст нового чата с Claude.
> Содержит полное описание проекта, архитектуры, бизнес-логики и текущего состояния.
> Актуален на: сентябрь 2026 г.

---

## 1. Что за проект

Веб-приложение для сбора и визуализации статистики медицинского центра **«Лабвита»** (Кемерово, UTC+7).

**Для кого:** руководитель(и) медцентра. Не операторы, не врачи — только руководство.

**Зачем:** заменить ручное заполнение Excel-таблиц сотрудниками. Данные собираются автоматически, руководитель видит актуальную картину в реальном времени.

**Данные за:** январь 2026 — сегодня (историческая выгрузка выполнена).

**Репозиторий:** https://github.com/lab-vita/statistic-app

---

## 2. Стек

| Слой | Технология |
|------|-----------|
| Бэкенд | Python 3.11 + FastAPI + SQLAlchemy async |
| БД | PostgreSQL 15 (в Docker) |
| Планировщик | APScheduler |
| Фронтенд | Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui + Recharts |
| Шрифт | Montserrat |
| Контейнеризация | Docker Compose (только БД в Docker, бэкенд запускается локально) |

---

## 3. Архитектура

```
Битрикс24 (voximplant.statistic.get)
    └── services/bitrix.py → services/collector.py
            └── PostgreSQL: таблица calls

МедОДС (labvita.medods.ru)
    └── services/medods.py → services/medods_collector.py
            └── PostgreSQL: таблица appointments

APScheduler (09:00 / 12:00 / 15:00 / 18:00 UTC+7)
    └── синхронизирует только текущий день

PostgreSQL
    ├── calls
    ├── appointments
    └── plans

FastAPI (порт 8000)
    ├── /api/calls/*
    ├── /api/appointments/*
    └── /api/plans/*

Next.js (порт 3000)
    └── SPA: Главная | Звонки | Записи | Отчёты | Планы
```

---

## 4. Запуск

```bash
# БД
docker compose up -d db

# Бэкенд (из папки backend)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Фронтенд (из папки frontend)
npm install && npm run dev

# Историческая выгрузка (один раз)
cd backend && python scripts/backfill.py
```

**.env (backend/):**
```
DATABASE_URL=postgresql+asyncpg://labvita:password@localhost:5432/labvita
BITRIX_WEBHOOK_URL=https://your-domain.bitrix24.ru/rest/USER_ID/TOKEN/
MEDODS_USERNAME=...
MEDODS_PASSWORD=...
```

---

## 5. База данных

### Таблица `calls`

```python
class Call(Base):
    __tablename__ = "calls"
    id               # PK
    bitrix_id        # UNIQUE — ID звонка в Битрикс24
    call_type        # "1"=исходящий, "2"=входящий
    call_failed_code # "200"=успех, "304"=пропущен
    call_start_date  # DateTime(timezone=True), UTC
    call_duration    # секунды
    portal_number    # номер клиники
    portal_user_id   # ID оператора в Битрикс (строка: "168","520","544","696")
    phone_number     # номер клиента
    is_incoming      # bool
    is_outgoing      # bool
    is_missed        # bool
    call_record_url  # nullable, ссылка на запись
```

**Классификация звонков:**
- `CALL_TYPE=2 + CALL_FAILED_CODE=200` → `is_incoming=True`
- `CALL_TYPE=1` → `is_outgoing=True`
- `CALL_TYPE=2 + CALL_FAILED_CODE=304` → `is_missed=True`

### Таблица `appointments`

```python
class Appointment(Base):
    __tablename__ = "appointments"
    id                    # PK
    medods_id             # UNIQUE — ID в МедОДС
    appointment_date      # Date, indexed
    appointment_time      # String "HH:MM-HH:MM"
    status                # Integer (см. статусы ниже)
    new_patient           # Boolean
    client_id / name / surname / phone
    doctor_id / name
    administrator_id / name / administrator_surname  # indexed — ключевое поле!
    attraction_source_id / attraction_source_title
    services_json         # JSON строка со списком услуг

    # Properties:
    is_visit     → status in (6, 7, 8)
    is_noshow    → status == 5
    is_cancelled → status == 4
    is_pending   → status in (2, 9)
    is_callcenter → administrator_surname in CALLCENTER_SURNAMES
```

**Статусы записей:**
```
2 → Не подтверждён  (pending)
3 → Счёт выставлен
4 → Отменён         (cancel)
5 → Неявка          (noshow)
6 → Пришёл          (visit)
7 → Приём завершён  (visit)
8 → Счёт оплачен    (visit)
9 → Одобрен         (pending)
```

### Таблица `plans`

```python
class Plan(Base):
    __tablename__ = "plans"
    date    # Date, PK — конкретный день
    metric  # String, PK — "calls_incoming"|"calls_outgoing"|"appt_count"|"calls_missed_pct"
    value   # Float
```

---

## 6. Сотрудники и роли

### Операторы Битрикс24 (колл-центр)

| portal_user_id | Имя | Роль | Примечания |
|---------------|-----|------|-----------|
| 168 | Белобородова Евгения | callcenter | Делает записи по звонкам |
| 520 | Пирожкова Виктория | callcenter | Делает записи по звонкам |
| 544 | Жданова Елена | profosmotr | ⚠️ Менеджер профосмотров — метрики пропущенных не красятся |
| 696 | Часовских Наталья | callcenter | Делает записи по звонкам |

**Номера клиники:**
```
+79049919191 — основной
+79511620204 — Жданова доп.
+79234766196 — Пирожкова доп.
+79511660509 — Часовских доп.
+79234657174 — Белобородова доп.
```

### Администраторы МедОДС (по группам)

| Фамилия | Группа | Роль |
|---------|--------|------|
| Пирожкова | callcenter | Записывает по звонкам |
| Часовских | callcenter | Записывает по звонкам |
| Белобородова | callcenter | Записывает по звонкам |
| Колотова | admin | Встречает пациентов вживую |
| Шипелова | admin | Встречает пациентов вживую |
| Осокина | admin | Встречает пациентов вживую |
| Книга | admin | Встречает пациентов вживую |
| Жданова | other / Профосмотры | Менеджер профосмотров |
| Волкова | other / PR | Иногда помогает со звонками |
| Admin | other / Директор | Исполнительный директор |
| Варанкина | other / Врач | Стоматолог, записывает повторно |
| Поспелов | other / Врач | Стоматолог, записывает повторно |
| Чеснокова | other / Врач | Терапевт |
| Малеева | other / Врач | УЗИ |
| Иванова | other / Прочие | Иногда делает записи |

**Важно:** Пирожкова, Часовских, Белобородова — работают в обоих разрезах (и в звонках и в записях). Жданова — тоже в обоих, но её метрики по звонкам не участвуют в цветовой индикации.

---

## 7. API бэкенда

### `/api/calls/*`

| Эндпоинт | Метод | Параметры | Описание |
|----------|-------|-----------|---------|
| `/collect` | POST | `date_from`, `date_to` | Запустить сбор |
| `/stats` | GET | `date_from`, `date_to`, `operator_id?` | Статистика с дельтами |
| `/daily` | GET | `date_from`, `date_to`, `operator_id?` | По дням |
| `/hourly` | GET | `date_from`, `date_to`, `interval?`, `operator_id?` | По временным слотам (1/5/10/15/30/60/120 мин) |
| `/heatmap` | GET | `date_from`, `date_to`, `operator_id?` | Тепловая карта день×час |
| `/comparison` | GET | `date_from`, `date_to`, `metric?` | Сравнение операторов по дням |
| `/conversion` | GET | `date_from`, `date_to` | Конверсия звонок → запись |
| `/operators` | GET | — | Список операторов |

**Ответ `/stats` — структура:**
```json
{
  "date_from": "2026-09-01",
  "date_to":   "2026-09-17",
  "prev_from": "2026-08-15",
  "prev_to":   "2026-08-31",
  "operators": {
    "168": {
      "name": "Белобородова Евгения",
      "incoming": 132,
      "outgoing": 12,
      "missed": 8,
      "total": 152,
      "avg_duration": 87,
      "avg_wait_time": 26,
      "missed_total": 8,
      "callback_count": 5,
      "callback_pct": 62,
      "avg_reaction_sec": 3162,
      "incoming_delta_pct": 12,
      "incoming_delta_dir": "up",
      "outgoing_delta_pct": 5,
      "outgoing_delta_dir": "down",
      "missed_delta_pct": 8,
      "missed_delta_dir": "up",
      "total_delta_pct": 10,
      "total_delta_dir": "up",
      "avg_duration_delta_pct": 3,
      "avg_duration_delta_dir": "up",
      "callback_pct_delta_pct": 15,
      "callback_pct_delta_dir": "up"
    },
    "total": { ... }
  }
}
```

**Ответ `/conversion`:**
```json
{
  "operators": [
    {
      "operator_id": "168",
      "name": "Белобородова Евгения",
      "surname": "Белобородова",
      "incoming": 132,
      "appointments": 89,
      "conversion_pct": 67.4
    }
  ],
  "total": { "incoming": 350, "appointments": 220, "conversion_pct": 62.9 }
}
```

### `/api/appointments/*`

| Эндпоинт | Метод | Параметры | Описание |
|----------|-------|-----------|---------|
| `/collect` | POST | `date_from`, `date_to` | Запустить сбор |
| `/stats` | GET | `date_from`, `date_to`, `admin_surname?` | Статистика с группами |
| `/daily` | GET | `date_from`, `date_to`, `admin_surname?` | По дням |
| `/admins` | GET | — | Список администраторов из БД с группами |

**Ответ `/stats` — структура:**
```json
{
  "total": {
    "total": 79, "visits": 73, "noshow": 2, "cancels": 3, "pending": 0,
    "new_patients": 17, "callcenter_total": 41,
    "visit_pct": 92.4, "noshow_pct": 2.5,
    "total_delta_pct": 5, "total_delta_dir": "up",
    "visits_delta_pct": 3, "visits_delta_dir": "up",
    ...
  },
  "by_group": {
    "callcenter": { "count": 41, "pct": 51.9, "label": "Колл-центр" },
    "admin":      { "count": 30, "pct": 38.0, "label": "Администраторы" },
    "other":      { "count":  8, "pct": 10.1, "label": "Прочие" }
  },
  "by_admin": {
    "Пирожкова": {
      "name": "Пирожкова", "group": "callcenter", "group_label": "Колл-центр",
      "total": 20, "visits": 19, "visit_pct": 95.0, ...
    }
  }
}
```

### `/api/plans/*`

| Эндпоинт | Метод | Параметры | Описание |
|----------|-------|-----------|---------|
| `/month` | GET | `year`, `month` | План по дням за месяц |
| `/range` | GET | `date_from`, `date_to` | Суммарный план за период (для прогресс-баров) |
| `/upsert` | POST | `{ items: [{date, metric, value}] }` | Сохранить планы |
| `/fill` | POST | `{ date_from, date_to, metric, value, skip_weekends }` | Быстрое заполнение |

---

## 8. Фронтенд — структура разделов

### Навигация (sidebar.tsx)

```
Тип Section = "home" | "calls" | "appointments" | "reports" | "plans"

Сайдбар (180px):
  🏠 Главная
  📞 Звонки
  📅 Записи
  📊 Отчёты
  🎯 Планы
  ──────────
  🌙 Тема
```

### Топбар (topbar.tsx)

Показывается только для разделов `calls` и `appointments` (не для home/reports/plans).

Содержит:
- Название раздела
- Фильтр по оператору (звонки) или администратору (записи) — дропдаун с группами
- Переключатель периода: День / Неделя / Месяц / Квартал / Год / Период
- Навигация по датам ← дата →
- Кнопка обновления (запускает collect + перезагрузку)

### Главная (home-dashboard.tsx)

- Переключатель: День | Неделя | Месяц + стрелки навигации
- Два блока рядом: Звонки (4 метрики) и Записи (4 метрики)
- График: почасовой (день) или линейный по дням (неделя/месяц)
- Кнопки "Детали →" ведут в соответствующий раздел

### Звонки

Порядок блоков:
1. `CardsOverview` — 7 карточек (4+3) с дельтами и прогресс-барами плана
2. `HourlyChart` — только при периоде "день"
3. `DailyChart` — только при периоде > день
4. `ComparisonChart` — только без фильтра оператора, только при периоде > день
5. `HeatmapChart` — тепловая карта день×час
6. `OperatorsTable` — только без фильтра оператора
7. `ConversionBlock` — только без фильтра оператора

**Важно по таблице операторов:** Жданова (ID 544) помечена "Профосмотры" — её пропущенные и перезвоны показываются серым цветом без красной индикации. Для остальных: пропущенные >10% → красный бейдж; перезвоны ≥80% → зелёный, ≥50% → жёлтый, <50% → красный.

**Конверсия:** участвуют только операторы с `role=callcenter` (168, 520, 696). Жданова (544) не участвует. Цвета: ≥70% зелёный, ≥40% жёлтый, <40% красный.

### Записи

Порядок блоков:
1. `AppointmentCards` — 7 карточек с источниками записей по группам
2. `AppointmentsDailyChart`
3. `AppointmentsTable` — только без фильтра администратора

**Таблица администраторов** разбита на 3 группы с заголовками:
- Колл-центр (Пирожкова, Часовских, Белобородова)
- Администраторы (Колотова, Шипелова, Осокина, Книга)
- Прочие (Жданова, Волкова, Admin, Варанкина, Поспелов, Чеснокова, Малеева, Иванова)

**Цвета явки:** ≥90% зелёный, ≥75% жёлтый, <75% красный.

**Фильтр в топбаре** (для записей) — показывает администраторов из `/api/appointments/admins`, сгруппированных по ролям.

### Отчёты (reports-dashboard.tsx)

Настройки:
- Источник: Звонки | Записи
- Период: два datepicker
- Разбивка: По дням | По неделям | По месяцам
- Тип графика: Столбцы | Линии
- Метрики: цветные кнопки-тоглы
- Фильтр: выпадающий список

8 пресетов быстрого запуска (меняют все настройки разом).

Результат: график + сводная таблица с дельтами + детализация по сотрудникам (для записей).

### Планы (plans-dashboard.tsx)

Главный экран:
- Навигация ← Месяц Год →
- 4 карточки звонков: Входящие, Исходящие, Общий (авто), Пропущенные ≤%
- 1 карточка записей: Записей в день

Клик на карточку → модалка с:
- Навигацией по месяцам (независимо от главного экрана)
- Таблицей дней (все редактируемые, выходные серые но не заблокированы)
- Быстрым заполнением (одно значение → все дни)
- Итого внизу
- Кнопкой Сохранить

Карточка "Пропущенные ≤%" → отдельная модалка с одним полем ввода.

---

## 9. Бизнес-логика

### Расчёт перезвонов

```
1. Берём все пропущенные звонки за период
2. Для каждого пропущенного ищем исходящий на тот же номер
   в течение 24 часов после пропуска
3. Если найден → звонок перезвонен
4. avg_reaction_sec = среднее (время перезвона − время пропуска)
```

### Дельты к предыдущему периоду

```
Текущий: 01.09—17.09 (17 дней)
Предыдущий: 15.08—31.08 (17 дней)

delta_pct = round((current - prev) / prev * 100)
delta_dir = "up" | "down" | "flat"

Инверсия для пропущенных:
  dir="down" → зелёный (меньше пропущенных = хорошо)
  dir="up"   → красный
```

### Прогресс план/факт

```
Карточки "Входящие" и "Исходящие":
  plan = /api/plans/range → totals.calls_incoming
  pct  = fact / plan * 100

Карточка "Пропущенные":
  plan = fixed threshold (calls_missed_pct, default 6%)
  pct  = missed_pct / threshold * 100
  Инвертирован: ≤100% → зелёный (не превышен порог)

Карточка "Всего записей":
  plan = /api/plans/range → totals.appt_count
  pct  = fact / plan * 100
```

### Конверсия звонок → запись

```
Связка Битрикс → МедОДС:
  portal_user_id "168" ↔ administrator_surname "Белобородова"
  portal_user_id "520" ↔ administrator_surname "Пирожкова"
  portal_user_id "696" ↔ administrator_surname "Часовских"
  (Жданова 544 не участвует)

Формула:
  conversion_pct = записей_за_период / входящих_за_период * 100
```

### Часовой пояс

```
Битрикс хранит UTC.
Для отображения: UTC+7 (Asia/Krasnoyarsk)
Для группировки по часам: local_h = (utc_h + 7) % 24
Планировщик: timezone=Asia/Krasnoyarsk
```

### Источники записей (by_group)

```
callcenter → administrator_surname in {"Пирожкова","Часовских","Белобородова","Жданова"}
admin      → группа "admin" из ADMIN_GROUPS в config.py
other      → все остальные
```

---

## 10. Планировщик

```python
# scheduler.py
# Запускается автоматически в lifespan FastAPI

scheduler = AsyncIOScheduler(timezone="Asia/Krasnoyarsk")
trigger   = CronTrigger(hour="9,12,15,18", minute=0)

# При каждом срабатывании:
async def _sync_today():
    today = date.today()
    await collect_calls(db, today, today)
    await collect_appointments(db, today, today)
```

---

## 11. Файлы фронтенда — краткий справочник

| Файл | Назначение |
|------|-----------|
| `app/page.tsx` | Главный SPA-компонент, управляет state всего приложения |
| `lib/api.ts` | Все TypeScript-типы и fetch-функции для API |
| `lib/periods.ts` | Логика периодов: getDefaultPeriod, shiftPeriod, formatPeriodLabel |
| `components/sidebar.tsx` | Навигация, определяет тип `Section` |
| `components/topbar.tsx` | Шапка с фильтрами и переключателем периода |
| `components/stat-card.tsx` | Универсальная карточка метрики: значение + дельта + прогресс плана |
| `components/home-dashboard.tsx` | Главная страница с переключателем периода |
| `components/cards-overview.tsx` | 7 карточек раздела "Звонки", загружает план сам |
| `components/operators-table.tsx` | Таблица операторов с индикацией Ждановой |
| `components/conversion-block.tsx` | Блок конверсии под таблицей операторов |
| `components/hourly-chart.tsx` | График по часам с переключателем интервала |
| `components/daily-chart.tsx` | График по дням (звонки) |
| `components/heatmap-chart.tsx` | Тепловая карта |
| `components/comparison-chart.tsx` | Сравнение операторов (линейный) |
| `components/appointments-cards.tsx` | Карточки записей + блок источников по группам |
| `components/appointments-table.tsx` | Таблица администраторов по 3 группам |
| `components/appointments-daily-chart.tsx` | График по дням (записи) |
| `components/reports-dashboard.tsx` | Конструктор отчётов с пресетами |
| `components/plans-dashboard.tsx` | Управление планами: карточки + модалки |

---

## 12. Что сделано / что не сделано

### ✅ Готово

- Сбор звонков из Битрикс24 (пагинация, классификация, дедупликация)
- Сбор записей из МедОДС (авторизация через form+CSRF, сбор)
- Автосинхронизация 4 раза в день по расписанию
- Историческая выгрузка с 01.01.2026 (скрипт `backfill.py`)
- Раздел "Главная" с переключателем День/Неделя/Месяц
- Раздел "Звонки": карточки, графики, тепловая карта, таблица, конверсия
- Раздел "Записи": карточки, источники по группам, таблица по ролям
- Раздел "Отчёты": конструктор с 8 пресетами, столбцы/линии, разбивка
- Раздел "Планы": карточки-метрики, модалка с подневным редактированием
- Дельты к предыдущему периоду во всех разделах
- Прогресс план/факт в карточках звонков и записей
- Конверсия звонок → запись (Белобородова, Пирожкова, Часовских)
- Роли сотрудников: Жданова без красных метрик, администраторы по группам
- Фильтры по операторам (звонки) и администраторам (записи) с группировкой
- Тёмная/светлая тема

### 🔲 Запланировано (не сделано)

- **Раздел "Сотрудники"** — профиль каждого: звонки + записи в одном месте
- **Антифрод** — логика временно отключена, нужна переработка (записи без администратора)
- **Сравнение план/факт в отчётах** — пресеты пока без плановой линии на графике
- **Возвращаемость пациентов** — повторные визиты, % retention по месяцам
- **Экспорт** — PDF / Excel (решили пока не делать)
- **Уведомления** — Telegram если пропущенных > порога
- **Мобильная версия** — адаптация под телефон руководителя

---

## 13. Известные нюансы и технический долг

1. **Жданова в CALLCENTER_SURNAMES** — она включена в множество `CALLCENTER_SURNAMES` в config.py (для подсчёта записей через колл-центр), но её роль оператора `profosmotr` — из-за этого в `conversion` она исключена явно через `OPERATOR_TO_SURNAME`. Нужно следить за консистентностью.

2. **Фильтрация по фамилии** — в записях фильтр идёт по `administrator_surname` (строка), не по ID. Если у двух администраторов одинаковая фамилия — данные смешаются. Пока не критично.

3. **SHA файлов для коммитов** — при обновлении файлов через GitHub API нужно передавать актуальный SHA. Получать через `get_file_contents` перед каждым обновлением.

4. **Пагинация Битрикс** — параметр `next` в ответе сломан, двигаемся вручную `start += 50`.

5. **МедОДС авторизация** — 3-шаговый процесс (GET sign_in → POST sign_in → GET / для CSRF). Сессия может протухать — collector заново авторизуется при каждом сборе.

6. **Часовой пояс** — `call_start_date` хранится в UTC с timezone. При группировке по часам добавляем +7. При сдвиге через полночь пересчитываем день недели.

7. **`reports-section.tsx`** — в репозитории есть устаревший файл `reports-section.tsx` (старая версия отчётов). Актуальный компонент — `reports-dashboard.tsx`. Файл можно удалить.

---

*Последнее обновление: сентябрь 2026 г.*
*Репозиторий: https://github.com/lab-vita/statistic-app*
