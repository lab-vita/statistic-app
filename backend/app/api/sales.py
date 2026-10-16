"""
API продаж по номенклатуре.

Эндпоинты:
  POST /api/sales/collect   — запустить сбор за период
  POST /api/sales/match     — матчинг с справочником услуг
  GET  /api/sales/stats     — топ услуг за период + дельты
  GET  /api/sales/daily     — разбивка по дням
  GET  /api/sales/by-category — выручка по направлениям и топ услуг в динамике
  GET  /api/sales/services  — список уникальных услуг в БД
  GET  /api/sales/unmatched — непривязанные названия
"""
import logging
import re
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.sale import Sale
from app.models.service import Service, ServiceCategory
from app.services.sales_collector import collect_sales
from app.core.utils import prev_period, calc_delta
from app.core.auth import CurrentUser, require_any
from app.services import exchange_log

logger = logging.getLogger(__name__)
router = APIRouter()


# ──────────────────────────────────────────────────────────────────────
# Матчинг
# ──────────────────────────────────────────────────────────────────────

CYRILLIC_TO_LATIN = str.maketrans(
    "АВСЕКМНОРТХаеорсх",
    "ABCEKMHOPTXaeopcx",
)


def _normalize(s: str) -> str:
    s = s.strip().translate(CYRILLIC_TO_LATIN)
    return re.sub(r"\s+", " ", s).lower()


async def _run_match(db: AsyncSession) -> dict:
    """
    Матчинг названий из sales со справочником services.
    Три прохода:
      1. Точное совпадение по title
      2. Нормализованное совпадение (опечатки, лат./кир. буквы)
      3. Не найдено — exclude_from_analytics=True
    """
    svc_rows = await db.execute(select(Service))
    all_services = svc_rows.scalars().all()

    svc_exact: dict[str, Service] = {s.title.strip(): s for s in all_services}
    svc_norm:  dict[str, Service] = {}
    for s in all_services:
        n = _normalize(s.title)
        if n not in svc_norm:
            svc_norm[n] = s

    sale_rows = await db.execute(select(Sale))
    sales = sale_rows.scalars().all()
    stats = {"exact": 0, "normalized": 0, "unmatched": 0, "total": len(sales)}

    for sale in sales:
        title = sale.service_title.strip()
        if title in svc_exact:
            svc = svc_exact[title]
            sale.service_id              = svc.id
            sale.exclude_from_analytics  = svc.exclude_from_analytics
            stats["exact"] += 1
        elif (norm := _normalize(title)) in svc_norm:
            svc = svc_norm[norm]
            sale.service_id              = svc.id
            sale.exclude_from_analytics  = svc.exclude_from_analytics
            stats["normalized"] += 1
        else:
            sale.service_id              = None
            sale.exclude_from_analytics  = True
            stats["unmatched"] += 1

    await db.commit()
    return stats


# ──────────────────────────────────────────────────────────────────────
# Эндпоинты
# ──────────────────────────────────────────────────────────────────────

@router.post("/collect")
async def collect(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_any("data:collect")),
):
    if date_from > date_to:
        raise HTTPException(400, "date_from должна быть <= date_to")
    if (date_to - date_from).days > 31:
        raise HTTPException(400, "Период не может превышать 31 день")
    async with exchange_log.job_run("sales", "manual", date_from, date_to, user) as run:
        run.result = stats = await collect_sales(db, date_from, date_to)
    return {"status": "ok", "date_from": str(date_from), "date_to": str(date_to), **stats}


@router.post("/match")
async def match_services(db: AsyncSession = Depends(get_db),
                         user: CurrentUser = Depends(require_any("data:collect"))):
    """Матчинг названий из sales со справочником services."""
    async with exchange_log.job_run("sales_match", "manual", user=user) as run:
        run.result = stats = await _run_match(db)
    return {"status": "ok", **stats}


