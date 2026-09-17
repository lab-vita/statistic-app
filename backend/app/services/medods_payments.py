"""Сервис получения отчёта по типам оплат из МедОДС."""
import logging
from datetime import date

import httpx

logger = logging.getLogger(__name__)

# Месяцы в родительном падеже — именно так МедОДС принимает period
_MONTHS_RU = [
    "", "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
]


def _format_period(d: date) -> str:
    """Форматирует дату в строку периода для МедОДС.

    Пример: date(2026, 9, 17) → '17 сентября 2026 - 17 сентября 2026'
    """
    s = f"{d.day} {_MONTHS_RU[d.month]} {d.year}"
    return f"{s} - {s}"


async def fetch_payment_types(
    client: httpx.AsyncClient,
    day: date,
) -> list[dict]:
    """Запрашивает отчёт по типам оплат за один день.

    Возвращает список вида:
    [
        {"title": "Наличными",  "amount": 228, "sum": 623143.0, "percent": "26.22"},
        {"title": "Картой",     "amount": 614, "sum": 1709943.0, "percent": "71.94"},
        {"title": "Кредитом",   "amount": 33,  "sum": 43920.0,  "percent": "1.85"},
        ...
    ]
    Строки с amount=0 и sum=0 тоже приходят — коллектор их пропустит.
    """
    from app.core.config import settings

    resp = await client.post(
        f"{settings.MEDODS_URL}/reports/create_payment_types",
        data={
            "report[clinic_id]": settings.MEDODS_CLINIC_ID,
            "report[period]":    _format_period(day),
            "report[page]":      1,
            "report[per_page]":  1000,
        },
        headers={
            # МедОДС ожидает form-encoded, но отвечает JSON
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept":        "application/json",
        },
    )

    if resp.status_code != 200:
        raise Exception(
            f"МедОДС payment_types {day}: HTTP {resp.status_code} — {resp.text[:200]}"
        )

    return resp.json().get("data", [])
