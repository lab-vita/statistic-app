"""
Коллектор справочника услуг из МедОДС.

Алгоритм:
  1. POST /categories/entry_types с id=373 (корень) → список категорий
  2. Для каждой категории POST с её id → список услуг
  3. Upsert ServiceCategory и Service по medods id

Запускать вручную при обновлении прайса или добавлении новых услуг.
Автоматически в планировщике не нужен — справочник меняется редко.
"""
import logging
from datetime import datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.service import Service, ServiceCategory
from app.services.medods import login

logger = logging.getLogger(__name__)

ROOT_CATEGORY_ID = 373  # «Лабвита» — корень каталога


async def _fetch_category(client: httpx.AsyncClient, category_id: int) -> dict:
    """POST /categories/entry_types для одной категории."""
    resp = await client.post(
        f"{settings.MEDODS_URL}/categories/entry_types",
        data={"id": category_id, "category_type": 7, "kind": "false"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if resp.status_code != 200:
        raise Exception(f"entry_types [{category_id}]: HTTP {resp.status_code}")
    return resp.json()


async def _upsert_category(db: AsyncSession, cat: dict) -> None:
    existing = await db.get(ServiceCategory, cat["id"])
    now = datetime.utcnow()
    if existing:
        existing.title     = cat["title"]
        existing.parent_id = cat.get("parent_id")
        existing.deleted   = cat.get("deleted", False)
        existing.synced_at = now
    else:
        db.add(ServiceCategory(
            id        = cat["id"],
            title     = cat["title"],
            parent_id = cat.get("parent_id"),
            deleted   = cat.get("deleted", False),
            synced_at = now,
        ))


async def _upsert_service(db: AsyncSession, item: dict) -> None:
    existing = await db.get(Service, item["id"])
    now = datetime.utcnow()
    unit = None
    mu = item.get("measure_unit")
    if mu:
        unit = mu.get("short_title")

    vals = dict(
        title       = item["title"],
        category_id = item.get("category_id"),
        price       = float(item.get("price") or 0),
        cost_price  = float(item.get("cost_price") or 0),
        kind        = int(item.get("kind") or 4),
        unit        = unit,
        deleted     = False,
        synced_at   = now,
    )
    if existing:
        for k, v in vals.items():
            setattr(existing, k, v)
    else:
        db.add(Service(id=item["id"], **vals))


async def collect_services(db: AsyncSession) -> dict:
    """
    Полная синхронизация справочника услуг и категорий.
    Возвращает: {"categories": N, "services": N}
    """
    client = await login()
    stats = {"categories": 0, "services": 0}

    try:
        # Корневая категория + список категорий
        root_data = await _fetch_category(client, ROOT_CATEGORY_ID)

        # Сохраняем корень
        await _upsert_category(db, root_data["current"])
        stats["categories"] += 1

        categories = root_data.get("catalogs", [])
        logger.info(f"[services] Найдено категорий: {len(categories)}")

        for cat in categories:
            await _upsert_category(db, cat)
            stats["categories"] += 1

            # Услуги категории
            cat_data = await _fetch_category(client, cat["id"])
            items = cat_data.get("items", [])

            for item in items:
                await _upsert_service(db, item)
                stats["services"] += 1

            # Товары из корня (items в root_data)
            logger.info(f"  {cat['title']}: {len(items)} услуг")

        # Услуги прямо в корне (без подкатегории)
        for item in root_data.get("items", []):
            await _upsert_service(db, item)
            stats["services"] += 1

        await db.commit()
        logger.info(f"[services] Готово: {stats['categories']} категорий, {stats['services']} услуг")

    finally:
        await client.aclose()

    return stats
