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


def _prev_period(date_from: date, date_to: date) -> tuple[date, date]:
    span = (date_to - date_from).days + 1
    prev_to   = date_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=span - 1)
    return prev_from, prev_to


def _delta(current: int | float, prev: int | float) -> dict:
    if not prev:
        return {"delta_pct": None, "delta_dir": None}
    pct = round((current - prev) / prev * 100)
    return {
        "delta_pct": abs(pct),
        "delta_dir": "up" if pct > 0 else "down" if pct < 0 else "flat",
    }


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


def _stats_from_appts(appts: list) -> dict:
    total      = len(appts)
    visits     = sum(1 for a in appts if a.is_visit)
    noshow     = sum(1 for a in appts if a.is_noshow)
    cancels    = sum(1 for a in appts if a.is_cancelled)
    pending    = sum(1 for a in appts if a.is_pending)
    new_pts    = sum(1 for a in appts if a.new_patient)
    callcenter = sum(1 for a in appts if a.is_callcenter)
    return {
        "total":            total,
        "visits":           visits,
        "noshow":           noshow,
        "cancels":          cancels,
        "pending":          pending,
        "new_patients":     new_pts,
        "callcenter_total": callcenter,
        "visit_pct":        round(visits  / total * 100, 1) if total else 0,
        "noshow_pct":       round(noshow  / total * 100, 1) if total else 0,
        "new_pct":          round(new_pts / total * 100, 1) if total else 0,
        "cancel_pct":       round(cancels / total * 100, 1) if total else 0,
    }


def _group_breakdown(appts: list, total: int) -> dict:
    """Разбивка записей по группам сотрудников."""
    groups: dict[str, int] = {
        "callcenter": 0,
        "admin":      0,
        "other":      0,
        "unknown":    0,
    }
    for a in appts:
        surname    = a.administrator_surname
        group_info = settings.ADMIN_GROUPS.get(surname, None) if surname else None
        group      = group_info["group"] if group_info else "unknown"
        groups[group] = groups.get(group, 0) + 1

    GROUP_LABELS = {
        "callcenter": "Колл-центр",
        "admin":      "Администраторы",
        "other":      "Прочие",
        "unknown":    "Не указан",
    }

    return {
        g: {
            "count": cnt,
            "pct":   round(cnt / total * 100, 1) if total else 0,
            "label": GROUP_LABELS.get(g, g),
        }
        for g, cnt in groups.items()
        if cnt > 0  # не показываем пустые группы
    }


def _add_deltas(curr: dict, prev: dict) -> dict:
    result = dict(curr)
    for key in ("total", "visits", "noshow", "new_patients", "callcenter_total",
                "visit_pct", "noshow_pct", "cancel_pct"):
        d = _delta(curr.get(key, 0), prev.get(key, 0))
        result[f"{key}_delta_pct"] = d["delta_pct"]
        result[f"{key}_delta_dir"] = d["delta_dir"]
    return result


async def _load_appts(db: AsyncSession, date_from: date, date_to: date,
                      admin_surname: Optional[str] = None) -> list:
    q = select(Appointment).where(
        and_(
            Appointment.appointment_date >= date_from,
            Appointment.appointment_date <= date_to,
        )
    )
    if admin_surname:
        q = q.where(Appointment.administrator_surname == admin_surname)
    return list(await db.scalars(q))


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

    prev_from, prev_to = _prev_period(date_from, date_to)

    curr_appts = await _load_appts(db, date_from, date_to, admin_surname)
    prev_appts = await _load_appts(db, prev_from, prev_to, admin_surname)

    curr_total = _stats_from_appts(curr_appts)
    prev_total = _stats_from_appts(prev_appts)

    # Разбивка по группам (только для общей статистики, без фильтра по сотруднику)
    by_group = _group_breakdown(curr_appts, curr_total["total"]) if not admin_surname else {}

    # По администраторам с дельтами
    by_admin: dict = {}
    all_surnames = {a.administrator_surname for a in curr_appts if a.administrator_surname}
    for surname in sorted(all_surnames):
        curr_sub = [a for a in curr_appts if a.administrator_surname == surname]
        prev_sub = [a for a in prev_appts if a.administrator_surname == surname]
        group_info = settings.ADMIN_GROUPS.get(surname, {"group": "other", "label": "Прочие"})
        curr_s = _stats_from_appts(curr_sub)
        prev_s = _stats_from_appts(prev_sub)
        by_admin[surname] = {
            "name":          surname,
            "group":         group_info["group"],
            "group_label":   group_info["label"],
            "is_callcenter": group_info["group"] == "callcenter",
            **_add_deltas(curr_s, prev_s),
        }

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "prev_from": prev_from,
        "prev_to":   prev_to,
        "total":     _add_deltas(curr_total, prev_total),
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
