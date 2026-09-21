"""
API врачей.

Эндпоинты:
  POST /api/doctors/sync   — синхронизировать список врачей с МедОДС
  GET  /api/doctors        — список врачей (с фильтрами)
  GET  /api/doctors/{id}   — один врач
"""
import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.doctor import Doctor
from app.services.doctor_collector import collect_doctors

logger = logging.getLogger(__name__)
router = APIRouter()


def _doctor_dict(d: Doctor) -> dict:
    return {
        "id":         d.id,
        "surname":    d.surname,
        "name":       d.name,
        "second_name": d.second_name,
        "full_name":  d.full_name,
        "short_name": d.short_name,
        "specialty":  d.specialty,
        "deleted":    d.deleted,
        "synced_at":  str(d.synced_at),
    }


@router.post("/sync")
async def sync(db: AsyncSession = Depends(get_db)):
    """Синхронизировать список врачей с МедОДС."""
    stats = await collect_doctors(db)
    return {"status": "ok", **stats}


@router.get("")
async def doctors_list(
    search:          str | None  = Query(None, description="Поиск по фамилии"),
    specialty:       str | None  = Query(None, description="Фильтр по специальности"),
    include_deleted: bool        = Query(False, description="Включать удалённых"),
    db: AsyncSession = Depends(get_db),
):
    q = select(Doctor)
    if not include_deleted:
        q = q.where(Doctor.deleted == False)
    if search:
        q = q.where(Doctor.surname.ilike(f"%{search}%"))
    if specialty:
        q = q.where(Doctor.specialty.ilike(f"%{specialty}%"))
    q = q.order_by(Doctor.surname, Doctor.name)

    rows = await db.execute(q)
    items = rows.scalars().all()
    return {"doctors": [_doctor_dict(d) for d in items], "total": len(items)}


@router.get("/{doctor_id}")
async def doctor_detail(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
):
    d = await db.get(Doctor, doctor_id)
    if not d:
        raise HTTPException(404, f"Врач {doctor_id} не найден")
    return _doctor_dict(d)
