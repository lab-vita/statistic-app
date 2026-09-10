from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import date, timedelta
from typing import Optional
from app.db.database import get_db
from app.models.appointment import Appointment
from app.services.medods_collector import collect_appointments
from app.core.config import settings

router = APIRouter()


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
    """Список администраторов из БД с их группами."""
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


def _stats_from_appts(appts: list) -> dict:
    total    = len(appts)
    visits   = sum(1 for a in appts if a.is_visit)
    noshow   = sum(1 for a in appts if a.is_noshow)
    cancels  = sum(1 for a in appts if a.is_cancelled)
    pending  = sum(1 for a in appts if a.is_pending)
    new_pts  = sum(1 for a in appts if a.new_patient)
    callcenter = sum(1 for a in appts if a.is_callcenter)

    return {
        "total":           total,
        "visits":          visits,
        "noshow":          noshow,
        "cancels":         cancels,
        "pending":         pending,
        "new_patients":    new_pts,
        "callcenter_total": callcenter,
        "visit_pct":       round(visits / total * 100, 1) if total else 0,
        "noshow_pct":      round(noshow / total * 100, 1) if total else 0,
    }


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

    q = select(Appointment).where(
        and_(
            Appointment.appointment_date >= date_from,
            Appointment.appointment_date <= date_to,
        )
    )
    if admin_surname:
        q = q.where(Appointment.administrator_surname == admin_surname)

    appts = list(await db.scalars(q))

    # Статистика по администраторам с группами
    by_admin: dict = {}
    all_surnames = {a.administrator_surname for a in appts if a.administrator_surname}
    for surname in sorted(all_surnames):
        sub = [a for a in appts if a.administrator_surname == surname]
        if not sub:
            continue
        group_info = settings.ADMIN_GROUPS.get(surname, {"group": "other", "label": "Прочие"})
        s = _stats_from_appts(sub)
        by_admin[surname] = {
            "name":         surname,
            "group":        group_info["group"],
            "group_label":  group_info["label"],
            "is_callcenter": group_info["group"] == "callcenter",
            **s,
        }

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "total":     _stats_from_appts(appts),
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

    q = select(Appointment).where(
        and_(
            Appointment.appointment_date >= date_from,
            Appointment.appointment_date <= date_to,
        )
    )
    if admin_surname:
        q = q.where(Appointment.administrator_surname == admin_surname)

    appts = list(await db.scalars(q))

    days: dict = {}
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
        days[d]["total"]       += 1
        if a.is_visit:    days[d]["visits"]      += 1
        if a.is_noshow:   days[d]["noshow"]       += 1
        if a.new_patient: days[d]["new_patients"] += 1

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "days":      list(days.values()),
    }
