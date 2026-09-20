"""
Коллектор справочника услуг из МедОДС.

Алгоритм (рекурсивный обход дерева категорий):
  1. POST /categories/entry_types с id=373 (корень «Лабвита»)
  2. Сохраняем текущую категорию и её услуги (items)
  3. Для каждой подкатегории (catalogs) — рекурсивно повторяем п.1-3
  4. Upsert ServiceCategory и Service по medods id
  5. Проставляем exclude_from_analytics по списку EXCLUDED_CATEGORY_IDS

Запускать вручную при обновлении прайса:
  POST /api/services/sync
"""
import logging
from datetime import datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.service import Service, ServiceCategory, EXCLUDED_CATEGORY_IDS
from app.services.medods import login

logger = logging.getLogger(__name__)

ROOT_CATEGORY_ID = 373


async def _fetch_category(client: httpx.AsyncClient, category_id: int) -> dict:
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
    excluded = cat["id"] in EXCLUDED_CATEGORY_IDS
    if existing:
        existing.title                  = cat["title"]
        existing.parent_id              = cat.get("parent_id")
        existing.deleted                = cat.get("deleted", False)
        existing.exclude_from_analytics = excluded
        existing.synced_at              = now
    else:
        db.add(ServiceCategory(
            id                      = cat["id"],
            title                   = cat["title"],
            parent_id               = cat.get("parent_id"),
            deleted                 = cat.get("deleted", False),
            exclude_from_analytics  = excluded,
            synced_at               = now,
        ))


async def _upsert_service(
    db: AsyncSession,
    item: dict,
    category_excluded: bool = False,
) -> None:
    existing = await db.get(Service, item["id"])
    now = datetime.utcnow()
    mu = item.get("measure_unit") or {}
    # Услуга исключается если её категория в списке или если category_id напрямую в списке
    excluded = category_excluded or (item.get("category_id") in EXCLUDED_CATEGORY_IDS)
    vals = dict(
        title                   = item["title"],
        category_id             = item.get("category_id"),
        price                   = float(item.get("price") or 0),
        cost_price              = float(item.get("cost_price") or 0),
        kind                    = int(item.get("kind") or 4),
        unit                    = mu.get("short_title"),
        deleted                 = False,
        exclude_from_analytics  = excluded,
        synced_at               = now,
    )
    if existing:
        for k, v in vals.items():
            setattr(existing, k, v)
    else:
        db.add(Service(id=item["id"], **vals))


async def _traverse(
    client: httpx.AsyncClient,
    db: AsyncSession,
    category_id: int,
    stats: dict,
    parent_excluded: bool = False,
    depth: int = 0,
) -> None:
    """Рекурсивно обходит дерево категорий и сохраняет услуги."""
    data = await _fetch_category(client, category_id)
    indent = "  " * depth

    current = data.get("current", {})
    # Категория исключена если она сама в списке или родитель исключён
    current_excluded = parent_excluded or (category_id in EXCLUDED_CATEGORY_IDS)

    if current:
        await _upsert_category(db, current)
        stats["categories"] += 1

    items = data.get("items", [])
    for item in items:
        await _upsert_service(db, item, category_excluded=current_excluded)
        stats["services"] += 1

    if items:
        mark = " [EXCLUDED]" if current_excluded else ""
        logger.info(f"{indent}[{category_id}] {current.get('title', '')}{mark} — {len(items)} услуг")

    for sub in data.get("catalogs", []):
        await _traverse(client, db, sub["id"], stats, current_excluded, depth + 1)


async def collect_services(db: AsyncSession) -> dict:
    """
    Полная синхронизация справочника услуг и категорий.
    Возвращает: {"categories": N, "services": N, "excluded_services": N}
    """
    client = await login()
    stats = {"categories": 0, "services": 0}

    try:
        logger.info(f"[services] Начало синхронизации от корня id={ROOT_CATEGORY_ID}")
        await _traverse(client, db, ROOT_CATEGORY_ID, stats)
        await db.commit()
        logger.info(
            f"[services] Готово: {stats['categories']} категорий, "
            f"{stats['services']} услуг"
        )
    finally:
        await client.aclose()

    return stats
