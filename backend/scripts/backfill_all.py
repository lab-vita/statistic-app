#!/usr/bin/env python3
"""
Полный бэкфилл всех данных за 2026 год из МедОДС.

Запуск:
    cd backend && python scripts/backfill_all.py
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

DATE_FROM = date(2026, 1, 1)
DATE_TO   = date.today()


async def main() -> None:
    from app.db.database import engine, Base, async_session_factory
    from app.services.revenue_collector import collect_revenue
    from app.services.payment_detail_collector import collect_payment_details
    from app.services.sales_collector import collect_sales

    logger.info(f"=== БЭКФИЛЛ всех данных: {DATE_FROM} → {DATE_TO} ===")

    # Создаём таблицы если нет
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # -------------------------------------------------------------------------
    # 1. REVENUE — агрегат по типам оплат, подень, чанк 30 дней
    # -------------------------------------------------------------------------
    logger.info("\n--- [1/3] REVENUE ---")
    current = DATE_FROM
    while current <= DATE_TO:
        chunk_end = min(current + timedelta(days=29), DATE_TO)
        try:
            async with async_session_factory() as db:
                results = await collect_revenue(db, current, chunk_end)
            total = sum(results.values())
            logger.info(f"  [{current} – {chunk_end}] {total} записей")
        except Exception as e:
            logger.error(f"  [{current} – {chunk_end}] ОШИБКА: {e}")
        current = chunk_end + timedelta(days=1)
        if current <= DATE_TO:
            await asyncio.sleep(1)

    # -------------------------------------------------------------------------
    # 2. PAYMENT DETAILS — детальные платежи, чанк 30 дней
    # -------------------------------------------------------------------------
    logger.info("\n--- [2/3] PAYMENT DETAILS ---")
    current = DATE_FROM
    while current <= DATE_TO:
        chunk_end = min(current + timedelta(days=29), DATE_TO)
        try:
            async with async_session_factory() as db:
                stats = await collect_payment_details(db, current, chunk_end)
            logger.info(
                f"  [{current} – {chunk_end}] загр.: {stats['fetched']}, "
                f"созд.: {stats['created']}, обн.: {stats['updated']}"
            )
        except Exception as e:
            logger.error(f"  [{current} – {chunk_end}] ОШИБКА: {e}")
        current = chunk_end + timedelta(days=1)
        if current <= DATE_TO:
            await asyncio.sleep(1)

    # -------------------------------------------------------------------------
    # 3. SALES — помесячно (данные агрегируются за период)
    # -------------------------------------------------------------------------
    logger.info("\n--- [3/3] SALES ---")
    # Генерируем месяцы от DATE_FROM до DATE_TO
    months = []
    d = DATE_FROM.replace(day=1)
    while d <= DATE_TO:
        next_month = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
        month_end = min(next_month - timedelta(days=1), DATE_TO)
        months.append((d, month_end))
        d = next_month

    for d_from, d_to in months:
        try:
            async with async_session_factory() as db:
                stats = await collect_sales(db, d_from, d_to)
            logger.info(
                f"  [{d_from} – {d_to}] загр.: {stats['fetched']}, "
                f"созд.: {stats['created']}, обн.: {stats['updated']}"
            )
        except Exception as e:
            logger.error(f"  [{d_from} – {d_to}] ОШИБКа: {e}")
        if d_to < DATE_TO:
            await asyncio.sleep(2)

    logger.info("\n✅ Бэкфилл завершён!")


if __name__ == "__main__":
    asyncio.run(main())
