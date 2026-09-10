from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import date, timedelta
from typing import Optional
from app.db.database import get_db
from app.models.call import Call
from app.models.appointment import Appointment
from app.core.config import settings

router = APIRouter()


def _prev_period(date_from: date, date_to: date) -> tuple[date, date]:
    span = (date_to - date_from).days + 1
    prev_to   = date_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=span - 1)
    return prev_from, prev_to


def _delta(current: float, prev: float) -> dict:
    if not prev:
        return {"delta_pct": None, "delta_dir": None}
    pct = round((current - prev) / prev * 100)
    return {
        "delta_pct": abs(pct),
        "delta_dir": "up" if pct > 0 else "down" if pct < 0 else "flat",
    }


# ── Звонки ────────────────────────────────────────────────────

def _calls_by_period(calls: list, dates: list[str], granularity: str) -> list:
    """Группирует звонки по датам с нужной гранулярностью."""
    buckets: dict = {}

    for d in dates:
        buckets[d] = {"period": d, "incoming": 0, "outgoing": 0, "missed": 0, "total": 0}

    for c in calls:
        local_date = (c.call_start_date + timedelta(hours=7)).date()
        if granularity == "month":
            key = local_date.strftime("%Y-%m")
        elif granularity == "week":
            monday = local_date - timedelta(days=local_date.weekday())
            key = monday.isoformat()
        else:
            key = local_date.isoformat()

        if key not in buckets:
            continue
        buckets[key]["total"] += 1
        if c.is_incoming: buckets[key]["incoming"] += 1
        if c.is_outgoing: buckets[key]["outgoing"] += 1
        if c.is_missed:   buckets[key]["missed"]   += 1

    return list(buckets.values())


def _date_range(date_from: date, date_to: date, granularity: str) -> list[str]:
    dates = []
    current = date_from
    while current <= date_to:
        if granularity == "month":
            key = current.strftime("%Y-%m")
            if key not in dates:
                dates.append(key)
            current = (current.replace(day=1) + timedelta(days=32)).replace(day=1)
        elif granularity == "week":
            monday = current - timedelta(days=current.weekday())
            key = monday.isoformat()
            if key not in dates:
                dates.append(key)
            current += timedelta(days=7)
        else:
            dates.append(current.isoformat())
            current += timedelta(days=1)
    return dates


# ── Записи ────────────────────────────────────────────────────

def _appts_by_period(appts: list, dates: list[str], granularity: str) -> list:
    buckets: dict = {}
    for d in dates:
        buckets[d] = {"period": d, "total": 0, "visits": 0, "noshow": 0,
                      "cancels": 0, "new_patients": 0}

    for a in appts:
        appt_date = a.appointment_date.date() if hasattr(a.appointment_date, 'date') else a.appointment_date
        if granularity == "month":
            key = appt_date.strftime("%Y-%m")
        elif granularity == "week":
            monday = appt_date - timedelta(days=appt_date.weekday())
            key = monday.isoformat()
        else:
            key = appt_date.isoformat()

        if key not in buckets:
            continue
        buckets[key]["total"] += 1
        if a.is_visit:    buckets[key]["visits"]       += 1
        if a.is_noshow:   buckets[key]["noshow"]        += 1
        if a.is_cancelled: buckets[key]["cancels"]      += 1
        if a.new_patient: buckets[key]["new_patients"]  += 1

    # Добавляем visit_pct
    for row in buckets.values():
        t = row["total"]
        row["visit_pct"] = round(row["visits"] / t * 100, 1) if t else 0

    return list(buckets.values())


