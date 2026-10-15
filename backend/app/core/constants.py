"""
Константы приложения.

Вынесены сюда из config.py и моделей, чтобы избежать дублирования и circular imports.
"""

# --- Статусы записей МедОДС ---

# Коды сверены со списком статусов в отчётах МедОДС (15.10.2026).
MEDODS_STATUS_NAMES: dict[int, str] = {
    1: "Подтверждён",
    2: "Не подтверждён",
    3: "Счёт выставлен",
    4: "Отменён пациентом",
    5: "Неявка",
    6: "Пришёл",
    7: "Приём завершён",
    8: "Счёт оплачен",
    9: "Одобрен",
    10: "Отменён клиникой",
}

# Посещение состоялось (пришёл / завершён / счёт выставлен / оплачен)
MEDODS_VISIT_STATUSES: frozenset[int] = frozenset({3, 6, 7, 8})

# Неявка
MEDODS_NOSHOW_STATUSES: frozenset[int] = frozenset({5})

# Отмена пациентом или клиникой
MEDODS_CANCEL_STATUSES: frozenset[int] = frozenset({4, 10})

# Приём ещё впереди: не подтверждён / подтверждён / одобрен
MEDODS_PENDING_STATUSES: frozenset[int] = frozenset({1, 2, 9})

# --- Типы звонков Bitrix ---

# CALL_TYPE=2, CALL_FAILED_CODE=200 → входящий отвеченный
BITRIX_CALL_INCOMING = "2"
BITRIX_CALL_OUTGOING = "1"
BITRIX_CODE_ANSWERED = "200"
BITRIX_CODE_MISSED = "304"

# --- Отображаемые названия дней недели ---

DAY_NAMES_RU: list[str] = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
