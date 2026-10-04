"""
Каталог прав и роли-шаблоны.

Право — это строка. Раздел открывается правом  view:<раздел>,
действие разрешается отдельным правом. «Главная» доступна любому, кто есть в списке.

Роль — только ШАБЛОН: при выдаче доступа она заполняет галочки прав.
Фактически действует сохранённый у сотрудника список прав, который можно
подправить вручную. Исключение — владелец (owner): у него всегда все права.
"""

# (ключ, подпись, группа)
PERMISSIONS: list[tuple[str, str, str]] = [
    ("view:calls",        "Звонки",                   "Разделы"),
    ("view:appointments", "Записи",                   "Разделы"),
    ("view:revenue",      "Выручка",                  "Разделы"),
    ("view:reports",      "Отчёты",                   "Разделы"),
    ("view:plans",        "Планы",                    "Разделы"),
    ("plans:edit",        "Редактировать планы",      "Действия"),
    ("data:collect",      "Запускать сбор данных",    "Действия"),
    ("users:manage",      "Управлять доступом",       "Действия"),
]

ALL_PERMISSIONS: frozenset[str] = frozenset(k for k, _, _ in PERMISSIONS)

# Право, которое может выдавать только владелец
OWNER_ONLY_PERMISSIONS: frozenset[str] = frozenset({"users:manage"})

ROLES: dict[str, dict] = {
    "owner": {
        "label": "Владелец",
        "permissions": sorted(ALL_PERMISSIONS),
    },
    "admin": {
        "label": "Администратор",
        "permissions": sorted(ALL_PERMISSIONS - OWNER_ONLY_PERMISSIONS),
    },
    "viewer": {
        "label": "Наблюдатель",
        "permissions": ["view:appointments", "view:calls", "view:plans", "view:reports"],
    },
}

DEFAULT_ROLE = "viewer"


def role_permissions(role: str) -> list[str]:
    return list(ROLES[role]["permissions"])


def effective_permissions(role: str, stored: list[str] | None) -> frozenset[str]:
    """Какие права действуют на самом деле. Владелец — всегда все."""
    if role == "owner":
        return ALL_PERMISSIONS
    return frozenset(stored or []) & ALL_PERMISSIONS
