"""
Планировщик автоматического сбора данных.

Логика:
- Сегодняшний день (UTC+7) обновляется в 09:00, 12:00, 15:00, 18:00 по Кемерово
- Предыдущие дни не трогаются — данные там полные
"""
import logging
from datetime import date
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.database import async_session_factory
from app.services.collector import collect_calls
from app.services.medods_collector import collect_appointments
from app.services.payments_collector import collect_payments

logger = logging.getLogger(__name__)

TZ_KEMEROVO = ZoneInfo("Asia/Krasnoyarsk")  # UTC+7


async def _sync_today() -> None:
    """Собирает данные за сегодня по Кемерово."""
    today = date.today()
    logger.info(f"[scheduler] Запуск синхронизации за {today}")

    async with async_session_factory() as db:
        try:
            calls_count = await collect_calls(db, today, today)
            logger.info(f"[scheduler] Звонки: +{calls_count} новых")
        except Exception as e:
            logger.error(f"[scheduler] Ошибка сбора звонков: {e}")

    async with async_session_factory() as db:
        try:
            appt_count = await collect_appointments(db, today, today)
            logger.info(f"[scheduler] Записи: +{appt_count} новых/обновлено")
        except Exception as e:
            logger.error(f"[scheduler] Ошибка сбора записей: {e}")

    async with async_session_factory() as db:
        try:
            pay_count = await collect_payments(db, today, today)
            logger.info(f"[scheduler] Выручка: {pay_count} типов оплат обновлено")
        except Exception as e:
            logger.error(f"[scheduler] Ошибка сбора выручки: {e}")


def create_scheduler() -> AsyncIOScheduler:
    """
    Создаёт и настраивает планировщик.
    Запуск в 09:00, 12:00, 15:00, 18:00 по Кемерово (UTC+7 = Asia/Krasnoyarsk).
    """
    scheduler = AsyncIOScheduler(timezone=TZ_KEMEROVO)

    trigger = CronTrigger(
        hour="9,12,15,18",
        minute=0,
        timezone=TZ_KEMEROVO,
    )

    scheduler.add_job(
        _sync_today,
        trigger=trigger,
        id="sync_today",
        name="Синхронизация данных за сегодня",
        replace_existing=True,
        misfire_grace_time=300,
    )

    logger.info("[scheduler] Планировщик настроен: 09:00, 12:00, 15:00, 18:00 (Кемерово)")
    return scheduler
