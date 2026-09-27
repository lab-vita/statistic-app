"""
Общие вспомогательные функции для аналитики.

Используется во всех API-модулях, чтобы избежать дублирования логики.
"""
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TZ_LOCAL = ZoneInfo("Asia/Krasnoyarsk")  # UTC+7, Кемерово


def normalize_phone(phone: str | None) -> str | None:
    """
    Нормализует номер телефона к единому формату 79XXXXXXXXX.

    Примеры:
        +79991234567  ->  79991234567
        89991234567   ->  79991234567
        79991234567   ->  79991234567
        9991234567    ->  79991234567
        None          ->  None
    """
    if not phone:
        return None
    digits = re.sub(r"\D", "", str(phone))
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    elif len(digits) == 10:
        digits = "7" + digits
    return digits if len(digits) == 11 else None


def prev_period(date_from: date, date_to: date) -> tuple[date, date]:
    """Возвращает предыдущий период той же длины, что заданный."""
    span = (date_to - date_from).days + 1
    prev_to = date_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=span - 1)
    return prev_from, prev_to


def calc_delta(current: float, previous: float) -> dict:
    """
    Вычисляет дельту между текущим и предыдущим значениями.

    Возвращает: {"delta_pct": int | None, "delta_dir": "up" | "down" | "flat" | None}
    """
    if not previous:
        return {"delta_pct": None, "delta_dir": None}
    pct = round((current - previous) / previous * 100)
    return {
        "delta_pct": abs(pct),
        "delta_dir": "up" if pct > 0 else "down" if pct < 0 else "flat",
    }


def add_deltas(curr: dict, prev: dict, keys: list[str]) -> dict:
    """
    Добавляет дельты к словарю curr по заданным ключам.
    """
    result = dict(curr)
    for key in keys:
        d = calc_delta(curr.get(key, 0), prev.get(key, 0))
        result[f"{key}_delta_pct"] = d["delta_pct"]
        result[f"{key}_delta_dir"] = d["delta_dir"]
    return result


def to_local(dt: datetime) -> datetime:
    """
    Переводит UTC datetime в локальное время (Кемерово, UTC+7).
    """
    if dt.tzinfo is None:
        return dt + timedelta(hours=7)
    return dt.astimezone(TZ_LOCAL).replace(tzinfo=None)


def local_date(dt: datetime) -> date:
    """Возвращает локальную дату для datetime (UTC -> UTC+7)."""
    return to_local(dt).date()
