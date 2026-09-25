"""
Планировщик автоматического сбора данных.

Логика:
- Сегодняшний день (UTC+7) обновляется в 09:00, 12:00, 15:00, 18:00 по Кемерово
- Каждый коллектор запускается параллельно в своей сессии через asyncio.gather
- Ошибка одного коллектора не мешает остальным
"""
import asyncio
import logging
from datetime import date
from zoneinfo import ZoneInfo
from typing import Callable, Awaitable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.database import async_session_factory
from app.services.collector import collect_calls
from app.services.medods_collector import collect_appointments
from app.services.revenue_collector import collect_revenue
from app.services.payment_detail_collector import collect_payment_details
from app.services.sales_collector import collect_sales

logger = logging.getLogger(__name__)

TZ_KEMEROVO = ZoneInfo("Asia/Krasnoyarsk")  # UTC+7

# Список коллекторов: (имя, функция(db, date_from, date_to))
_COLLECTORS: list[tuple[str, Callable]] = [
    ("звонки",           collect_calls),
    ("записи",           collect_appointments),
    ("revenue",          collect_revenue),
    ("payment_details",  collect_payment_details),
    ("sales",            collect_sales),
]


async def _run_collector(name: str, fn: Callable, today: date) -> None:
    """Запускает один коллектор в отдельной сессии, логирует результат/ошибку."""
    async with async_session_factory() as db:
        try:
            result = await fn(db, today, today)
            logger.info("[scheduler] %s: %s", name, result)
        except Exception as exc:
            logger.error("[scheduler] Ошибка коллектора '%s': %s", name, exc, exc_info=True)


async def _sync_today() -> None:
    """Запускает все коллекторы параллельно за сегодняшний день."""
    today = date.today()
    logger.info("[scheduler] Запуск синхронизации за %s", today)

    await asyncio.gather(*[
        _run_collector(name, fn, today)
        for name, fn in _COLLECTORS
    ])

    logger.info("[scheduler] Синхронизация завершена за %s", today)


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=TZ_KEMEROVO)

    scheduler.add_job(
        _sync_today,
        trigger=CronTrigger(hour="9,12,15,18", minute=0, timezone=TZ_KEMEROVO),
        id="sync_today",
        name="Синхронизация данных за сегодня",
        replace_existing=True,
        misfire_grace_time=300,
    )

    logger.info("[scheduler] Настроен: 09:00, 12:00, 15:00, 18:00 (Кемерово)")
    return scheduler
