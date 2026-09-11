from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import date
from calendar import monthrange
from pydantic import BaseModel
from app.db.database import get_db
from app.models.plan import Plan

router = APIRouter()

# Фиксированный порог — не редактируется подневно
FIXED_THRESHOLDS = {
    "calls_missed_pct": 6.0,
}

METRICS = ["calls_incoming", "calls_outgoing", "appt_count"]


class PlanItem(BaseModel):
    date:   date
    metric: str
    value:  float


class BulkUpsert(BaseModel):
    items: list[PlanItem]


class BulkFill(BaseModel):
    """Заполнить диапазон дат одним значением для одной метрики."""
    date_from: date
    date_to:   date
    metric:    str
    value:     float
    skip_weekends: bool = True


@router.get("/month")
async def get_month(year: int, month: int, db: AsyncSession = Depends(get_db)):
    """Планы за месяц — по дням."""
    _, days_in_month = monthrange(year, month)
    date_from = date(year, month, 1)
    date_to   = date(year, month, days_in_month)

    rows = await db.execute(
        select(Plan).where(and_(Plan.date >= date_from, Plan.date <= date_to))
    )
    plans = {(p.date, p.metric): p.value for p in rows.scalars()}

    days = []
    for day in range(1, days_in_month + 1):
        d = date(year, month, day)
        weekday = d.weekday()  # 0=Пн, 6=Вс
        days.append({
            "date":           d.isoformat(),
            "weekday":        weekday,
            "is_weekend":     weekday >= 5,
            "calls_incoming": plans.get((d, "calls_incoming"), 0),
            "calls_outgoing": plans.get((d, "calls_outgoing"), 0),
            "appt_count":     plans.get((d, "appt_count"),     0),
        })

    # Итого за месяц
    totals = {
        m: sum(row[m] for row in days)
        for m in METRICS
    }

    return {
        "year":   year,
        "month":  month,
        "days":   days,
        "totals": totals,
        "fixed":  FIXED_THRESHOLDS,
    }


@router.get("/range")
async def get_range(date_from: date, date_to: date, db: AsyncSession = Depends(get_db)):
    """Планы за произвольный период — для сравнения факт/план в карточках."""
    rows = await db.execute(
        select(Plan).where(and_(Plan.date >= date_from, Plan.date <= date_to))
    )
    plans = rows.scalars().all()

    by_day: dict = {}
    for p in plans:
        d = p.date.isoformat()
        if d not in by_day:
            by_day[d] = {}
        by_day[d][p.metric] = p.value

    totals = {m: 0.0 for m in METRICS}
    for day_data in by_day.values():
        for metric, val in day_data.items():
            if metric in totals:
                totals[metric] += val

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "by_day":    by_day,
        "totals":    totals,
        "fixed":     FIXED_THRESHOLDS,
    }


@router.post("/upsert")
async def upsert(body: BulkUpsert, db: AsyncSession = Depends(get_db)):
    """Сохранить/обновить планы (bulk)."""
    for item in body.items:
        existing = await db.get(Plan, (item.date, item.metric))
        if existing:
            existing.value = item.value
        else:
            db.add(Plan(date=item.date, metric=item.metric, value=item.value))
    await db.commit()
    return {"status": "ok", "saved": len(body.items)}


@router.post("/fill")
async def fill(body: BulkFill, db: AsyncSession = Depends(get_db)):
    """Заполнить диапазон дат одним значением — для быстрого ввода плана."""
    from datetime import timedelta
    current = body.date_from
    saved = 0
    while current <= body.date_to:
        if body.skip_weekends and current.weekday() >= 5:
            current += timedelta(days=1)
            continue
        existing = await db.get(Plan, (current, body.metric))
        if existing:
            existing.value = body.value
        else:
            db.add(Plan(date=current, metric=body.metric, value=body.value))
        saved += 1
        current += timedelta(days=1)
    await db.commit()
    return {"status": "ok", "saved": saved}
