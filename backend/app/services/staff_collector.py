"""
Коллектор сотрудников из МедОДС.

Алгоритм:
  1. Авторизуемся через login()
  2. GET /users?page=N — собираем все id со всех страниц пагинации
  3. GET /users/{id}/edit — берём gon.specific.user для каждого
  4. Фильтруем: только user_status_id=1 (активные) и clinic_id=1
  5. Определяем role по специальности и has_appointment
  6. Upsert в таблицу staff, помечаем отсутствующих как уволенных

Запускается вручную:
  POST /api/staff/sync
"""
import re
import json
import logging
from datetime import datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.staff import Staff
from app.services.medods import login

logger = logging.getLogger(__name__)


def _resolve_role(user: dict) -> str:
    """
    Определяет роль сотрудника по данным из МедОДС.

    Приоритет:
      callcenter  — id в LABVITA_OPERATORS
      management  — специальность Директор / Заместитель директора
      tech        — специальность Разработчик / Бухгалтер
      doctor      — has_appointment=True (даже если есть роль Администратора)
      admin       — всё остальное (регистратура, колл-центр без Битрикса)
    """
    uid = str(user.get("id", ""))
    specialties = user.get("specialties_titles", "") or ""

    if uid in settings.LABVITA_OPERATORS:
        return "callcenter"

    if any(s in specialties for s in ("Директор", "Заместитель директора")):
        return "management"

    if any(s in specialties for s in ("Разработчик", "Бухгалтер")):
        return "tech"

    if user.get("has_appointment"):
        return "doctor"

    return "admin"


async def _get_all_user_ids(client: httpx.AsyncClient) -> list[int]:
    """Собирает все id сотрудников со всех страниц пагинации /users."""
    ids: list[int] = []
    page = 1

    while True:
        resp = await client.get(
            f"{settings.MEDODS_URL}/users",
            params={"page": page},
            headers={"Accept": "text/html,application/xhtml+xml,*/*"},
        )
        found = re.findall(r'data-href="/users/(\d+)/edit"', resp.text)
        if not found:
            break

        ids.extend(int(i) for i in found)
        logger.debug(f"[staff] Страница {page}: +{len(found)} id")

        if f'href="/users?page={page + 1}"' not in resp.text:
            break

        page += 1

    logger.info(f"[staff] Всего id на страницах: {len(ids)}")
    return ids


async def _get_user_data(client: httpx.AsyncClient, user_id: int) -> dict | None:
    """Получает полные данные сотрудника из gon.specific.user."""
    resp = await client.get(
        f"{settings.MEDODS_URL}/users/{user_id}/edit",
        headers={"Accept": "text/html,application/xhtml+xml,*/*"},
    )

    m = re.search(r'gon\.specific\s*=\s*(\{.*?\});\s*//\]\]>', resp.text, re.DOTALL)
    if not m:
        logger.warning(f"[staff] Не удалось распарсить gon.specific для id={user_id}")
        return None

    try:
        data = json.loads(m.group(1))
        return data.get("user")
    except Exception as e:
        logger.warning(f"[staff] JSON ошибка для id={user_id}: {e}")
        return None


async def collect_staff(db: AsyncSession) -> dict:
    """
    Полная синхронизация сотрудников из МедОДС.
    Возвращает: {"created": N, "updated": N, "deactivated": N, "total": N}
    """
    client = await login()
    stats = {"created": 0, "updated": 0, "deactivated": 0, "total": 0}
    seen_ids: set[int] = set()

    try:
        all_ids = await _get_all_user_ids(client)
        now = datetime.utcnow()

        for user_id in all_ids:
            user = await _get_user_data(client, user_id)
            if not user:
                continue

            # Фильтр: только активные сотрудники клиники №1
            if user.get("user_status_id") != 1:
                continue
            if settings.MEDODS_CLINIC_ID not in (user.get("clinic_ids") or []):
                continue

            seen_ids.add(user_id)
            role = _resolve_role(user)

            vals = dict(
                username=user.get("username"),
                surname=user.get("surname"),
                name=user.get("name"),
                second_name=user.get("second_name"),
                full_name=user.get("full_name"),
                short_name=user.get("short_name"),
                phone=user.get("phone") or None,
                email=user.get("email") or None,
                user_status_id=user.get("user_status_id", 1),
                status_title=user.get("status_title"),
                deleted_at=user.get("deleted_at"),
                sex=user.get("sex"),
                birthdate=user.get("birthdate"),
                has_appointment=user.get("has_appointment", False),
                availability_for_online_recording=user.get("availability_for_online_recording"),
                appointment_duration_id=user.get("appointment_duration_id"),
                specialty_ids=user.get("specialty_ids"),
                specialties_titles=user.get("specialties_titles"),
                clinic_ids=user.get("clinic_ids"),
                referral_id=user.get("referral_id"),
                role=role,
                synced_at=now,
            )

            existing = await db.get(Staff, user_id)
            if existing:
                for k, v in vals.items():
                    setattr(existing, k, v)
                stats["updated"] += 1
            else:
                db.add(Staff(id=user_id, **vals))
                stats["created"] += 1

        # Деактивируем тех, кого нет в текущей выборке
        result = await db.execute(
            select(Staff).where(Staff.user_status_id == 1)
        )
        active_in_db = result.scalars().all()
        for s in active_in_db:
            if s.id not in seen_ids:
                s.user_status_id = 2
                s.status_title = "Уволен"
                s.synced_at = now
                stats["deactivated"] += 1

        await db.commit()
        stats["total"] = len(seen_ids)
        logger.info(
            f"[staff] Готово: создано {stats['created']}, "
            f"обновлено {stats['updated']}, деактивировано {stats['deactivated']}"
        )

    finally:
        await client.aclose()

    return stats
