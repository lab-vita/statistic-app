#!/usr/bin/env python3
"""
Матчинг продаж со справочником услуг — заполняет sale.service_id.

Алгоритм:
  1. Точное совпадение по service_title
  2. Нормализованное совпадение (кириллица А → латиница A, пробелы)
  3. Ручной маппинг для известных опечаток

Запуск:
    cd backend && python scripts/match_sales_services.py
"""
import asyncio
import logging
import re
import sys

sys.path.insert(0, ".")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Ручной маппинг: service_title (из sales) → service_id
# Используется для опечаток и бывших услуг без прямого совпадения
MANUAL_MAPPING = {
    # Опечатка "Ультрозвуковая" → справочная услуга [543]
    "А044.12.002 Ультрозвуковая допплерография сосудов (артерий и вен) верхних конечностей": 543,
    # Опечатка "ввдение" → внутрисуставное введение [892]
    "Внутрисуставное  ввдение лекарственных препаратов": 892,
}


def normalize(s: str) -> str:
    cyrillic_latin = {
        'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'К': 'K',
        'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'Т': 'T',
        'Х': 'X', 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p',
        'с': 'c', 'х': 'x',
    }
    return re.sub(r'\s+', ' ', ''.join(cyrillic_latin.get(c, c) for c in s)).strip().lower()


async def main() -> None:
    from sqlalchemy import select, update
    from app.db.database import engine, Base, async_session_factory
    from app.models.sale import Sale
    from app.models.service import Service

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        # Загружаем все услуги из справочника
        result = await db.execute(select(Service))
        services = result.scalars().all()

        svc_by_exact = {s.title.strip(): s for s in services}
        svc_by_norm  = {}
        for s in services:
            n = normalize(s.title)
            if n not in svc_by_norm:
                svc_by_norm[n] = s

        # Загружаем все продажи
        result = await db.execute(select(Sale))
        sales = result.scalars().all()

        stats = {"exact": 0, "norm": 0, "manual": 0, "null": 0, "already": 0}

        for sale in sales:
            if sale.service_id is not None:
                stats["already"] += 1
                continue

            title = sale.service_title.strip()
            svc = None

            # 1. Ручной маппинг
            if title in MANUAL_MAPPING:
                sid = MANUAL_MAPPING[title]
                svc = svc_by_exact.get(
                    next((s.title for s in services if s.id == sid), ""), None
                )
                if svc is None:
                    # Поищем по id напрямую
                    svc = next((s for s in services if s.id == sid), None)
                if svc:
                    stats["manual"] += 1

            # 2. Точное совпадение
            if svc is None and title in svc_by_exact:
                svc = svc_by_exact[title]
                stats["exact"] += 1

            # 3. Нормализованное
            if svc is None:
                n = normalize(title)
                if n in svc_by_norm:
                    svc = svc_by_norm[n]
                    stats["norm"] += 1

            if svc:
                sale.service_id = svc.id
            else:
                stats["null"] += 1
                logger.info(f"  [null] {title}")

        await db.commit()

    logger.info(f"\n=== Результат ===")
    logger.info(f"  Уже были заполнены: {stats['already']}")
    logger.info(f"  Точное совпадение:    {stats['exact']}")
    logger.info(f"  Нормализация:          {stats['norm']}")
    logger.info(f"  Ручной маппинг:       {stats['manual']}")
    logger.info(f"  Не найдено (null):    {stats['null']}")
    logger.info(f"  Итого обработано:     {sum(stats.values())}")


if __name__ == "__main__":
    asyncio.run(main())
