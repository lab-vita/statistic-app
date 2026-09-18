"""
API выручки.

Эндпоинты:
  POST /api/revenue/collect       — запустить сбор за диапазон
  GET  /api/revenue/stats         — агрегат за период (по типам оплат + дельты)
  GET  /api/revenue/daily         — разбивка по дням
  GET  /api/revenue/payment_types — список известных типов оплат
"""
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.revenue import Revenue
from app.services.revenue_collector import collect_revenue

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


async def _total_by_period(db: AsyncSession, date_from: date, date_to: date) -> dict:
    rows = await db.execute(
        select(
            Revenue.payment_type,
            func.sum(Revenue.total).label("total"),
            func.sum(Revenue.amount).label("amount"),
        )
        .where(and_(Revenue.revenue_date >= date_from, Revenue.revenue_date <= date_to))
        .group_by(Revenue.payment_type)
        .order_by(func.sum(Revenue.total).desc())
    )
    return {
        r.payment_type: {"total": float(r.total or 0), "amount": int(r.amount or 0)}
        for r in rows
    }


@router.post("/collect")
async def collect(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    if date_from > date_to:
        raise HTTPException(400, "date_from должна быть <= date_to")
    if (date_to - date_from).days > 366:
        raise HTTPException(400, "Период не может превышать 366 дней")
    results = await collect_revenue(db, date_from, date_to)
    return {
        "status": "ok", "date_from": str(date_from), "date_to": str(date_to),
        "days": len(results), "total_types": sum(results.values()), "by_day": results,
    }


@router.get("/stats")
async def stats(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    prev_from, prev_to = _prev_period(date_from, date_to)
    current_by_type  = await _total_by_period(db, date_from, date_to)
    previous_by_type = await _total_by_period(db, prev_from, prev_to)
    grand_total      = sum(v["total"]  for v in current_by_type.values())
    grand_amount     = sum(v["amount"] for v in current_by_type.values())
    prev_grand_total = sum(v["total"]  for v in previous_by_type.values())
    payment_types = []
    for ptype, cur in current_by_type.items():
        prev = previous_by_type.get(ptype, {"total": 0, "amount": 0})
        pct_of_total = round(cur["total"] / grand_total * 100, 2) if grand_total else 0
        d = _delta(cur["total"], prev["total"])
        payment_types.append({
            "payment_type": ptype, "total": cur["total"], "amount": cur["amount"],
            "pct_of_total": pct_of_total, "delta_pct": d["pct"], "delta_dir": d["dir"],
        })
    total_delta = _delta(grand_total, prev_grand_total)
    return {
        "date_from": str(date_from), "date_to": str(date_to),
        "prev_from": str(prev_from), "prev_to": str(prev_to),
        "total": {"sum": grand_total, "amount": grand_amount,
                  "delta_pct": total_delta["pct"], "delta_dir": total_delta["dir"]},
        "by_payment_type": payment_types,
    }


@router.get("/daily")
async def daily(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(Revenue.revenue_date, Revenue.payment_type, Revenue.total, Revenue.amount)
        .where(and_(Revenue.revenue_date >= date_from, Revenue.revenue_date <= date_to))
        .order_by(Revenue.revenue_date, Revenue.payment_type)
    )
    days: dict[str, dict] = {}
    for r in rows.all():
        d = str(r.revenue_date)
        if d not in days:
            days[d] = {"date": d, "total": 0.0, "amount": 0, "by_type": {}}
        days[d]["total"]  += float(r.total or 0)
        days[d]["amount"] += int(r.amount or 0)
        days[d]["by_type"][r.payment_type] = {"total": float(r.total or 0), "amount": int(r.amount or 0)}
    return {"date_from": str(date_from), "date_to": str(date_to), "days": list(days.values())}


@router.get("/payment_types")
async def payment_types(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(Revenue.payment_type).distinct().order_by(Revenue.payment_type))
    return {"payment_types": [r[0] for r in rows]}
