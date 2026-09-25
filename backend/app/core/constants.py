"""
Константы приложения.

Вынесены сюда из config.py и моделей, чтобы избежать дублирования и circular imports.
"""

# --- Статусы записей МедОДС ---

MEDODS_STATUS_NAMES: dict[int, str] = {
    2: "Не подтверждён",
    3: "Счёт выставлен",
    4: "Отменён пациентом",
    5: "Неявка",
    6: "Пришёл",
    7: "Приём завершён",
    8: "Счёт оплачен",
    9: "Одобрен",
}

# Посещение состоялось (пришёл / завершён / оплачен)
MEDODS_VISIT_STATUSES: frozenset[int] = frozenset({6, 7, 8})

# Неявка
MEDODS_NOSHOW_STATUSES: frozenset[int] = frozenset({5})

# Отмена пациентом
MEDODS_CANCEL_STATUSES: frozenset[int] = frozenset({4})

# Ожидает подтверждения / одобрен
MEDODS_PENDING_STATUSES: frozenset[int] = frozenset({2, 9})

# --- Типы звонков Bitrix ---

# CALL_TYPE=2, CALL_FAILED_CODE=200 → входящий отвеченный
BITRIX_CALL_INCOMING = "2"
BITRIX_CALL_OUTGOING = "1"
BITRIX_CODE_ANSWERED = "200"
BITRIX_CODE_MISSED = "304"

# --- Отображаемые названия дней недели ---

DAY_NAMES_RU: list[str] = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
