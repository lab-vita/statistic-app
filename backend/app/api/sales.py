"""
API продаж по номенклатуре.

Эндпоинты:
  POST /api/sales/collect          — запустить сбор за период
  POST /api/sales/match            — произвести матчинг с справочником услуг
  GET  /api/sales/stats            — топ услуг за период + дельты
  GET  /api/sales/daily            — разбивка по периодам
  GET  /api/sales/services         — список уникальных услуг в БД
  GET  /api/sales/unmatched        — названия которые не удалось привязать
"""
import logging
import re
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.sale import Sale
from app.models.service import Service
from app.services.sales_collector import collect_sales

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Матчинг
# ---------------------------------------------------------------------------

CYRILLIC_TO_LATIN = str.maketrans(
    "АВСЕКМНОРТХаеорсх",
    "ABCEKMHOPTXaeopcx",
)


def _normalize(s: str) -> str:
    s = s.strip().translate(CYRILLIC_TO_LATIN)
    s = re.sub(r"\s+", " ", s).lower()
    return s


async def _run_match(db: AsyncSession) -> dict:
    """
    Матчинг названий из sales со справочником services.
    Три прохода:
      1. Точное совпадение по title
      2. Нормализованное совпадение (опечатки, лат./кир. буквы)
      3. Не найдено — проставляем exclude_from_analytics=True
    """
    # Загружаем весь справочник
    svc_rows = await db.execute(select(Service))
    all_services = svc_rows.scalars().all()

    svc_exact = {s.title.strip(): s for s in all_services}
    svc_norm  = {}
    for s in all_services:
        n = _normalize(s.title)
        if n not in svc_norm:
            svc_norm[n] = s

    # Все строки sales
    sale_rows = await db.execute(select(Sale))
    sales = sale_rows.scalars().all()

    stats = {"exact": 0, "normalized": 0, "unmatched": 0, "total": len(sales)}

    for sale in sales:
        title = sale.service_title.strip()

        # Проход 1: точно
        if title in svc_exact:
            svc = svc_exact[title]
            sale.service_id = svc.id
            sale.exclude_from_analytics = svc.exclude_from_analytics
            stats["exact"] += 1
            continue

        # Проход 2: нормализованно
        norm = _normalize(title)
        if norm in svc_norm:
            svc = svc_norm[norm]
            sale.service_id = svc.id
            sale.exclude_from_analytics = svc.exclude_from_analytics
            stats["normalized"] += 1
            continue

        # Проход 3: не найдено
        sale.service_id = None
        sale.exclude_from_analytics = True  # исключаем из аналитики
        stats["unmatched"] += 1

    await db.commit()
    return stats


# ---------------------------------------------------------------------------
# Вспомогательные функции
# ---------------------------------------------------------------------------

def _prev_period(date_from: date, date_to: date) -> tuple[date, date]:
    delta = (date_to - date_from).days + 1
    prev_to   = date_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=delta - 1)
    return prev_from, prev_to


def _delta(current: float, previous: float) -> dict:
    if previous == 0:
        return {"pct": None, "dir": "flat"}
    pct = round((current - previous) / previous * 100)
    return {"pct": abs(pct), "dir": "up" if pct > 0 else ("down" if pct < 0 else "flat")}


# ---------------------------------------------------------------------------
# Эндпоинты
# ---------------------------------------------------------------------------

@router.post("/collect")
async def collect(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    if date_from > date_to:
        raise HTTPException(400, "date_from должна быть <= date_to")
    if (date_to - date_from).days > 31:
        raise HTTPException(400, "Период не может превышать 31 день")
    stats = await collect_sales(db, date_from, date_to)
    return {"status": "ok", "date_from": str(date_from), "date_to": str(date_to), **stats}


@router.post("/match")
async def match_services(db: AsyncSession = Depends(get_db)):
    """Матчинг названий из sales со справочником services."""
    stats = await _run_match(db)
    return {"status": "ok", **stats}


@router.get("/unmatched")
async def unmatched(db: AsyncSession = Depends(get_db)):
    """Названия которые не удалось сопоставить со справочником."""
    rows = await db.execute(
        select(Sale.service_title, func.sum(Sale.final_sum).label("total"))
        .where(Sale.service_id == None)
        .group_by(Sale.service_title)
        .order_by(func.sum(Sale.final_sum).desc())
    )
    return {"unmatched": [{"title": r.service_title, "total_sum": r.total} for r in rows]}


@router.get("/stats")
async def stats(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    limit: int = Query(20, ge=1, le=200),
    include_excluded: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    prev_from, prev_to = _prev_period(date_from, date_to)

    def base_filter(d_from, d_to):
        f = and_(Sale.sale_date >= d_from, Sale.sale_date <= d_to)
        if not include_excluded:
            f = and_(f, Sale.exclude_from_analytics == False)
        return f

    rows = await db.execute(
        select(
            Sale.service_title,
            Sale.service_id,
            Sale.unit,
            func.sum(Sale.amount).label("amount"),
            func.sum(Sale.final_sum).label("final_sum"),
            func.sum(Sale.total_sum).label("total_sum"),
        )
        .where(base_filter(date_from, date_to))
        .group_by(Sale.service_title, Sale.service_id, Sale.unit)
        .order_by(func.sum(Sale.final_sum).desc())
        .limit(limit)
    )
    current = {r.service_title: r for r in rows}

    prev_rows = await db.execute(
        select(
            Sale.service_title,
            func.sum(Sale.final_sum).label("final_sum"),
        )
        .where(base_filter(prev_from, prev_to))
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
            "service_id":    cur.service_id,
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
    include_excluded: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    f = and_(Sale.sale_date >= date_from, Sale.sale_date <= date_to)
    if not include_excluded:
        f = and_(f, Sale.exclude_from_analytics == False)

    rows = await db.execute(
        select(
            Sale.sale_date,
            func.sum(Sale.amount).label("amount"),
            func.sum(Sale.final_sum).label("final_sum"),
            func.count(Sale.id).label("services_count"),
        )
        .where(f)
        .group_by(Sale.sale_date)
        .order_by(Sale.sale_date)
    )
    periods = [
        {
            "sale_date":      str(r.sale_date),
            "amount":         int(r.amount or 0),
            "final_sum":      float(r.final_sum or 0),
            "services_count": int(r.services_count or 0),
        }
        for r in rows
    ]
    return {"date_from": str(date_from), "date_to": str(date_to), "periods": periods}


@router.get("/services")
async def services(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(Sale.service_title, Sale.service_id, Sale.unit, Sale.exclude_from_analytics)
        .distinct()
        .order_by(Sale.service_title)
    )
    return {"services": [
        {
            "title":    r.service_title,
            "id":       r.service_id,
            "unit":     r.unit,
            "excluded": r.exclude_from_analytics,
        }
        for r in rows
    ]}
