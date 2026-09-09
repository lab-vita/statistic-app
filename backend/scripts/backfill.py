#!/usr/bin/env python3
"""
Скрипт исторической выгрузки данных с 1 января 2026 по сегодня.

Запуск (внутри Docker-контейнера бэкенда):
    docker exec -it labvita_backend python scripts/backfill.py

Или напрямую из папки backend (с нужным .env):
    cd backend && python scripts/backfill.py

Данные грузятся по неделям, чтобы не перегружать API.
Уже существующие записи пропускаются (idempotent).
"""
import asyncio
import logging
import sys
from datetime import date, timedelta

# Добавляем backend в путь если запускаем напрямую
sys.path.insert(0, ".")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DATE_FROM = date(2026, 1, 1)
DATE_TO   = date.today()
CHUNK_DAYS = 7  # Загружаем по неделям


async def backfill_calls() -> None:
    from app.db.database import engine, Base, async_session_factory
    from app.services.collector import collect_calls

    logger.info(f"=== ЗВОНКИ: {DATE_FROM} → {DATE_TO} ===")
    current = DATE_FROM

    while current <= DATE_TO:
        chunk_end = min(current + timedelta(days=CHUNK_DAYS - 1), DATE_TO)
        try:
            async with async_session_factory() as db:
                count = await collect_calls(db, current, chunk_end)
            logger.info(f"  [{current} – {chunk_end}] +{count} звонков")
        except Exception as e:
            logger.error(f"  [{current} – {chunk_end}] ОШИБКА: {e}")
        current = chunk_end + timedelta(days=1)
        await asyncio.sleep(0.5)  # Небольшая пауза чтобы не долбить API

    logger.info("=== ЗВОНКИ завершены ===\n")


async def backfill_appointments() -> None:
    from app.db.database import async_session_factory
    from app.services.medods_collector import collect_appointments

    logger.info(f"=== ЗАПИСИ МедОДС: {DATE_FROM} → {DATE_TO} ===")
    current = DATE_FROM

    while current <= DATE_TO:
        chunk_end = min(current + timedelta(days=CHUNK_DAYS - 1), DATE_TO)
        try:
            async with async_session_factory() as db:
                count = await collect_appointments(db, current, chunk_end)
            logger.info(f"  [{current} – {chunk_end}] +{count} записей")
        except Exception as e:
            logger.error(f"  [{current} – {chunk_end}] ОШИБКА: {e}")
        current = chunk_end + timedelta(days=1)
        await asyncio.sleep(1.0)  # МедОДС чуть медленнее — пауза побольше

    logger.info("=== ЗАПИСИ МедОДС завершены ===\n")


async def main() -> None:
    logger.info(f"Начинаем историческую выгрузку: {DATE_FROM} → {DATE_TO}")
    logger.info(f"Чанки по {CHUNK_DAYS} дней\n")

    # Инициализируем таблицы
    from app.db.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await backfill_calls()
    await backfill_appointments()

    logger.info("✅ Историческая выгрузка завершена!")


if __name__ == "__main__":
    asyncio.run(main())