@router.get("/calls")
async def report_calls(
    date_from:   date          = Query(default=None),
    date_to:     date          = Query(default=None),
    granularity: str           = Query(default="day"),   # day | week | month
    operator_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today() - timedelta(days=1)
    if granularity not in ("day", "week", "month"):
        granularity = "day"

    prev_from, prev_to = _prev_period(date_from, date_to)

    # Текущий период
    q = select(Call).where(and_(
        Call.call_start_date >= date_from,
        Call.call_start_date <= date_to + timedelta(days=1),
    ))
    if operator_id:
        q = q.where(Call.portal_user_id == operator_id)
    curr_calls = list(await db.scalars(q))

    # Предыдущий период
    q2 = select(Call).where(and_(
        Call.call_start_date >= prev_from,
        Call.call_start_date <= prev_to + timedelta(days=1),
    ))
    if operator_id:
        q2 = q2.where(Call.portal_user_id == operator_id)
    prev_calls = list(await db.scalars(q2))

    dates = _date_range(date_from, date_to, granularity)
    rows  = _calls_by_period(curr_calls, dates, granularity)

    # Итоги с дельтами
    curr_total = {
        "incoming": sum(1 for c in curr_calls if c.is_incoming),
        "outgoing": sum(1 for c in curr_calls if c.is_outgoing),
        "missed":   sum(1 for c in curr_calls if c.is_missed),
        "total":    len(curr_calls),
    }
    prev_total = {
        "incoming": sum(1 for c in prev_calls if c.is_incoming),
        "outgoing": sum(1 for c in prev_calls if c.is_outgoing),
        "missed":   sum(1 for c in prev_calls if c.is_missed),
        "total":    len(prev_calls),
    }
    summary = dict(curr_total)
    for key in ("incoming", "outgoing", "missed", "total"):
        d = _delta(curr_total[key], prev_total[key])
        summary[f"{key}_delta_pct"] = d["delta_pct"]
        summary[f"{key}_delta_dir"] = d["delta_dir"]

    # По операторам
    by_operator = []
    for uid, name in settings.LABVITA_OPERATORS.items():
        op_curr = [c for c in curr_calls if c.portal_user_id == uid]
        op_prev = [c for c in prev_calls if c.portal_user_id == uid]
        curr_s = {
            "incoming": sum(1 for c in op_curr if c.is_incoming),
            "outgoing": sum(1 for c in op_curr if c.is_outgoing),
            "missed":   sum(1 for c in op_curr if c.is_missed),
            "total":    len(op_curr),
        }
        prev_s = {
            "incoming": sum(1 for c in op_prev if c.is_incoming),
            "outgoing": sum(1 for c in op_prev if c.is_outgoing),
            "missed":   sum(1 for c in op_prev if c.is_missed),
            "total":    len(op_prev),
        }
        row = {"operator_id": uid, "name": name, **curr_s}
        for key in ("incoming", "outgoing", "missed", "total"):
            d = _delta(curr_s[key], prev_s[key])
            row[f"{key}_delta_pct"] = d["delta_pct"]
            row[f"{key}_delta_dir"] = d["delta_dir"]
        by_operator.append(row)

    return {
        "date_from":   date_from,
        "date_to":     date_to,
        "prev_from":   prev_from,
        "prev_to":     prev_to,
        "granularity": granularity,
        "rows":        rows,
        "summary":     summary,
        "by_operator": by_operator,
    }


@router.get("/appointments")
async def report_appointments(
    date_from:     date          = Query(default=None),
    date_to:       date          = Query(default=None),
    granularity:   str           = Query(default="day"),
    admin_surname: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today() - timedelta(days=1)
    if granularity not in ("day", "week", "month"):
        granularity = "day"

    prev_from, prev_to = _prev_period(date_from, date_to)

    q = select(Appointment).where(and_(
        Appointment.appointment_date >= date_from,
        Appointment.appointment_date <= date_to,
    ))
    if admin_surname:
        q = q.where(Appointment.administrator_surname == admin_surname)
    curr_appts = list(await db.scalars(q))

    q2 = select(Appointment).where(and_(
        Appointment.appointment_date >= prev_from,
        Appointment.appointment_date <= prev_to,
    ))
    if admin_surname:
        q2 = q2.where(Appointment.administrator_surname == admin_surname)
    prev_appts = list(await db.scalars(q2))

    dates = _date_range(date_from, date_to, granularity)
    rows  = _appts_by_period(curr_appts, dates, granularity)

    def _totals(appts):
        t = len(appts)
        v = sum(1 for a in appts if a.is_visit)
        return {
            "total":        t,
            "visits":       v,
            "noshow":       sum(1 for a in appts if a.is_noshow),
            "cancels":      sum(1 for a in appts if a.is_cancelled),
            "new_patients": sum(1 for a in appts if a.new_patient),
            "visit_pct":    round(v / t * 100, 1) if t else 0,
        }

    curr_total = _totals(curr_appts)
    prev_total = _totals(prev_appts)
    summary    = dict(curr_total)
    for key in ("total", "visits", "noshow", "new_patients", "visit_pct"):
        d = _delta(curr_total[key], prev_total[key])
        summary[f"{key}_delta_pct"] = d["delta_pct"]
        summary[f"{key}_delta_dir"] = d["delta_dir"]

    # По администраторам
    all_surnames = {a.administrator_surname for a in curr_appts if a.administrator_surname}
    by_admin = []
    for surname in sorted(all_surnames):
        curr_sub = [a for a in curr_appts if a.administrator_surname == surname]
        prev_sub = [a for a in prev_appts if a.administrator_surname == surname]
        curr_s = _totals(curr_sub)
        prev_s = _totals(prev_sub)
        group_info = settings.ADMIN_GROUPS.get(surname, {"group": "other", "label": "Прочие"})
        row = {"name": surname, "group": group_info["group"],
               "group_label": group_info["label"], **curr_s}
        for key in ("total", "visits", "noshow", "new_patients", "visit_pct"):
            d = _delta(curr_s[key], prev_s[key])
            row[f"{key}_delta_pct"] = d["delta_pct"]
            row[f"{key}_delta_dir"] = d["delta_dir"]
        by_admin.append(row)

    return {
        "date_from":   date_from,
        "date_to":     date_to,
        "prev_from":   prev_from,
        "prev_to":     prev_to,
        "granularity": granularity,
        "rows":        rows,
        "summary":     summary,
        "by_admin":    by_admin,
    }
