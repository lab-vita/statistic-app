#!/usr/bin/env python3
"""
Историческая выгрузка детальных платежей из МедОДС.

Запуск:
    cd backend && python scripts/backfill_payment_details.py
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
CHUNK_DAYS = 30  # МедОДС хорошо отдаёт большие периоды, но не делаем 3 месяца сразу


async def main() -> None:
    from app.db.database import engine, Base, async_session_factory
    from app.services.payment_detail_collector import collect_payment_details

    logger.info(f"=== ДЕТАЛЬНЫЕ ПЛАТЕЖИ: {DATE_FROM} → {DATE_TO} ===")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    current = DATE_FROM
    while current <= DATE_TO:
        chunk_end = min(current + timedelta(days=CHUNK_DAYS - 1), DATE_TO)
        try:
            async with async_session_factory() as db:
                stats = await collect_payment_details(db, current, chunk_end)
            logger.info(
                f"[{current} – {chunk_end}] Загр.: {stats['fetched']}, "
                f"Созд.: {stats['created']}, Обн.: {stats['updated']}"
            )
        except Exception as e:
            logger.error(f"[{current} – {chunk_end}] ОШИБКА: {e}")

        current = chunk_end + timedelta(days=1)
        if current <= DATE_TO:
            await asyncio.sleep(2)

    logger.info("✅ Готово!")


if __name__ == "__main__":
    asyncio.run(main())
