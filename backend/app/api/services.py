"""
API справочника услуг.

Эндпоинты:
  POST /api/services/sync          — синхронизировать справочник с МедОДС
  GET  /api/services               — список всех услуг (с фильтрами)
  GET  /api/services/categories    — список категорий
  GET  /api/services/{id}          — одна услуга
"""
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.service import Service, ServiceCategory
from app.services.service_collector import collect_services

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/sync")
async def sync(db: AsyncSession = Depends(get_db)):
    """Синхронизировать справочник услуг с МедОДС."""
    stats = await collect_services(db)
    return {"status": "ok", **stats}


@router.get("/categories")
async def categories(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(ServiceCategory)
        .where(ServiceCategory.deleted == False)
        .order_by(ServiceCategory.title)
    )
    cats = rows.scalars().all()
    return {"categories": [
        {"id": c.id, "title": c.title, "parent_id": c.parent_id}
        for c in cats
    ]}


@router.get("")
async def services(
    category_id: int | None = Query(None),
    search:      str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(Service).where(Service.deleted == False)
    if category_id:
        q = q.where(Service.category_id == category_id)
    if search:
        q = q.where(Service.title.ilike(f"%{search}%"))
    q = q.order_by(Service.title)
    rows = await db.execute(q)
    items = rows.scalars().all()
    return {"services": [
        {
            "id":          s.id,
            "title":       s.title,
            "category_id": s.category_id,
            "price":       s.price,
            "kind":        s.kind,
            "unit":        s.unit,
        }
        for s in items
    ]}


@router.get("/{service_id}")
async def service(
    service_id: int,
    db: AsyncSession = Depends(get_db),
):
    s = await db.get(Service, service_id)
    if not s:
        from fastapi import HTTPException
        raise HTTPException(404, f"Услуга {service_id} не найдена")
    return {
        "id":          s.id,
        "title":       s.title,
        "category_id": s.category_id,
        "price":       s.price,
        "cost_price":  s.cost_price,
        "kind":        s.kind,
        "unit":        s.unit,
        "synced_at":   str(s.synced_at),
    }
