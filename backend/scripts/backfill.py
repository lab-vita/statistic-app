#!/usr/bin/env python3
"""
Историческая выгрузка всех данных с 1 января 2026 по сегодня.

Запуск:
    cd backend && python scripts/backfill.py

Оптимизация:
  - Звонки/записи/платежи: пропускаем чанк если в БД уже есть записи за этот период
  - Sales: пропускаем месяц если записи за него уже есть
  - Все коллекторы идемпотентны (upsert), поэтому повторный запуск безопасен
"""
import asyncio
import logging
import sys
from datetime import date, timedelta

sys.path.insert(0, ".")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DATE_FROM  = date(2026, 1, 1)
DATE_TO    = date.today()
CHUNK_DAYS = 7  # для подневных данных
REVENUE_CHUNK = 30  # для revenue / payment_details


def _chunks(date_from: date, date_to: date, days: int):
    current = date_from
    while current <= date_to:
        yield current, min(current + timedelta(days=days - 1), date_to)
        current += timedelta(days=days)


def _months(date_from: date, date_to: date):
    d = date_from.replace(day=1)
    while d <= date_to:
        next_m = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
        yield d, min(next_m - timedelta(days=1), date_to)
        d = next_m


# ---------------------------------------------------------------------------
# Проверки наличия данных (оптимизация)
# ---------------------------------------------------------------------------

async def _has_calls(db, date_from: date, date_to: date) -> bool:
    from sqlalchemy import select, func
    from app.models.call import Call
    count = await db.scalar(
        select(func.count()).where(
            Call.call_date >= date_from, Call.call_date <= date_to
        )
    )
    return (count or 0) > 0


async def _has_appointments(db, date_from: date, date_to: date) -> bool:
    from sqlalchemy import select, func
    from app.models.appointment import Appointment
    count = await db.scalar(
        select(func.count()).where(
            Appointment.appointment_date >= date_from,
            Appointment.appointment_date <= date_to,
        )
    )
    return (count or 0) > 0


async def _has_payments(db, date_from: date, date_to: date) -> bool:
    from sqlalchemy import select, func
    from app.models.payment import Payment
    count = await db.scalar(
        select(func.count()).where(
            Payment.payment_date >= date_from, Payment.payment_date <= date_to
        )
    )
    return (count or 0) > 0


async def _has_revenue(db, date_from: date, date_to: date) -> bool:
    from sqlalchemy import select, func
    from app.models.revenue import Revenue
    count = await db.scalar(
        select(func.count()).where(
            Revenue.revenue_date >= date_from, Revenue.revenue_date <= date_to
        )
    )
    return (count or 0) > 0


async def _has_payment_details(db, date_from: date, date_to: date) -> bool:
    from sqlalchemy import select, func
    from app.models.payment_detail import PaymentDetail
    count = await db.scalar(
        select(func.count()).where(
            PaymentDetail.payment_date >= date_from,
            PaymentDetail.payment_date <= date_to,
        )
    )
    return (count or 0) > 0


async def _has_sales(db, sale_date: date) -> bool:
    from sqlalchemy import select, func
    from app.models.sale import Sale
    count = await db.scalar(
        select(func.count()).where(Sale.sale_date == sale_date)
    )
    return (count or 0) > 0


# ---------------------------------------------------------------------------
# Секции бэкфилла
# ---------------------------------------------------------------------------

async def run_calls(session_factory) -> None:
    from app.services.collector import collect_calls
    logger.info(f"\n--- [1/6] ЗВОНКИ ---")
    for d_from, d_to in _chunks(DATE_FROM, DATE_TO, CHUNK_DAYS):
        async with session_factory() as db:
            if await _has_calls(db, d_from, d_to):
                logger.info(f"  [{d_from} – {d_to}] уже есть, пропуск")
                continue
        try:
            async with session_factory() as db:
                count = await collect_calls(db, d_from, d_to)
            logger.info(f"  [{d_from} – {d_to}] +{count}")
        except Exception as e:
            logger.error(f"  [{d_from} – {d_to}] ОШИБКА: {e}")
        await asyncio.sleep(0.5)


