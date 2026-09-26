"""
API детальных платежей (payment_details).

Эндпоинты:
  POST /api/payments/collect      — сбор за период
  GET  /api/payments/stats        — агрегат по способам оплаты + дельты
  GET  /api/payments/daily        — по дням
  GET  /api/payments/daily-by-type — по дням с разбивкой по способам оплаты
  GET  /api/payments/by-doctor    — по врачам
  GET  /api/payments/by-client    — топ клиентов по сумме платежей
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.payment_detail import PaymentDetail
from app.services.payment_detail_collector import collect_payment_details
from app.core.utils import prev_period, calc_delta

router = APIRouter()

KIND_LABELS = {6: "Обычный", 7: "Страховой", 2: "Возврат"}


def _base_filter(date_from: date, date_to: date, kind: int | None = None):
    f = and_(
        PaymentDetail.payment_date >= date_from,
        PaymentDetail.payment_date <= date_to,
    )
    if kind is not None:
        f = and_(f, PaymentDetail.kind == kind)
    return f


@router.post("/collect")
async def collect(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await collect_payment_details(db, date_from, date_to)
    return {"status": "ok", "date_from": date_from, "date_to": date_to, **result}


@router.get("/stats")
async def stats(
    date_from: date       = Query(...),
    date_to:   date       = Query(...),
    kind:      int | None = Query(default=None, description="6=обычный, 7=страховой, 2=возврат"),
    db: AsyncSession = Depends(get_db),
):
    prev_from, prev_to = prev_period(date_from, date_to)

    async def _totals(d_from: date, d_to: date) -> dict:
        row = (await db.execute(
            select(
                func.count(PaymentDetail.id).label("count"),
                func.sum(PaymentDetail.total_paid).label("total_paid"),
                func.sum(PaymentDetail.by_cash).label("by_cash"),
                func.sum(PaymentDetail.by_card).label("by_card"),
                func.sum(PaymentDetail.by_cashless).label("by_cashless"),
                func.sum(PaymentDetail.by_credit).label("by_credit"),
                func.sum(PaymentDetail.by_balance).label("by_balance"),
            ).where(_base_filter(d_from, d_to, kind))
        )).one()
        return {
            "count":       int(row.count or 0),
            "total_paid":  int(row.total_paid or 0),
            "by_cash":     int(row.by_cash or 0),
            "by_card":     int(row.by_card or 0),
            "by_cashless": int(row.by_cashless or 0),
            "by_credit":   int(row.by_credit or 0),
            "by_balance":  int(row.by_balance or 0),
        }

    curr = await _totals(date_from, date_to)
    prev = await _totals(prev_from, prev_to)

    delta_keys = ["count", "total_paid", "by_cash", "by_card", "by_cashless", "by_credit"]
    result = dict(curr)
    for key in delta_keys:
        d = calc_delta(curr[key], prev[key])
        result[f"{key}_delta_pct"] = d["delta_pct"]
        result[f"{key}_delta_dir"] = d["delta_dir"]

    return {
        "date_from": date_from, "date_to": date_to,
        "prev_from": prev_from, "prev_to": prev_to,
        "kind": kind, "kind_label": KIND_LABELS.get(kind, "Все") if kind else "Все",
        **result,
    }


@router.get("/daily")
async def daily(
    date_from: date       = Query(...),
    date_to:   date       = Query(...),
    kind:      int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(
            PaymentDetail.payment_date,
            func.count(PaymentDetail.id).label("count"),
            func.sum(PaymentDetail.total_paid).label("total_paid"),
            func.sum(PaymentDetail.by_cash).label("by_cash"),
            func.sum(PaymentDetail.by_card).label("by_card"),
            func.sum(PaymentDetail.by_cashless).label("by_cashless"),
            func.sum(PaymentDetail.by_credit).label("by_credit"),
        )
        .where(_base_filter(date_from, date_to, kind))
        .group_by(PaymentDetail.payment_date)
        .order_by(PaymentDetail.payment_date)
    )).all()

    # Заполняем дни без данных нулями
    by_date = {r.payment_date: r for r in rows}
    days = []
    current = date_from
    while current <= date_to:
        r = by_date.get(current)
        days.append({
            "date":        str(current),
            "count":       int(r.count or 0)       if r else 0,
            "total_paid":  int(r.total_paid or 0)  if r else 0,
            "by_cash":     int(r.by_cash or 0)     if r else 0,
            "by_card":     int(r.by_card or 0)     if r else 0,
            "by_cashless": int(r.by_cashless or 0) if r else 0,
            "by_credit":   int(r.by_credit or 0)   if r else 0,
        })
        current += timedelta(days=1)

    return {"date_from": date_from, "date_to": date_to, "days": days}


@router.get("/daily-by-type")
async def daily_by_type(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Подневная выручка с разбивкой по способам оплаты — для stacked-графика."""
    rows = (await db.execute(
        select(
            PaymentDetail.payment_date,
            func.sum(PaymentDetail.by_cash).label("by_cash"),
            func.sum(PaymentDetail.by_card).label("by_card"),
            func.sum(PaymentDetail.by_cashless).label("by_cashless"),
            func.sum(PaymentDetail.by_credit).label("by_credit"),
            func.sum(PaymentDetail.by_balance).label("by_balance"),
        )
        .where(_base_filter(date_from, date_to, kind=6))  # Только обычные
        .group_by(PaymentDetail.payment_date)
        .order_by(PaymentDetail.payment_date)
    )).all()

    by_date = {r.payment_date: r for r in rows}
    days_list = []
    current = date_from
    while current <= date_to:
        days_list.append(current)
        current += timedelta(days=1)

    TYPES = [
        ("by_cash",     "Наличными"),
        ("by_card",     "Картой"),
        ("by_cashless", "Безналичными"),
        ("by_credit",   "Кредитом"),
        ("by_balance",  "С лицевого счёта"),
    ]

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "days":      [str(d) for d in days_list],
        "series": [
            {
                "key":    key,
                "label":  label,
                "values": [int(getattr(by_date[d], key) or 0) if d in by_date else 0 for d in days_list],
            }
            for key, label in TYPES
        ],
    }


