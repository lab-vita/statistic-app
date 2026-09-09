from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
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


def _stats_from_appts(appts: list) -> dict:
    total    = len(appts)
    visits   = sum(1 for a in appts if a.is_visit)
    noshow   = sum(1 for a in appts if a.is_noshow)
    cancels  = sum(1 for a in appts if a.is_cancelled)
    pending  = sum(1 for a in appts if a.is_pending)
    new_pts  = sum(1 for a in appts if a.new_patient)
    callcenter = sum(1 for a in appts if a.is_callcenter)

    return {
        "total":      total,
        "visits":     visits,
        "noshow":     noshow,
        "cancels":    cancels,
        "pending":    pending,
        "new_patients": new_pts,
        "callcenter_total": callcenter,
        "visit_pct":  round(visits / total * 100, 1) if total else 0,
        "noshow_pct": round(noshow / total * 100, 1) if total else 0,
    }


@router.get("/stats")
async def get_stats(
    date_from:      date           = Query(default=None),
    date_to:        date           = Query(default=None),
    admin_surname:  Optional[str]  = Query(default=None),
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

    # Статистика по администраторам
    by_admin: dict = {}
    surnames = settings.CALLCENTER_SURNAMES | {
        a.administrator_surname for a in appts if a.administrator_surname
    }
    for surname in sorted(surnames):
        sub = [a for a in appts if a.administrator_surname == surname]
        if not sub:
            continue
        s = _stats_from_appts(sub)
        by_admin[surname] = {
            "name": surname,
            **s,
            "is_callcenter": surname in settings.CALLCENTER_SURNAMES,
        }

    return {
        "date_from":  date_from,
        "date_to":    date_to,
        "total":      _stats_from_appts(appts),
        "by_admin":   by_admin,
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

    # Группируем по датам
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
        days[d]["total"]        += 1
        if a.is_visit:   days[d]["visits"]       += 1
        if a.is_noshow:  days[d]["noshow"]        += 1
        if a.new_patient: days[d]["new_patients"] += 1

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "days":      list(days.values()),
    }


@router.get("/suspicious")
async def get_suspicious(
    date_from: date = Query(default=None),
    date_to:   date = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Подозрительные записи — антифрод."""
    if not date_from:
        date_from = date.today() - timedelta(days=7)
    if not date_to:
        date_to = date.today() - timedelta(days=1)

    appts = list(await db.scalars(
        select(Appointment).where(
            and_(
                Appointment.appointment_date >= date_from,
                Appointment.appointment_date <= date_to,
            )
        )
    ))

    FAKE_PHONES = {"79000000000", "70000000000", ""}
    FAKE_NAMES  = {"медосмотр", "тест", "admin"}

    result = []
    for a in appts:
        reasons = []
        phone   = (a.client_phone or "").replace("+", "").replace(" ", "")
        surname = (a.client_surname or "").lower()

        if phone in FAKE_PHONES:
            reasons.append("фейковый телефон")
        if not a.administrator_id:
            reasons.append("нет администратора")
        if surname in FAKE_NAMES:
            reasons.append("тестовый клиент")

        if reasons:
            result.append({
                "medods_id":   a.medods_id,
                "date":        a.appointment_date.isoformat(),
                "time":        a.appointment_time,
                "client":      f"{a.client_surname} {a.client_name}".strip(),
                "admin":       a.administrator_surname or "—",
                "status":      settings.MEDODS_STATUS_NAMES.get(a.status, str(a.status)),
                "reasons":     reasons,
            })

    return {"date_from": date_from, "date_to": date_to, "items": result}