@router.get("/unmatched")
async def unmatched(db: AsyncSession = Depends(get_db)):
    """Названия, которые не удалось сопоставить со справочником."""
    rows = await db.execute(
        select(Sale.service_title, func.sum(Sale.final_sum).label("total"))
        .where(Sale.service_id.is_(None))
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
    prev_from, prev_to = prev_period(date_from, date_to)

    def _base_filter(d_from: date, d_to: date):
        f = and_(Sale.sale_date >= d_from, Sale.sale_date <= d_to)
        if not include_excluded:
            f = and_(f, Sale.exclude_from_analytics == False)  # noqa: E712
        return f

    rows = await db.execute(
        select(
            Sale.service_title, Sale.service_id, Sale.unit,
            func.sum(Sale.amount).label("amount"),
            func.sum(Sale.final_sum).label("final_sum"),
            func.sum(Sale.total_sum).label("total_sum"),
        )
        .where(_base_filter(date_from, date_to))
        .group_by(Sale.service_title, Sale.service_id, Sale.unit)
        .order_by(func.sum(Sale.final_sum).desc())
        .limit(limit)
    )
    current = {r.service_title: r for r in rows}

    prev_rows = await db.execute(
        select(Sale.service_title, func.sum(Sale.final_sum).label("final_sum"))
        .where(_base_filter(prev_from, prev_to))
        .group_by(Sale.service_title)
    )
    previous = {r.service_title: r for r in prev_rows}

    grand_total      = sum(float(r.final_sum or 0) for r in current.values())
    prev_grand_total = sum(float(r.final_sum or 0) for r in previous.values())
    total_delta      = calc_delta(grand_total, prev_grand_total)

    services = []
    for title, cur in current.items():
        prev = previous.get(title)
        cur_sum  = float(cur.final_sum or 0)
        prev_sum = float(prev.final_sum or 0) if prev else 0
        d = calc_delta(cur_sum, prev_sum)
        services.append({
            "service_title": title,
            "service_id":    cur.service_id,
            "unit":          cur.unit,
            "amount":        int(cur.amount or 0),
            "final_sum":     cur_sum,
            "total_sum":     float(cur.total_sum or 0),
            "pct_of_total":  round(cur_sum / grand_total * 100, 2) if grand_total else 0,
            "delta_pct":     d["delta_pct"],
            "delta_dir":     d["delta_dir"],
        })

    return {
        "date_from": str(date_from), "date_to": str(date_to),
        "prev_from": str(prev_from), "prev_to":  str(prev_to),
        "total": {
            "final_sum":  grand_total,
            "delta_pct":  total_delta["delta_pct"],
            "delta_dir":  total_delta["delta_dir"],
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
        f = and_(f, Sale.exclude_from_analytics == False)  # noqa: E712

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


# ──────────────────────────────────────────────────────────────────────
# Направления и услуги в динамике
# ──────────────────────────────────────────────────────────────────────

ROOT_CATEGORY_ID = 373   # корень дерева услуг «Лабвита» в МедОДС
NO_CATEGORY = "Без направления"


def _bucket(d: date, granularity: str) -> date:
    if granularity == "month":
        return d.replace(day=1)
    if granularity == "week":
        return d - timedelta(days=d.weekday())
    return d


def _buckets(d_from: date, d_to: date, granularity: str) -> list[date]:
    out, d = [], _bucket(d_from, granularity)
    while d <= d_to:
        out.append(d)
        d = (d.replace(day=28) + timedelta(days=4)).replace(day=1) if granularity == "month" \
            else d + timedelta(days=7 if granularity == "week" else 1)
    return out


@router.get("/by-category")
async def by_category(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    services_limit: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Выручка по направлениям (верхний уровень категорий услуг МедОДС) и топ услуг —
    суммы за период, изменение к прошлому такому же периоду и ряд по дням /
    неделям / месяцам (шаг выбирается по длине периода).
    """
    span = (date_to - date_from).days + 1
    granularity = "day" if span <= 31 else "week" if span <= 120 else "month"
    prev_from, prev_to = prev_period(date_from, date_to)

    cats = {c.id: c for c in (await db.scalars(select(ServiceCategory))).all()}

    def top_level(cat_id: int | None) -> tuple[int | None, str]:
        seen = set()
        while cat_id in cats and cat_id not in seen:
            seen.add(cat_id)
            c = cats[cat_id]
            if c.parent_id in (None, ROOT_CATEGORY_ID) or c.parent_id not in cats:
                return c.id, c.title
            cat_id = c.parent_id
        return None, NO_CATEGORY

    async def load(d_from: date, d_to: date):
        return (await db.execute(
            select(Sale.sale_date, Sale.service_title, Sale.final_sum, Service.category_id)
            .outerjoin(Service, Service.id == Sale.service_id)
            .where(and_(Sale.sale_date >= d_from, Sale.sale_date <= d_to,
                        Sale.exclude_from_analytics == False))  # noqa: E712
        )).all()

    cur_rows, prev_rows = await load(date_from, date_to), await load(prev_from, prev_to)
    periods = _buckets(date_from, date_to, granularity)

    def aggregate(rows, with_series: bool):
        cat_tot: dict = defaultdict(float)
        svc_tot: dict = defaultdict(float)
        cat_ser: dict = defaultdict(lambda: defaultdict(float))
        svc_ser: dict = defaultdict(lambda: defaultdict(float))
        svc_cat: dict = {}
        for r in rows:
            cid, title = top_level(r.category_id)
            key = (cid, title)
            amount = float(r.final_sum or 0)
            cat_tot[key] += amount
            svc_tot[r.service_title] += amount
            svc_cat[r.service_title] = title
            if with_series:
                b = _bucket(r.sale_date, granularity)
                cat_ser[key][b] += amount
                svc_ser[r.service_title][b] += amount
        return cat_tot, svc_tot, cat_ser, svc_ser, svc_cat

    cat_tot, svc_tot, cat_ser, svc_ser, svc_cat = aggregate(cur_rows, True)
    p_cat, p_svc, *_ = aggregate(prev_rows, False)
    grand = sum(cat_tot.values())
    p_grand = sum(p_cat.values())
    p_cat_by_title = {t: v for (_, t), v in p_cat.items()}

    def series(ser: dict) -> list[float]:
        return [round(ser.get(b, 0.0)) for b in periods]

    categories = []
    for (cid, title), total in sorted(cat_tot.items(), key=lambda kv: -kv[1]):
        d = calc_delta(total, p_cat_by_title.get(title, 0))
        categories.append({
            "id": cid, "title": title, "total": round(total),
            "share": round(total / grand * 100, 1) if grand else 0,
            "prev_total": round(p_cat_by_title.get(title, 0)),
            "delta_pct": d["delta_pct"], "delta_dir": d["delta_dir"],
            "series": series(cat_ser[(cid, title)]),
        })

    services = []
    for title, total in sorted(svc_tot.items(), key=lambda kv: -kv[1])[:services_limit]:
        d = calc_delta(total, p_svc.get(title, 0))
        services.append({
            "title": title, "category": svc_cat.get(title, NO_CATEGORY), "total": round(total),
            "share": round(total / grand * 100, 1) if grand else 0,
            "delta_pct": d["delta_pct"], "delta_dir": d["delta_dir"],
            "series": series(svc_ser[title]),
        })

    d_total = calc_delta(grand, p_grand)
    return {
        "date_from": str(date_from), "date_to": str(date_to),
        "prev_from": str(prev_from), "prev_to": str(prev_to),
        "granularity": granularity,
        "periods": [str(b) for b in periods],
        "total": {"sum": round(grand), "prev_sum": round(p_grand),
                  "delta_pct": d_total["delta_pct"], "delta_dir": d_total["delta_dir"]},
        "categories": categories,
        "services": services,
    }
