"""API эндпоинты для данных о выручке по типам оплат."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.payment import Payment
from app.services.payments_collector import collect_payments

router = APIRouter()


@router.post("/collect")
async def collect(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Запустить сбор выручки за период (итерация по дням)."""
    if date_from > date_to:
        raise HTTPException(400, "date_from не может быть позже date_to")
    count = await collect_payments(db, date_from, date_to)
    return {"collected": count, "date_from": date_from, "date_to": date_to}


@router.get("/stats")
async def stats(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Суммарная выручка по типам оплат за период.

    Ответ:
    {
        "date_from": "2026-09-01",
        "date_to":   "2026-09-17",
        "total_sum":    2377006.0,
        "total_amount": 875,
        "by_type": [
            {"payment_type": "Картой",    "amount": 614, "sum": 1709943.0, "percent": 71.94},
            {"payment_type": "Наличными", "amount": 228, "sum": 623143.0,  "percent": 26.22},
            {"payment_type": "Кредитом",  "amount": 33,  "sum": 43920.0,   "percent": 1.85},
        ]
    }
    """
    rows = (
        await db.execute(
            select(
                Payment.payment_type,
                func.sum(Payment.amount).label("amount"),
                func.sum(Payment.total_sum).label("total_sum"),
            )
            .where(and_(Payment.payment_date >= date_from, Payment.payment_date <= date_to))
            .group_by(Payment.payment_type)
            .order_by(func.sum(Payment.total_sum).desc())
        )
    ).all()

    grand_sum    = sum(r.total_sum for r in rows)
    grand_amount = sum(r.amount    for r in rows)

    return {
        "date_from":    date_from,
        "date_to":      date_to,
        "total_sum":    round(grand_sum, 2),
        "total_amount": grand_amount,
        "by_type": [
            {
                "payment_type": r.payment_type,
                "amount":       r.amount,
                "sum":          round(r.total_sum, 2),
                "percent":      round(r.total_sum / grand_sum * 100, 2) if grand_sum else 0.0,
            }
            for r in rows
        ],
    }


@router.get("/daily")
async def daily(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Выручка по дням (все типы оплат суммированы).

    Ответ:
    {
        "days": [
            {"date": "2026-09-01", "sum": 89430.0, "amount": 31},
            ...
        ]
    }
    """
    rows = (
        await db.execute(
            select(
                Payment.payment_date,
                func.sum(Payment.amount).label("amount"),
                func.sum(Payment.total_sum).label("total_sum"),
            )
            .where(and_(Payment.payment_date >= date_from, Payment.payment_date <= date_to))
            .group_by(Payment.payment_date)
            .order_by(Payment.payment_date)
        )
    ).all()

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "days": [
            {"date": str(r.payment_date), "sum": round(r.total_sum, 2), "amount": r.amount}
            for r in rows
        ],
    }


@router.get("/daily-by-type")
async def daily_by_type(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Выручка по дням с разбивкой по типам оплат — для stacked-графика.

    Ответ:
    {
        "days": ["2026-09-01", "2026-09-02", ...],
        "series": [
            {"payment_type": "Картой",    "values": [54000.0, 61000.0, ...]},
            {"payment_type": "Наличными", "values": [12000.0, 15000.0, ...]},
            {"payment_type": "Кредитом",  "values": [3500.0,  0.0,     ...]},
        ]
    }
    """
    rows = (
        await db.execute(
            select(
                Payment.payment_date,
                Payment.payment_type,
                func.sum(Payment.total_sum).label("total_sum"),
            )
            .where(and_(Payment.payment_date >= date_from, Payment.payment_date <= date_to))
            .group_by(Payment.payment_date, Payment.payment_type)
            .order_by(Payment.payment_date, Payment.payment_type)
        )
    ).all()

    # Все дни в диапазоне (включая дни без данных)
    days_list: list[date] = []
    d = date_from
    while d <= date_to:
        days_list.append(d)
        d += timedelta(days=1)

    # Уникальные типы оплат в порядке первого появления
    types_list: list[str] = []
    seen: set[str] = set()
    for r in rows:
        if r.payment_type not in seen:
            types_list.append(r.payment_type)
            seen.add(r.payment_type)

    # Быстрый поиск по (дата, тип)
    index: dict[tuple, float] = {
        (r.payment_date, r.payment_type): round(r.total_sum, 2)
        for r in rows
    }

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "days":      [str(d) for d in days_list],
        "series": [
            {
                "payment_type": pt,
                "values": [index.get((d, pt), 0.0) for d in days_list],
            }
            for pt in types_list
        ],
    }
