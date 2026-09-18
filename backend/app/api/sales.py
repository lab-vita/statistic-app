"""
API продаж по номенклатуре.

Эндпоинты:
  POST /api/sales/collect          — запустить сбор за период
  GET  /api/sales/stats            — топ услуг за период + дельты
  GET  /api/sales/daily            — разбивка по периодам (месяц/неделя)
  GET  /api/sales/services         — список известных услуг
"""
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.sale import Sale
from app.services.sales_collector import collect_sales

logger = logging.getLogger(__name__)
router = APIRouter()


def _prev_period(date_from: date, date_to: date) -> tuple[date, date]:
    delta = (date_to - date_from).days + 1
    prev_to   = date_from - timedelta(days=1)
    prev_from = prev_to   - timedelta(days=delta - 1)
    return prev_from, prev_to


def _delta(current: float, previous: float) -> dict:
    if previous == 0:
        return {"pct": None, "dir": "flat"}
    pct = round((current - previous) / previous * 100)
    return {"pct": abs(pct), "dir": "up" if pct > 0 else ("down" if pct < 0 else "flat")}


@router.post("/collect")
async def collect(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    if date_from > date_to:
        raise HTTPException(400, "date_from должна быть <= date_to")
    if (date_to - date_from).days > 31:
        raise HTTPException(400, "Период не может превышать 31 день (данные агрегируются за период)")
    stats = await collect_sales(db, date_from, date_to)
    return {"status": "ok", "date_from": str(date_from), "date_to": str(date_to), **stats}


@router.get("/stats")
async def stats(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    limit: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    prev_from, prev_to = _prev_period(date_from, date_to)

    # Текущий период
    rows = await db.execute(
        select(
            Sale.service_title,
            Sale.unit,
            func.sum(Sale.amount).label("amount"),
            func.sum(Sale.final_sum).label("final_sum"),
            func.sum(Sale.total_sum).label("total_sum"),
        )
        .where(and_(Sale.sale_date >= date_from, Sale.sale_date <= date_to))
        .group_by(Sale.service_title, Sale.unit)
        .order_by(func.sum(Sale.final_sum).desc())
        .limit(limit)
    )
    current = {r.service_title: r for r in rows}

    # Предыдущий период
    prev_rows = await db.execute(
        select(
            Sale.service_title,
            func.sum(Sale.final_sum).label("final_sum"),
            func.sum(Sale.amount).label("amount"),
        )
        .where(and_(Sale.sale_date >= prev_from, Sale.sale_date <= prev_to))
        .group_by(Sale.service_title)
    )
    previous = {r.service_title: r for r in prev_rows}

    grand_total      = sum(float(r.final_sum or 0) for r in current.values())
    prev_grand_total = sum(float(r.final_sum or 0) for r in previous.values())
    total_delta      = _delta(grand_total, prev_grand_total)

    services = []
    for title, cur in current.items():
        prev = previous.get(title)
        cur_sum  = float(cur.final_sum or 0)
        prev_sum = float(prev.final_sum or 0) if prev else 0
        d = _delta(cur_sum, prev_sum)
        services.append({
            "service_title": title,
            "unit":          cur.unit,
            "amount":        int(cur.amount or 0),
            "final_sum":     cur_sum,
            "total_sum":     float(cur.total_sum or 0),
            "pct_of_total":  round(cur_sum / grand_total * 100, 2) if grand_total else 0,
            "delta_pct":     d["pct"],
            "delta_dir":     d["dir"],
        })

    return {
        "date_from": str(date_from), "date_to": str(date_to),
        "prev_from": str(prev_from), "prev_to":  str(prev_to),
        "total": {
            "final_sum":  grand_total,
            "delta_pct":  total_delta["pct"],
            "delta_dir":  total_delta["dir"],
        },
        "services": services,
    }


@router.get("/daily")
async def daily(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Агрегат по периодам (каждая запись = один запрос к МедОДС = один sale_date)."""
    rows = await db.execute(
        select(
            Sale.sale_date,
            func.sum(Sale.amount).label("amount"),
            func.sum(Sale.final_sum).label("final_sum"),
            func.count(Sale.id).label("services_count"),
        )
        .where(and_(Sale.sale_date >= date_from, Sale.sale_date <= date_to))
        .group_by(Sale.sale_date)
        .order_by(Sale.sale_date)
    )
    periods = [
        {
            "sale_date":     str(r.sale_date),
            "amount":        int(r.amount or 0),
            "final_sum":     float(r.final_sum or 0),
            "services_count": int(r.services_count or 0),
        }
        for r in rows
    ]
    return {"date_from": str(date_from), "date_to": str(date_to), "periods": periods}


@router.get("/services")
async def services(db: AsyncSession = Depends(get_db)):
    """Список всех уникальных услуг в БД."""
    rows = await db.execute(
        select(Sale.service_title, Sale.unit)
        .distinct()
        .order_by(Sale.service_title)
    )
    return {"services": [{"title": r.service_title, "unit": r.unit} for r in rows]}
