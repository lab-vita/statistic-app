"""
Каталог прав и роли.

Право — строка. Раздел открывается правом  view:<раздел>, действие — отдельным правом.
«Главная» и «О системе» доступны всем, кто есть в списке доступа.

Роль — набор прав с названием (таблица app_roles). Сотруднику назначается роль,
действуют права роли: поменяли роль — права изменились у всех, у кого она стоит.
Роль «Владелец» встроенная: у неё всегда все права, её нельзя изменить или удалить.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class PermissionDef:
    key: str
    label: str
    group: str
    hint: str = ""
    # без этих прав право не работает — интерфейс ставит их автоматически
    requires: tuple[str, ...] = field(default_factory=tuple)


PERMISSION_DEFS: list[PermissionDef] = [
    PermissionDef("view:calls",        "Звонки",         "Разделы", "Звонки, операторы, конверсия в запись"),
    PermissionDef("view:appointments", "Записи",         "Разделы", "Записи на приём, явки, сотрудники"),
    PermissionDef("view:patients",     "Пациенты",       "Разделы", "Неявки, новые и повторные пациенты"),
    PermissionDef("view:revenue",      "Выручка и врачи", "Разделы", "Оплаты, услуги, направления, рейтинг врачей"),
    PermissionDef("view:funnel",       "Воронка",        "Разделы", "Путь от звонка до оплаты",
                  requires=("view:calls", "view:appointments", "view:revenue")),
    PermissionDef("view:plans",        "Планы",          "Разделы", "Просмотр планов и их выполнения"),
    PermissionDef("view:reports",      "Отчёты",         "Разделы", "Конструктор отчётов и выгрузка в Excel/PDF"),
    PermissionDef("plans:edit",        "Редактировать планы", "Действия", "Задавать план на месяц",
                  requires=("view:plans",)),
    PermissionDef("digest:manage",     "Настраивать утреннюю сводку", "Действия",
                  "Время, получатели и ссылка в сообщении бота"),
    PermissionDef("data:collect",      "Запускать сбор данных", "Действия",
                  "Вручную обновить данные из МедОДС и Битрикс24"),
    PermissionDef("users:manage",      "Управлять доступом", "Действия",
                  "Добавлять сотрудников, назначать и редактировать роли"),
    PermissionDef("logs:view",         "Журнал обмена", "Система",
                  "Все запросы к МедОДС и Битрикс24 и полученные данные"),
    PermissionDef("data:export",       "Выгрузка базы", "Система",
                  "Скачать всю базу данных одним файлом"),
]

# совместимость: (ключ, подпись, группа)
PERMISSIONS: list[tuple[str, str, str]] = [(p.key, p.label, p.group) for p in PERMISSION_DEFS]
PERMISSION_BY_KEY: dict[str, PermissionDef] = {p.key: p for p in PERMISSION_DEFS}
ALL_PERMISSIONS: frozenset[str] = frozenset(PERMISSION_BY_KEY)

# Права, которые может выдавать (и включать в роли) только владелец
OWNER_ONLY_PERMISSIONS: frozenset[str] = frozenset({"users:manage", "logs:view", "data:export"})

OWNER_ROLE = "owner"
DEFAULT_ROLE = "viewer"

_VIEW_ALL = ["view:calls", "view:appointments", "view:patients", "view:revenue",
             "view:funnel", "view:plans", "view:reports"]

# Роли, которые создаются при первом запуске. Все, кроме владельца, можно менять и удалять.
DEFAULT_ROLES: list[dict] = [
    {"id": OWNER_ROLE, "name": "Владелец", "system": True,
     "description": "Все права, включая управление доступом. Изменить нельзя.",
     "permissions": sorted(ALL_PERMISSIONS)},
    {"id": "admin", "name": "Администратор", "system": False,
     "description": "Все разделы, планы, сводка и сбор данных",
     "permissions": sorted(ALL_PERMISSIONS - OWNER_ONLY_PERMISSIONS)},
    {"id": "manager", "name": "Руководитель", "system": False,
     "description": "Все разделы и редактирование планов",
     "permissions": sorted(_VIEW_ALL + ["plans:edit"])},
    {"id": "callcenter", "name": "Колл-центр", "system": False,
     "description": "Звонки, записи и планы",
     "permissions": sorted(["view:calls", "view:appointments", "view:plans"])},
    {"id": "viewer", "name": "Наблюдатель", "system": False,
     "description": "Просмотр звонков, записей, пациентов, планов и отчётов",
     "permissions": sorted(["view:calls", "view:appointments", "view:patients", "view:plans", "view:reports"])},
]

# Шаблоны прав старых ролей — по ним при переходе понимаем, правил ли кто-то права вручную
LEGACY_TEMPLATES: dict[str, frozenset[str]] = {
    "admin":  frozenset({"view:calls", "view:appointments", "view:revenue", "view:reports",
                         "view:plans", "plans:edit", "data:collect"}),
    "viewer": frozenset({"view:appointments", "view:calls", "view:plans", "view:reports"}),
}


def with_requirements(perms: set[str] | list[str]) -> list[str]:
    """Добавить права, без которых выбранные не работают, и убрать неизвестные."""
    out = {p for p in perms if p in ALL_PERMISSIONS}
    for p in list(out):
        out.update(PERMISSION_BY_KEY[p].requires)
    return sorted(out)


# ─── Права ролей в памяти ────────────────────────────────────
# Нужны там, где нет сессии БД под рукой (рассылка сводки). Загружаются при старте
# и обновляются при каждом сохранении роли. Проверка входа читает роль из БД сама.

_ROLE_PERMS: dict[str, frozenset[str]] = {}


def set_role_cache(roles: dict[str, list[str]]) -> None:
    _ROLE_PERMS.clear()
    _ROLE_PERMS.update({rid: frozenset(p) & ALL_PERMISSIONS for rid, p in roles.items()})


def role_permissions(role: str) -> list[str]:
    if role == OWNER_ROLE:
        return sorted(ALL_PERMISSIONS)
    return sorted(_ROLE_PERMS.get(role, frozenset()))


def effective_permissions(role: str, stored: list[str] | None = None,
                          role_perms: list[str] | None = None) -> frozenset[str]:
    """
    Какие права действуют на самом деле. Владелец — всегда все.
    role_perms — права роли из БД (если уже прочитаны); иначе — из памяти;
    роль не найдена — сохранённые у сотрудника права (данные до перехода на роли).
    """
    if role == OWNER_ROLE:
        return ALL_PERMISSIONS
    if role_perms is not None:
        return frozenset(role_perms) & ALL_PERMISSIONS
    if role in _ROLE_PERMS:
        return _ROLE_PERMS[role]
    return frozenset(stored or []) & ALL_PERMISSIONS
