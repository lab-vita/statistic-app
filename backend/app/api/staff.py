"""
API сотрудников.

Эндпоинты:
  POST /api/staff/sync          — синхронизировать сотрудников с МедОДС
  GET  /api/staff               — список сотрудников (с фильтрами)
  GET  /api/staff/{id}          — один сотрудник
"""
import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.staff import Staff
from app.services.staff_collector import collect_staff

logger = logging.getLogger(__name__)
router = APIRouter()


def _staff_dict(s: Staff) -> dict:
    return {
        "id":                                s.id,
        "username":                          s.username,
        "surname":                           s.surname,
        "name":                              s.name,
        "second_name":                       s.second_name,
        "full_name":                         s.full_name,
        "short_name":                        s.short_name,
        "phone":                             s.phone,
        "email":                             s.email,
        "user_status_id":                    s.user_status_id,
        "status_title":                      s.status_title,
        "sex":                               s.sex,
        "birthdate":                         str(s.birthdate) if s.birthdate else None,
        "has_appointment":                   s.has_appointment,
        "availability_for_online_recording": s.availability_for_online_recording,
        "appointment_duration_id":           s.appointment_duration_id,
        "specialty_ids":                     s.specialty_ids,
        "specialties_titles":                s.specialties_titles,
        "clinic_ids":                        s.clinic_ids,
        "role":                              s.role,
        "referral_id":                       s.referral_id,
        "synced_at":                         str(s.synced_at),
    }


@router.post("/sync")
async def sync(db: AsyncSession = Depends(get_db)):
    """Синхронизировать список сотрудников с МедОДС."""
    stats = await collect_staff(db)
    return {"status": "ok", **stats}


@router.get("")
async def staff_list(
    search:   str | None = Query(None, description="Поиск по фамилии"),
    role:     str | None = Query(None, description="Фильтр по роли: doctor, admin, callcenter, management, tech"),
    db: AsyncSession = Depends(get_db),
):
    q = select(Staff).where(Staff.user_status_id == 1)
    if search:
        q = q.where(Staff.surname.ilike(f"%{search}%"))
    if role:
        q = q.where(Staff.role == role)
    q = q.order_by(Staff.surname, Staff.name)

    rows = await db.execute(q)
    items = rows.scalars().all()
    return {"staff": [_staff_dict(s) for s in items], "total": len(items)}


@router.get("/{staff_id}")
async def staff_detail(
    staff_id: int,
    db: AsyncSession = Depends(get_db),
):
    s = await db.get(Staff, staff_id)
    if not s:
        raise HTTPException(404, f"Сотрудник {staff_id} не найден")
    return _staff_dict(s)
