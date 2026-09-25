from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import date, timedelta
from typing import Optional

from app.db.database import get_db
from app.models.appointment import Appointment
from app.services.medods_collector import collect_appointments
from app.services.analytics.appt_stats import (
    stats_from_appts,
    group_breakdown,
    by_admin_stats,
    STATS_KEYS,
)
from app.core.utils import prev_period, add_deltas
from app.core.config import settings

router = APIRouter()


async def _load_appts(
    db: AsyncSession,
    date_from: date,
    date_to: date,
    admin_surname: Optional[str] = None,
) -> list:
    q = select(Appointment).where(
        and_(
            Appointment.appointment_date >= date_from,
            Appointment.appointment_date <= date_to,
        )
    )
    if admin_surname:
        q = q.where(Appointment.administrator_surname == admin_surname)
    return list(await db.scalars(q))


@router.post("/collect")
async def collect(
    date_from: date = Query(default=None),
    date_to:   date = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=1)
    if not date_to:
        date_to = date_from
    count = await collect_appointments(db, date_from, date_to)
    return {"status": "ok", "new_appointments": count,
            "date_from": date_from, "date_to": date_to}


@router.get("/admins")
async def get_admins(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(Appointment.administrator_surname)
        .where(Appointment.administrator_surname.isnot(None))
        .distinct()
    )
    surnames = sorted(r[0] for r in rows if r[0])
    result = []
    for surname in surnames:
        group_info = settings.ADMIN_GROUPS.get(surname, {"group": "other", "label": "Прочие"})
        result.append({
            "surname": surname,
            "group":   group_info["group"],
            "label":   group_info["label"],
        })
    return {"admins": result}


@router.get("/stats")
async def get_stats(
    date_from:     date           = Query(default=None),
    date_to:       date           = Query(default=None),
    admin_surname: Optional[str]  = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=1)
    if not date_to:
        date_to = date_from

    prev_from, prev_to = prev_period(date_from, date_to)

    curr_appts = await _load_appts(db, date_from, date_to, admin_surname)
    prev_appts = await _load_appts(db, prev_from, prev_to, admin_surname)

    curr_total = stats_from_appts(curr_appts)
    prev_total = stats_from_appts(prev_appts)

    by_group = group_breakdown(curr_appts, curr_total["total"]) if not admin_surname else {}
    by_admin  = by_admin_stats(curr_appts, prev_appts)

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "prev_from": prev_from,
        "prev_to":   prev_to,
        "total":     add_deltas(curr_total, prev_total, list(STATS_KEYS)),
        "by_group":  by_group,
        "by_admin":  by_admin,
    }


@router.get("/daily")
async def get_daily(
    date_from:     date          = Query(default=None),
    date_to:       date          = Query(default=None),
    admin_surname: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=7)
    if not date_to:
        date_to = date.today() - timedelta(days=1)

    appts = await _load_appts(db, date_from, date_to, admin_surname)

    days: dict[str, dict] = {}
    current = date_from
    while current <= date_to:
        days[current.isoformat()] = {
            "date": current.isoformat(),
            "total": 0, "visits": 0, "noshow": 0, "new_patients": 0,
        }
        current += timedelta(days=1)

    for a in appts:
        d = a.appointment_date.isoformat()
        if d not in days:
            continue
        days[d]["total"] += 1
        if a.is_visit:    days[d]["visits"]      += 1
        if a.is_noshow:   days[d]["noshow"]       += 1
        if a.new_patient: days[d]["new_patients"] += 1

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "days":      list(days.values()),
    }