async def run_appointments(session_factory) -> None:
    from app.services.medods_collector import collect_appointments
    logger.info(f"\n--- [2/6] ЗАПИСИ ---")
    for d_from, d_to in _chunks(DATE_FROM, DATE_TO, CHUNK_DAYS):
        async with session_factory() as db:
            if await _has_appointments(db, d_from, d_to):
                logger.info(f"  [{d_from} – {d_to}] уже есть, пропуск")
                continue
        try:
            async with session_factory() as db:
                count = await collect_appointments(db, d_from, d_to)
            logger.info(f"  [{d_from} – {d_to}] +{count}")
        except Exception as e:
            logger.error(f"  [{d_from} – {d_to}] ОШИБКА: {e}")
        await asyncio.sleep(1.0)


async def run_payments(session_factory) -> None:
    from app.services.payments_collector import collect_payments
    logger.info(f"\n--- [3/6] PAYMENTS ---")
    for d_from, d_to in _chunks(DATE_FROM, DATE_TO, CHUNK_DAYS):
        async with session_factory() as db:
            if await _has_payments(db, d_from, d_to):
                logger.info(f"  [{d_from} – {d_to}] уже есть, пропуск")
                continue
        try:
            async with session_factory() as db:
                count = await collect_payments(db, d_from, d_to)
            logger.info(f"  [{d_from} – {d_to}] {count} типов")
        except Exception as e:
            logger.error(f"  [{d_from} – {d_to}] ОШИБКА: {e}")
        await asyncio.sleep(0.5)


async def run_revenue(session_factory) -> None:
    from app.services.revenue_collector import collect_revenue
    logger.info(f"\n--- [4/6] REVENUE ---")
    for d_from, d_to in _chunks(DATE_FROM, DATE_TO, REVENUE_CHUNK):
        async with session_factory() as db:
            if await _has_revenue(db, d_from, d_to):
                logger.info(f"  [{d_from} – {d_to}] уже есть, пропуск")
                continue
        try:
            async with session_factory() as db:
                results = await collect_revenue(db, d_from, d_to)
            logger.info(f"  [{d_from} – {d_to}] {sum(results.values())} записей")
        except Exception as e:
            logger.error(f"  [{d_from} – {d_to}] ОШИБКА: {e}")
        await asyncio.sleep(1.0)


async def run_payment_details(session_factory) -> None:
    from app.services.payment_detail_collector import collect_payment_details
    logger.info(f"\n--- [5/6] PAYMENT DETAILS ---")
    for d_from, d_to in _chunks(DATE_FROM, DATE_TO, REVENUE_CHUNK):
        async with session_factory() as db:
            if await _has_payment_details(db, d_from, d_to):
                logger.info(f"  [{d_from} – {d_to}] уже есть, пропуск")
                continue
        try:
            async with session_factory() as db:
                s = await collect_payment_details(db, d_from, d_to)
            logger.info(f"  [{d_from} – {d_to}] загр.: {s['fetched']}, созд.: {s['created']}, обн.: {s['updated']}")
        except Exception as e:
            logger.error(f"  [{d_from} – {d_to}] ОШИБКА: {e}")
        await asyncio.sleep(1.0)


async def run_sales(session_factory) -> None:
    from app.services.sales_collector import collect_sales
    logger.info(f"\n--- [6/6] SALES ---")
    for d_from, d_to in _months(DATE_FROM, DATE_TO):
        async with session_factory() as db:
            if await _has_sales(db, d_from):
                logger.info(f"  [{d_from} – {d_to}] уже есть, пропуск")
                continue
        try:
            async with session_factory() as db:
                s = await collect_sales(db, d_from, d_to)
            logger.info(f"  [{d_from} – {d_to}] загр.: {s['fetched']}, созд.: {s['created']}, обн.: {s['updated']}")
        except Exception as e:
            logger.error(f"  [{d_from} – {d_to}] ОШИБКА: {e}")
        await asyncio.sleep(2.0)


# ---------------------------------------------------------------------------
# Главная функция
# ---------------------------------------------------------------------------

async def main() -> None:
    from app.db.database import engine, Base, async_session_factory

    logger.info(f"=== БЭКФИЛЛ: {DATE_FROM} → {DATE_TO} ===")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await run_calls(async_session_factory)
    await run_appointments(async_session_factory)
    await run_payments(async_session_factory)
    await run_revenue(async_session_factory)
    await run_payment_details(async_session_factory)
    await run_sales(async_session_factory)

    logger.info("\n✅ Бэкфилл завершён!")


if __name__ == "__main__":
    asyncio.run(main())
