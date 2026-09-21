"""
Коллектор врачей из МедОДС.

Алгоритм:
  1. Авторизуемся через login() — получаем клиент с куками и CSRF
  2. POST /utils/search {"title": "", "model": "user"} — отдаёт список всех пользователей
  3. Парсим список, upsert в таблицу doctors
  4. Помечаем deleted=True тех, кого нет в ответе (мягкое удаление)

Запускается вручную:
  POST /api/doctors/sync
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


async def _fetch_all_users(client: httpx.AsyncClient) -> list[dict]:
    """
    POST /utils/search с пустым title и model=user.
    МедОДС возвращает JSON-список всех пользователей сразу (без пагинации).
    """
    resp = await client.post(
        f"{settings.MEDODS_URL}/utils/search",
        json={"title": "", "model": "user"},
    )
    logger.info(f"[doctors] POST /utils/search → HTTP {resp.status_code}")
    logger.info(f"[doctors] Content-Type: {resp.headers.get('content-type', '?')}")

    if resp.status_code != 200:
        raise Exception(
            f"POST /utils/search: HTTP {resp.status_code} — {resp.text[:500]}"
        )

    data = resp.json()
    logger.info(f"[doctors] Получено пользователей: {len(data)}")
    return data


async def collect_doctors(db: AsyncSession) -> dict:
    """
    Полная синхронизация врачей из МедОДС.
    Возвращает: {"created": N, "updated": N, "deleted": N, "total": N}
    """
    client = await login()
    stats = {"created": 0, "updated": 0, "deleted": 0, "total": 0}
    seen_ids: set[int] = set()

    try:
        users = await _fetch_all_users(client)

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
