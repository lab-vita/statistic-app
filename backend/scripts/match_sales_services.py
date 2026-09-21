"""
Матчинг продаж со справочником услуг — заполняет sale.service_id и sale.exclude_from_analytics.

Алгоритм:
  1. Точное совпадение по service_title
  2. Нормализованное (кир. А → лат. A, пробелы)
  3. Ручной маппинг для известных опечаток
  4. Не найденные получают exclude_from_analytics=True

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


def normalize(s: str) -> str:
    cyrillic_latin = {
        'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'К': 'K',
        'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'Т': 'T',
        'Х': 'X', 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p',
        'с': 'c', 'х': 'x',
    }
    return re.sub(r'\s+', ' ', ''.join(cyrillic_latin.get(c, c) for c in s)).strip().lower()


# Ручной маппинг: normalize(sale.service_title) → service_id
# Ключи генерируются через normalize() чтобы гарантировать совпадение
MANUAL_MAPPING = {
    # опечатка "Ультрозвуковая" → [543]
    normalize("А04.12.002 Ультрозвуковая допплерография сосудов (артерий и вен) верхних конечностей"): 543,
    # опечатка "ввдение" → [892]
    normalize("Внутрисуставное  ввдение лекарственных препаратов"): 892,
}


async def main() -> None:
    from sqlalchemy import select
    from app.db.database import engine, Base, async_session_factory
    from app.models.sale import Sale
    from app.models.service import Service

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        result = await db.execute(select(Service))
        services = result.scalars().all()
        svc_by_id    = {s.id: s for s in services}
        svc_by_exact = {s.title.strip(): s for s in services}
        svc_by_norm  = {}
        for s in services:
            n = normalize(s.title)
            if n not in svc_by_norm:
                svc_by_norm[n] = s

        result = await db.execute(select(Sale))
        sales = result.scalars().all()

        stats = {"exact": 0, "norm": 0, "manual": 0, "null": 0}

        for sale in sales:
            title = sale.service_title.strip()
            norm_title = normalize(title)
            svc = None

            # 1. Ручной маппинг
            if norm_title in MANUAL_MAPPING:
                svc = svc_by_id.get(MANUAL_MAPPING[norm_title])
                if svc:
                    stats["manual"] += 1

            # 2. Точное совпадение
            if svc is None and title in svc_by_exact:
                svc = svc_by_exact[title]
                stats["exact"] += 1

            # 3. Нормализованное
            if svc is None and norm_title in svc_by_norm:
                svc = svc_by_norm[norm_title]
                stats["norm"] += 1

            if svc:
                sale.service_id = svc.id
                sale.exclude_from_analytics = svc.exclude_from_analytics
            else:
                sale.service_id = None
                sale.exclude_from_analytics = True
                stats["null"] += 1
                logger.info(f"  [null] {title}")

        await db.commit()

    logger.info(f"\n=== Результат ===")
    logger.info(f"  Точное совпадение:    {stats['exact']}")
    logger.info(f"  Нормализация:          {stats['norm']}")
    logger.info(f"  Ручной маппинг:       {stats['manual']}")
    logger.info(f"  Не найдено (null):    {stats['null']}")
    logger.info(f"  Итого:               {sum(stats.values())}")


if __name__ == "__main__":
    asyncio.run(main())
