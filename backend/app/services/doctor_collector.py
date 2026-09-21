"""
Коллектор врачей из МедОДС.

Алгоритм:
  1. Авторизуемся через login() — получаем клиент с куками и CSRF
  2. GET /users?page=N с заголовком X-Requested-With: XMLHttpRequest
     → МедОДС отдаёт JSON вместо HTML
  3. Парсим список пользователей, upsert в таблицу doctors
  4. Помечаем deleted=True тех, кого нет в ответе (мягкое удаление)

Запускается вручную:
  POST /api/doctors/sync
Или добавить в scheduler по необходимости.
"""
import logging
from datetime import datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.doctor import Doctor
from app.services.medods import login

logger = logging.getLogger(__name__)


async def _fetch_users_page(client: httpx.AsyncClient, page: int) -> dict:
    """Запрашивает одну страницу пользователей. Возвращает распарсенный JSON."""
    resp = await client.get(
        f"{settings.MEDODS_URL}/users",
        params={"page": page},
        headers={
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
    )
    logger.info(f"[doctors] GET /users?page={page} → HTTP {resp.status_code}")
    logger.info(f"[doctors] Content-Type: {resp.headers.get('content-type', '?')}")
    logger.info(f"[doctors] Response body (500 chars): {resp.text[:500]}")

    if resp.status_code != 200:
        raise Exception(f"GET /users?page={page}: HTTP {resp.status_code} — {resp.text[:500]}")

    return resp.json()


async def collect_doctors(db: AsyncSession) -> dict:
    """
    Полная синхронизация врачей из МедОДС.
    Возвращает: {"created": N, "updated": N, "deleted": N, "total": N}
    """
    client = await login()
    stats = {"created": 0, "updated": 0, "deleted": 0, "total": 0}
    seen_ids: set[int] = set()

    try:
        page = 1
        while True:
            logger.info(f"[doctors] Загрузка страницы {page}")
            data = await _fetch_users_page(client, page)

            # МедОДС возвращает либо список напрямую, либо {users: [...], total_pages: N}
            if isinstance(data, list):
                users = data
                total_pages = 1
            else:
                users = data.get("users", data.get("data", []))
                total_pages = data.get("total_pages", data.get("pages", 1))

            logger.info(f"[doctors] Страница {page}/{total_pages}, пользователей: {len(users)}")

            if not users:
                break

            now = datetime.utcnow()
            for u in users:
                uid = u.get("id")
                if not uid:
                    continue

                seen_ids.add(uid)
                existing = await db.get(Doctor, uid)

                vals = dict(
                    surname=u.get("surname"),
                    name=u.get("name"),
                    second_name=u.get("second_name"),
                    specialty=u.get("specialties_titles"),
                    deleted=u.get("deleted_at") is not None,
                    synced_at=now,
                )

                if existing:
                    for k, v in vals.items():
                        setattr(existing, k, v)
                    stats["updated"] += 1
                else:
                    db.add(Doctor(id=uid, **vals))
                    stats["created"] += 1

            if page >= total_pages:
                break
            page += 1

        # Мягкое удаление тех, кого нет в ответе
        result = await db.execute(select(Doctor).where(Doctor.deleted == False))
        existing_doctors = result.scalars().all()
        for doc in existing_doctors:
            if doc.id not in seen_ids:
                doc.deleted = True
                doc.synced_at = datetime.utcnow()
                stats["deleted"] += 1

        await db.commit()
        stats["total"] = len(seen_ids)
        logger.info(
            f"[doctors] Готово: создано {stats['created']}, "
            f"обновлено {stats['updated']}, помечено удалёнными {stats['deleted']}"
        )

    finally:
        await client.aclose()

    return stats
