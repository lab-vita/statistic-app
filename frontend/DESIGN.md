# DESIGN.md — Система дизайна Labvita Analytics

> **Обязательно читать перед любыми изменениями фронтенда.**
> Этот файл — единственный источник правил оформления. Нарушения стиля не допускаются.

---

## 1. Философия

**Минималистичный деловой интерфейс.** Аналитическое приложение для руководителя медцентра.
Никакой декоративности. Всё подчинено читаемости данных.

Ориентиры: Linear, Vercel Dashboard, Supabase, Spark Pixel Team dashboard.
Характер: тихий, уверенный, профессиональный.

**Три принципа:**
1. Данные — главное. Интерфейс не должен конкурировать с числами.
2. Иерархия через типографику и пространство, не через цвет.
3. Цвет — только для смысла (статусы, тренды, индикаторы). Не для красоты.

---

## 2. Цвета — токены

Всегда использовать CSS-переменные, **никогда** не хардкодить hex/oklch прямо в классах.

### Семантические токены (из globals.css)

| Токен                 | Назначение                                              |
|-----------------------|---------------------------------------------------------|
| `bg-background`       | Фон страницы (светло-серый, не белый)                  |
| `bg-card`             | Фон карточек (чисто белый)                              |
| `bg-sidebar`          | Фон сайдбара (чуть темнее background)                   |
| `bg-muted`            | Фон неактивных элементов, pill-бейджи без цвета         |
| `bg-accent`           | Hover-состояние на кнопках без акцента                  |
| `text-foreground`     | Основной текст                                          |
| `text-muted-foreground` | Подписи, метки, вторичный текст                       |
| `border-border`       | Все границы                                             |
| `text-primary`        | Заголовки, активные элементы                            |

### Семантические цвета (статусы)

```
Зелёный  — успех, рост хороших метрик, норма: emerald-600 / dark:emerald-400
Красный  — тревога, рост плохих метрик: red-500 / dark:red-400
Жёлтый  — внимание, пограничные значения: amber-600 / dark:amber-400
Синий    — нейтральная информация, ссылки: blue-600 / dark:blue-400
Серый    — отключённые, исключённые данные (Жданова): muted-foreground
```

**Pill-бейджи (статус):** всегда `bg-{цвет}-500/10 text-{цвет}-600 dark:text-{цвет}-400`

**Запрещено:** использовать произвольные цвета вне этого списка. Нет фиолетовых градиентов, нет розового.

### Графики (Recharts)

```
chart-1 — emerald  (принятые звонки, визиты)
chart-2 — blue     (исходящие, нейтральные ряды)
chart-3 — red      (пропущенные, неявки)
chart-4 — amber    (предыдущий период, сравнение)
chart-5 — purple   (только если нужна 5-я серия, редко)
```

---

## 3. Типографика

Шрифт: **Montserrat** (уже подключён через next/font).

### Иерархия текста

| Уровень           | Классы                                                    | Пример                        |
|-------------------|-----------------------------------------------------------|-------------------------------|
| Заголовок страницы| `text-xl font-semibold tracking-tight`                    | «Звонки», «Отчёты»            |
| Заголовок секции  | `text-sm font-semibold`                                   | «Операторы»                   |
| Метка карточки    | `text-[11px] font-semibold uppercase tracking-widest text-muted-foreground` | «ПРИНЯТЫЕ» |
| Значение метрики  | `text-[28px] font-semibold leading-none tracking-tight tabular-nums` | «1 234»  |
| Текст таблицы     | `text-sm`                                                 |                               |
| Вторичный текст   | `text-xs text-muted-foreground`                           | подписи, даты                 |
| Микро-текст       | `text-[11px] text-muted-foreground`                       | бейджи, метки внутри карточек |

**Числа:** всегда `tabular-nums`. Без этого класса числа нельзя использовать в метриках.

**Метки карточек:** ВСЕГДА uppercase + tracking-widest + text-[11px]. Это ключевая сигнатура стиля.

---

## 4. Отступы и сетка

### Сетка страницы

```
Весь контент страницы: p-6 (desktop), p-4 (mobile)
Между секциями: space-y-6
Сетка карточек: grid grid-cols-2 md:grid-cols-4 gap-4
```

### Внутри компонентов

```
Карточка StatCard: p-5, gap-3 между элементами
Таблица: px-4 py-3 на ячейки
Топбар: h-14, px-6
Сайдбар: w-[220px]
```

### Правило пространства

Всегда предпочитать **больше воздуха**. Если сомневаешься между `gap-3` и `gap-4` — выбирай `gap-4`.

---

## 5. Компоненты — правила

### Card

```tsx
// ✅ Правильно
<Card className="p-5 transition-all duration-200 hover:shadow-sm">

// ❌ Нельзя
<Card className="p-4 shadow-lg rounded-2xl border-2">
```

- Граница: стандартная `border-border` (уже в Card по умолчанию)
- Скругление: стандартное `rounded-lg` (из --radius = 0.625rem)
- Тень: только на hover и только `shadow-sm`
- Никаких `shadow-lg`, `shadow-xl`, `rounded-2xl`, `rounded-3xl`

### Таблицы

```
- Без зебры (чередующегося фона строк)
- Разделители: только border-b border-border между строками
- Заголовки колонок: text-[11px] font-semibold uppercase tracking-widest text-muted-foreground
- Hover строки: hover:bg-muted/50
- Статус-бейджи в ячейках: pill-форма, цвет по смыслу
```

### Кнопки

```
Основное действие: variant="default" (тёмный фон, белый текст)
Вторичное:         variant="outline"
Деструктивное:     variant="destructive"
Навигация/иконка:  variant="ghost"

Размер по умолчанию: h-9 text-sm
Не использовать: кастомные bg-* на кнопках вне этих вариантов
```

