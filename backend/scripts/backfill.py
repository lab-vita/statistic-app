#!/usr/bin/env python3
"""
Историческая выгрузка всех данных с 1 января 2026 по сегодня.

Запуск:
    cd backend && python scripts/backfill.py

Оптимизация:
  Для каждого чанка смотрим MAX(date) в БД:
  - Если MAX >= chunk_end  → чанк полностью покрыт, пропускаем
  - Если MAX < chunk_end   → загружаем начиная с MAX+1 день (дозаполняем)
  - Если данных нет вовсе  → загружаем весь чанк

  Sales агрегируются за месяц целиком, поэтому там проверяем
  количество услуг: если > 0 считаем месяц покрытым.

  Все коллекторы идемпотентны (upsert), повторный запуск безопасен.
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

DATE_FROM     = date(2026, 1, 1)
DATE_TO       = date.today()
CHUNK_DAYS    = 7
REVENUE_CHUNK = 30


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


async def _calls_fill_from(db, chunk_from, chunk_to):
    from sqlalchemy import select, func, cast, Date
    from app.models.call import Call
    max_date = await db.scalar(
        select(func.max(cast(Call.call_start_date, Date))).where(
            cast(Call.call_start_date, Date) >= chunk_from,
            cast(Call.call_start_date, Date) <= chunk_to,
        )
    )
    if max_date is None: return chunk_from
    if max_date >= chunk_to: return None
    return max_date + timedelta(days=1)


async def _appointments_fill_from(db, chunk_from, chunk_to):
    from sqlalchemy import select, func
    from app.models.appointment import Appointment
    max_date = await db.scalar(
        select(func.max(Appointment.appointment_date)).where(
            Appointment.appointment_date >= chunk_from,
            Appointment.appointment_date <= chunk_to,
        )
    )
    if max_date is None: return chunk_from
    if max_date >= chunk_to: return None
    return max_date + timedelta(days=1)


async def _revenue_fill_from(db, chunk_from, chunk_to):
    from sqlalchemy import select, func
    from app.models.revenue import Revenue
    max_date = await db.scalar(
        select(func.max(Revenue.revenue_date)).where(
            Revenue.revenue_date >= chunk_from,
            Revenue.revenue_date <= chunk_to,
        )
    )
    if max_date is None: return chunk_from
    if max_date >= chunk_to: return None
    return max_date + timedelta(days=1)


async def _payment_details_fill_from(db, chunk_from, chunk_to):
    from sqlalchemy import select, func
    from app.models.payment_detail import PaymentDetail
    max_date = await db.scalar(
        select(func.max(PaymentDetail.payment_date)).where(
            PaymentDetail.payment_date >= chunk_from,
            PaymentDetail.payment_date <= chunk_to,
        )
    )
    if max_date is None: return chunk_from
    if max_date >= chunk_to: return None
    return max_date + timedelta(days=1)


async def _sales_covered(db, month_start):
    from sqlalchemy import select, func
    from app.models.sale import Sale
    count = await db.scalar(
        select(func.count()).where(Sale.sale_date == month_start)
    )
    return (count or 0) > 0


async def run_calls(session_factory) -> None:
    from app.services.collector import collect_calls
    logger.info("\n--- [1/5] ЗВОНКИ ---")
    for chunk_from, chunk_to in _chunks(DATE_FROM, DATE_TO, CHUNK_DAYS):
        async with session_factory() as db:
            fill_from = await _calls_fill_from(db, chunk_from, chunk_to)
        if fill_from is None:
            logger.info(f"  [{chunk_from} – {chunk_to}] покрыто, пропуск")
            continue
        if fill_from > chunk_from:
            logger.info(f"  [{chunk_from} – {chunk_to}] дозагружаем с {fill_from}")
        try:
            async with session_factory() as db:
                count = await collect_calls(db, fill_from, chunk_to)
            logger.info(f"  [{fill_from} – {chunk_to}] +{count}")
        except Exception as e:
            logger.error(f"  [{fill_from} – {chunk_to}] ОШИБКА: {e}")
        await asyncio.sleep(0.5)


async def run_appointments(session_factory) -> None:
    from app.services.medods_collector import collect_appointments
    logger.info("\n--- [2/5] ЗАПИСИ ---")
    for chunk_from, chunk_to in _chunks(DATE_FROM, DATE_TO, CHUNK_DAYS):
        async with session_factory() as db:
            fill_from = await _appointments_fill_from(db, chunk_from, chunk_to)
        if fill_from is None:
            logger.info(f"  [{chunk_from} – {chunk_to}] покрыто, пропуск")
            continue
        if fill_from > chunk_from:
            logger.info(f"  [{chunk_from} – {chunk_to}] дозагружаем с {fill_from}")
        try:
            async with session_factory() as db:
                count = await collect_appointments(db, fill_from, chunk_to)
            logger.info(f"  [{fill_from} – {chunk_to}] +{count}")
        except Exception as e:
            logger.error(f"  [{fill_from} – {chunk_to}] ОШИБКА: {e}")
        await asyncio.sleep(1.0)


async def run_revenue(session_factory) -> None:
    from app.services.revenue_collector import collect_revenue
    logger.info("\n--- [3/5] REVENUE ---")
    for chunk_from, chunk_to in _chunks(DATE_FROM, DATE_TO, REVENUE_CHUNK):
        async with session_factory() as db:
            fill_from = await _revenue_fill_from(db, chunk_from, chunk_to)
        if fill_from is None:
            logger.info(f"  [{chunk_from} – {chunk_to}] покрыто, пропуск")
            continue
        if fill_from > chunk_from:
            logger.info(f"  [{chunk_from} – {chunk_to}] дозагружаем с {fill_from}")
        try:
            async with session_factory() as db:
                results = await collect_revenue(db, fill_from, chunk_to)
            logger.info(f"  [{fill_from} – {chunk_to}] {sum(results.values())} записей")
        except Exception as e:
            logger.error(f"  [{fill_from} – {chunk_to}] ОШИБКА: {e}")
        await asyncio.sleep(1.0)


async def run_payment_details(session_factory) -> None:
    from app.services.payment_detail_collector import collect_payment_details
    logger.info("\n--- [4/5] PAYMENT DETAILS ---")
    for chunk_from, chunk_to in _chunks(DATE_FROM, DATE_TO, REVENUE_CHUNK):
        async with session_factory() as db:
            fill_from = await _payment_details_fill_from(db, chunk_from, chunk_to)
        if fill_from is None:
            logger.info(f"  [{chunk_from} – {chunk_to}] покрыто, пропуск")
            continue
        if fill_from > chunk_from:
            logger.info(f"  [{chunk_from} – {chunk_to}] дозагружаем с {fill_from}")
        try:
            async with session_factory() as db:
                s = await collect_payment_details(db, fill_from, chunk_to)
            logger.info(
                f"  [{fill_from} – {chunk_to}] "
                f"загр.: {s['fetched']}, созд.: {s['created']}, обн.: {s['updated']}"
            )
        except Exception as e:
            logger.error(f"  [{fill_from} – {chunk_to}] ОШИБКА: {e}")
        await asyncio.sleep(1.0)


async def run_sales(session_factory) -> None:
    from app.services.sales_collector import collect_sales
    logger.info("\n--- [5/5] SALES ---")
    for d_from, d_to in _months(DATE_FROM, DATE_TO):
        async with session_factory() as db:
            covered = await _sales_covered(db, d_from)
        if covered:
            logger.info(f"  [{d_from} – {d_to}] покрыто, пропуск")
            continue
        try:
            async with session_factory() as db:
                s = await collect_sales(db, d_from, d_to)
            logger.info(
                f"  [{d_from} – {d_to}] "
                f"загр.: {s['fetched']}, созд.: {s['created']}, обн.: {s['updated']}"
            )
        except Exception as e:
            logger.error(f"  [{d_from} – {d_to}] ОШИБКА: {e}")
        await asyncio.sleep(2.0)


async def main() -> None:
    from app.db.database import engine, Base, async_session_factory

    logger.info(f"=== БЭКФИЛЛ: {DATE_FROM} → {DATE_TO} ===")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await run_calls(async_session_factory)
    await run_appointments(async_session_factory)
    await run_revenue(async_session_factory)
    await run_payment_details(async_session_factory)
    await run_sales(async_session_factory)

    logger.info("\n✅ Бэкфилл завершён!")


if __name__ == "__main__":
    asyncio.run(main())
