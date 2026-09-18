#!/usr/bin/env python3
"""
Историческая выгрузка продаж по номенклатуре из МедОДС.

Важно: данные приходят агрегированные за период,
поэтому делаем запрос помесячно (sale_date = первый день месяца).

Запуск:
    cd backend && python scripts/backfill_sales.py

Доп. зависимость:
    pip install websockets
"""
import asyncio
import logging
import sys
from datetime import date

sys.path.insert(0, ".")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Период: весь 2026 год по месяцам
MONTHS = [
    (date(2026, 1, 1),  date(2026, 1, 31)),
    (date(2026, 2, 1),  date(2026, 2, 28)),
    (date(2026, 3, 1),  date(2026, 3, 31)),
    (date(2026, 4, 1),  date(2026, 4, 30)),
    (date(2026, 5, 1),  date(2026, 5, 31)),
    (date(2026, 6, 1),  date(2026, 6, 30)),
    (date(2026, 7, 1),  date(2026, 7, 31)),
    (date(2026, 8, 1),  date(2026, 8, 31)),
    (date(2026, 9, 1),  date.today()),
]


async def main() -> None:
    from app.db.database import engine, Base, async_session_factory
    from app.services.sales_collector import collect_sales

    logger.info("=== ПРОДАЖИ ПО НОМЕНКЛАТУРЕ: 2026-01 → сегодня ===")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    for d_from, d_to in MONTHS:
        try:
            async with async_session_factory() as db:
                stats = await collect_sales(db, d_from, d_to)
            logger.info(
                f"[{d_from} – {d_to}] Загр.: {stats['fetched']}, "
                f"Созд.: {stats['created']}, Обн.: {stats['updated']}"
            )
        except Exception as e:
            logger.error(f"[{d_from} – {d_to}] ОШИБКА: {e}")

        await asyncio.sleep(3)  # пауза между месяцами

    logger.info("✅ Готово!")


if __name__ == "__main__":
    asyncio.run(main())