### Badge / статусы

```tsx
// Зелёный статус
<span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
  Норма
</span>

// Красный статус
<span className="... bg-red-500/10 text-red-600 dark:text-red-400">
  Тревога
</span>
```

Всегда `rounded-full`, всегда `px-2 py-0.5`, всегда `text-[11px] font-medium`.

### Иконки

- Библиотека: **Lucide React** (уже в зависимостях), никаких других
- Размер в тексте/кнопках: `h-4 w-4`
- В иконочных блоках: `h-5 w-5`
- strokeWidth: по умолчанию (1.5) — НЕ менять без причины

### Сепараторы / разделители

- Между секциями: `<Separator />` из shadcn/ui
- Нельзя: горизонтальные линии через border-t самодельно (только если нет Separator)

### Селекты и дропдауны

- Всегда shadcn/ui `<Select>`, никогда нативный `<select>`
- Поповеры: shadcn `<Popover>` или `<DropdownMenu>`

---

## 6. Тёмная тема

**Обязательна для всех компонентов.** Проверять каждый класс на dark-вариант.

Паттерн для цветных текстов:
```
text-emerald-600 dark:text-emerald-400
text-red-600 dark:text-red-400
text-amber-600 dark:text-amber-400
text-blue-600 dark:text-blue-400
```

Паттерн для фонов с прозрачностью работает без dark: — `bg-emerald-500/10` выглядит корректно в обоих темах.

**Нельзя:** жёстко задавать белый/чёрный цвет (`text-white`, `text-black`, `bg-white`, `bg-black`) — только через токены.

---

## 7. Анимации

Только функциональные, не декоративные:

```
Переходы состояний:   transition-all duration-200
Появление данных:     (Recharts сам анимирует)
Индикаторы загрузки: animate-pulse на скелетонах
```

**Нельзя:** `animate-bounce`, `animate-spin` на элементах данных, сложные keyframe-анимации.

---

## 8. Сайдбар

Текущая структура: фиксированная ширина 220px, вертикальный список с иконками и подписями.

Активный элемент: `bg-foreground text-background` (инвертированный).
Неактивный hover: `hover:bg-accent hover:text-foreground`.

При добавлении нового раздела — добавить в `SECTIONS` в `sidebar.tsx` и в тип `Section` в `lib/permissions.ts`.

---

## 9. Графики (Recharts)

Обязательные настройки для всех графиков:

```tsx
// Общие пропсы для осей
<XAxis
  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
  axisLine={false}
  tickLine={false}
/>
<YAxis
  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
  axisLine={false}
  tickLine={false}
/>

// Сетка
<CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />

// Тултип — всегда кастомный
<Tooltip
  contentStyle={{
    background: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    fontSize: 12,
  }}
/>
```

**Нельзя:** использовать дефолтный тултип Recharts (серый фон, не вписывается в тему).

---

## 10. Паттерны загрузки

### Скелетоны

```tsx
// Карточка в загрузке
<Card className="p-5">
  <div className="h-3 w-24 rounded-full bg-muted animate-pulse mb-3" />
  <div className="h-8 w-16 rounded-md bg-muted animate-pulse" />
</Card>
```

### Пустые состояния

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <SomeIcon className="h-8 w-8 text-muted-foreground/40 mb-3" />
  <p className="text-sm text-muted-foreground">Нет данных за выбранный период</p>
</div>
```

---

## 11. Запрещённые паттерны

❌ `shadow-lg`, `shadow-xl`, `shadow-2xl` на карточках  
❌ `rounded-2xl`, `rounded-3xl` на карточках данных  
❌ Градиентные фоны на карточках метрик (кроме специальных виджетов главной)  
❌ Жёсткие hex-цвета вне CSS-переменных  
❌ `text-white` / `text-black` вне `bg-foreground`-контекстов  
❌ Анимации не по делу  
❌ Больше одного акцентного цвета на одном экране (например синий + зелёный одновременно как «декор»)  
❌ Нативные HTML `<select>`, `<input>` без обёртки shadcn  
❌ `!important` в Tailwind (`!text-red-500` и подобное) — только если нет другого способа  
❌ Встроенные стили `style={{}}` для цветов — только для динамических значений (ширина прогресс-бара, цвета графиков)

---

## 12. Структура файлов

```
frontend/
├── app/
│   ├── globals.css        ← единственное место CSS-переменных и базовых стилей
│   ├── layout.tsx         ← шрифты, метаданные
│   └── page.tsx           ← главный SPA, управляет section/period/filter state
├── components/
│   ├── ui/                ← shadcn/ui компоненты, НЕ трогать без нужды
│   ├── sidebar.tsx        ← навигация
│   ├── topbar.tsx         ← фильтры и переключатель периода
│   ├── stat-card.tsx      ← БАЗОВЫЙ компонент карточки метрики
│   └── ...
└── lib/
    ├── api.ts             ← все типы и fetch-функции
    ├── periods.ts         ← логика периодов
    └── permissions.ts     ← роли и права
```

При создании нового компонента:
1. Файл в `components/`, имя kebab-case
2. `"use client"` если есть state/effects
3. Экспорт именованный (`export function MyComponent`)
4. Типы пропсов — interface прямо в файле, не отдельно

---

## 13. Патчи и коммиты

Код поставляется как **git-патч** или список конкретных изменений файлов.
Формат патча — unified diff (`git diff`).

Перед каждым изменением я:
1. Читаю этот файл (`DESIGN.md`)
2. Проверяю, не нарушает ли изменение ни одно из правил выше
3. Пишу минимально необходимый патч

**Один патч = одна логическая задача.** Не смешивать рефактор с новой функциональностью.