@router.get("/by-doctor")
async def by_doctor(
    date_from: date       = Query(...),
    date_to:   date       = Query(...),
    kind:      int | None = Query(default=6),
    limit:     int        = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Выручка по врачам за период."""
    rows = (await db.execute(
        select(
            PaymentDetail.doctor_id,
            PaymentDetail.doctor_name,
            PaymentDetail.doctor_surname,
            func.count(PaymentDetail.id).label("count"),
            func.sum(PaymentDetail.total_paid).label("total_paid"),
        )
        .where(_base_filter(date_from, date_to, kind))
        .where(PaymentDetail.doctor_id.isnot(None))
        .group_by(PaymentDetail.doctor_id, PaymentDetail.doctor_name, PaymentDetail.doctor_surname)
        .order_by(func.sum(PaymentDetail.total_paid).desc())
        .limit(limit)
    )).all()

    grand_total = sum(r.total_paid or 0 for r in rows)

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "kind":      kind,
        "doctors": [
            {
                "doctor_id":      r.doctor_id,
                "doctor_name":    r.doctor_name,
                "doctor_surname": r.doctor_surname,
                "count":          int(r.count or 0),
                "total_paid":     int(r.total_paid or 0),
                "pct":            round(int(r.total_paid or 0) / grand_total * 100, 1) if grand_total else 0,
            }
            for r in rows
        ],
    }


@router.get("/by-client")
async def by_client(
    date_from: date       = Query(...),
    date_to:   date       = Query(...),
    kind:      int | None = Query(default=6),
    limit:     int        = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Топ клиентов по сумме платежей за период."""
    rows = (await db.execute(
        select(
            PaymentDetail.client_id,
            PaymentDetail.client_name,
            PaymentDetail.client_surname,
            func.count(PaymentDetail.id).label("count"),
            func.sum(PaymentDetail.total_paid).label("total_paid"),
        )
        .where(_base_filter(date_from, date_to, kind))
        .where(PaymentDetail.client_id.isnot(None))
        .group_by(PaymentDetail.client_id, PaymentDetail.client_name, PaymentDetail.client_surname)
        .order_by(func.sum(PaymentDetail.total_paid).desc())
        .limit(limit)
    )).all()

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "kind":      kind,
        "clients": [
            {
                "client_id":      r.client_id,
                "client_name":    r.client_name,
                "client_surname": r.client_surname,
                "count":          int(r.count or 0),
                "total_paid":     int(r.total_paid or 0),
            }
            for r in rows
        ],
    }
