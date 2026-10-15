"""
Планировщик автоматического сбора данных.

Логика:
- Сегодняшний день (UTC+7) обновляется в 09:00, 12:00, 15:00, 18:00 по Кемерово
- Каждый коллектор запускается параллельно в своей сессии через asyncio.gather
- Ошибка одного коллектора не мешает остальным
- Утренняя сводка: в заданное в админке время дособираем вчерашний день целиком
  (последний плановый сбор — в 18:00, вечерние звонки и записи иначе не попадут)
  и рассылаем сводку (app/services/digest.py)
"""
import asyncio
import logging
from datetime import date, timedelta
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
from app.services import digest
from app.core.utils import today_local

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


DIGEST_JOB_ID = "daily_digest"
_scheduler: AsyncIOScheduler | None = None


async def _daily_digest() -> None:
    """Дособрать вчерашний день и разослать сводку (если включена и ещё не уходила)."""
    async with async_session_factory() as db:
        cfg = await digest.get_config(db)
    if not cfg["enabled"]:
        return
    yesterday = today_local() - timedelta(days=1)
    if cfg.get("last_sent_for") == yesterday.isoformat():
        logger.info("[scheduler] сводка за %s уже отправлена", yesterday)
        return

    logger.info("[scheduler] утренняя сводка: дособираю %s", yesterday)
    await asyncio.gather(*[_run_collector(name, fn, yesterday) for name, fn in _COLLECTORS])

    async with async_session_factory() as db:
        try:
            result = await digest.send_digest(db, yesterday)
        except Exception as exc:
            logger.error("[scheduler] сводка не отправлена: %s", exc, exc_info=True)
            result = {"for_day": yesterday.isoformat(), "sent": [], "failed": [],
                      "skipped": f"Ошибка при подготовке сводки: {exc}"}
        await digest.update_config(db, last_sent_for=yesterday.isoformat(), last_result=result)
    logger.info("[scheduler] сводка: отправлено %s, ошибок %s, пропуск: %s",
                len(result["sent"]), len(result["failed"]), result.get("skipped"))


def schedule_digest(time_str: str) -> None:
    """Поставить (или переставить) ежедневную сводку на время «ЧЧ:ММ» по Кемерово."""
    if _scheduler is None:
        return
    hour, minute = digest.parse_time(time_str)
    _scheduler.add_job(
        _daily_digest,
        trigger=CronTrigger(hour=hour, minute=minute, timezone=TZ_KEMEROVO),
        id=DIGEST_JOB_ID,
        name="Утренняя сводка",
        replace_existing=True,
        misfire_grace_time=3600,   # сервер перезапускался в момент отправки — догоним в течение часа
        coalesce=True,
    )
    logger.info("[scheduler] утренняя сводка: %02d:%02d (Кемерово)", hour, minute)


async def setup_digest() -> None:
    """При старте: создать таблицу настроек при необходимости и поставить сводку на её время."""
    from app.db.database import engine
    try:
        await digest.create_settings_table(engine)
        async with async_session_factory() as db:
            cfg = await digest.get_config(db)
        schedule_digest(cfg["time"])
    except Exception as exc:
        logger.error("[scheduler] не удалось настроить сводку: %s", exc, exc_info=True)


def create_scheduler() -> AsyncIOScheduler:
    global _scheduler
    scheduler = AsyncIOScheduler(timezone=TZ_KEMEROVO)
    _scheduler = scheduler

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
