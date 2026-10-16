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
from app.services.medods_collector import collect_appointments, refresh_appointments_by_date
from app.services.revenue_collector import collect_revenue
from app.services.payment_detail_collector import collect_payment_details
from app.services.sales_collector import collect_sales
from app.services import digest, exchange_log
from app.core.utils import today_local

logger = logging.getLogger(__name__)

TZ_KEMEROVO = ZoneInfo("Asia/Krasnoyarsk")  # UTC+7

async def _collect_appointments(db, day: date, to: date):
    """
    Записи за день, затем статусы записей на 3 дня назад и 2 недели вперёд:
    явки, неявки, отмены и переносы проставляются уже после создания записи.
    Последовательно, а не параллельно — обе части пишут в одну таблицу.
    """
    new = await collect_appointments(db, day, to)
    await refresh_appointments_by_date(db, day - timedelta(days=3), to + timedelta(days=14))
    return new


# Список коллекторов: (ключ, название в журнале, источник, функция(db, date_from, date_to))
_COLLECTORS: list[tuple[str, str, str, Callable]] = [
    ("calls",           "Звонки",                         "bitrix", collect_calls),
    ("appointments",    "Записи на приём и их статусы",   "medods", _collect_appointments),
    ("revenue",         "Выручка по способам оплаты",     "medods", collect_revenue),
    ("payment_details", "Платежи подробно",               "medods", collect_payment_details),
    ("sales",           "Продажи по услугам",             "medods", collect_sales),
]


async def _run_collector(key: str, title: str, source: str, fn: Callable, day: date,
                         trigger: str = "schedule") -> None:
    """Запускает один коллектор в отдельной сессии и сеансе журнала обмена."""
    async with async_session_factory() as db:
        try:
            async with exchange_log.run(key, title, source, trigger, day, day) as run:
                run.result = await fn(db, day, day)
            logger.info("[scheduler] %s: %s", title, run.result)
        except Exception as exc:
            logger.error("[scheduler] Ошибка коллектора '%s': %s", title, exc, exc_info=True)


async def _sync_today() -> None:
    """Запускает все коллекторы параллельно за сегодняшний день."""
    today = date.today()
    logger.info("[scheduler] Запуск синхронизации за %s", today)

    await asyncio.gather(*[
        _run_collector(key, title, source, fn, today)
        for key, title, source, fn in _COLLECTORS
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
    await asyncio.gather(*[_run_collector(key, title, source, fn, yesterday, "digest")
                           for key, title, source, fn in _COLLECTORS])

    async with async_session_factory() as db:
        try:
            async with exchange_log.run("digest", "Утренняя сводка: рассылка", "bitrix", "schedule",
                                        yesterday, yesterday) as run:
                result = await digest.send_digest(db, yesterday)
                run.result = {"sent": result.get("sent", []), "failed": result.get("failed", []),
                              "skipped": result.get("skipped") or ""}
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


async def _sync_bot_avatar() -> None:
    """После старта: обновить аватарку бота в портале, если она поменялась."""
    try:
        async with async_session_factory() as db:
            await digest.sync_avatar(db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[scheduler] аватарка бота: %s", exc)


async def setup_digest() -> None:
    """При старте: создать таблицу настроек при необходимости и поставить сводку на её время."""
    from app.db.database import engine
    try:
        await digest.create_settings_table(engine)
        async with async_session_factory() as db:
            cfg = await digest.get_config(db)
        schedule_digest(cfg["time"])
        schedule_resync()
        asyncio.get_running_loop().create_task(_sync_bot_avatar())
    except Exception as exc:
        logger.error("[scheduler] не удалось настроить сводку: %s", exc, exc_info=True)


RESYNC_KEY = "appt_resync_v1"
RESYNC_FROM = date(2026, 1, 1)


async def _resync_appointments_history() -> None:
    """
    Один раз после обновления: перечитать записи по дню приёма с 1 января,
    чтобы исправить статусы, застрявшие в «ожидает» (раньше записи собирались
    только по дню создания). Идёт по месяцам; итог пишется в app_settings.
    """
    from app.models.app_setting import AppSetting
    async with async_session_factory() as db:
        if await db.get(AppSetting, RESYNC_KEY):
            return
    end = today_local() + timedelta(days=14)
    start, total, errors = RESYNC_FROM, 0, []
    logger.info("[scheduler] пересбор статусов записей: %s — %s", start, end)
    while start <= end:
        month_end = (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        chunk_end = min(month_end, end)
        async with async_session_factory() as db:
            try:
                async with exchange_log.run("resync", "Пересбор статусов записей", "medods", "resync",
                                            start, chunk_end) as run:
                    run.result = await refresh_appointments_by_date(db, start, chunk_end)
                total += run.result
                logger.info("[scheduler] пересбор: %s — %s готово", start, chunk_end)
            except Exception as exc:
                errors.append(f"{start}: {exc}")
                logger.error("[scheduler] пересбор %s — %s: %s", start, chunk_end, exc, exc_info=True)
        start = chunk_end + timedelta(days=1)
    async with async_session_factory() as db:
        if not errors:
            db.add(AppSetting(key=RESYNC_KEY, value={"done": today_local().isoformat(), "new": total}))
            await db.commit()
    logger.info("[scheduler] пересбор статусов записей завершён: новых %s, ошибок %s", total, len(errors))


def schedule_resync() -> None:
    """Запустить разовый пересбор через минуту после старта (если ещё не делали)."""
    if _scheduler is None:
        return
    from datetime import datetime
    _scheduler.add_job(
        _resync_appointments_history,
        trigger="date",
        run_date=datetime.now(TZ_KEMEROVO) + timedelta(minutes=1),
        id="appt_resync",
        name="Пересбор статусов записей",
        replace_existing=True,
        misfire_grace_time=3600,
    )


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

    scheduler.add_job(
        exchange_log.cleanup,
        trigger=CronTrigger(hour=3, minute=17, timezone=TZ_KEMEROVO),
        id="exchange_log_cleanup",
        name="Очистка журнала обмена",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    logger.info("[scheduler] Настроен: 09:00, 12:00, 15:00, 18:00 (Кемерово)")
    return scheduler
