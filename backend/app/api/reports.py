from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import date, timedelta
from typing import Optional

from app.db.database import get_db
from app.models.call import Call
from app.models.appointment import Appointment
from app.core.config import settings
from app.core.utils import prev_period, calc_delta, add_deltas, local_date

router = APIRouter()


# ── Гранулярность ────────────────────────────────────────────────────

def _date_range(date_from: date, date_to: date, granularity: str) -> list[str]:
    dates: list[str] = []
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


# ── Звонки ─────────────────────────────────────────────────────────────

def _calls_by_period(calls: list, dates: list[str], granularity: str) -> list:
    buckets: dict[str, dict] = {
        d: {"period": d, "incoming": 0, "outgoing": 0, "missed": 0, "total": 0}
        for d in dates
    }
    for c in calls:
        ld = local_date(c.call_start_date)
        if granularity == "month":
            key = ld.strftime("%Y-%m")
        elif granularity == "week":
            key = (ld - timedelta(days=ld.weekday())).isoformat()
        else:
            key = ld.isoformat()
        if key not in buckets:
            continue
        buckets[key]["total"] += 1
        if c.is_incoming: buckets[key]["incoming"] += 1
        if c.is_outgoing: buckets[key]["outgoing"] += 1
        if c.is_missed:   buckets[key]["missed"]   += 1
    return list(buckets.values())


def _calls_totals(calls: list) -> dict:
    return {
        "incoming": sum(1 for c in calls if c.is_incoming),
        "outgoing": sum(1 for c in calls if c.is_outgoing),
        "missed":   sum(1 for c in calls if c.is_missed),
        "total":    len(calls),
    }


# ── Записи ─────────────────────────────────────────────────────────────

def _appts_by_period(appts: list, dates: list[str], granularity: str) -> list:
    buckets: dict[str, dict] = {
        d: {"period": d, "total": 0, "visits": 0, "noshow": 0, "cancels": 0, "new_patients": 0}
        for d in dates
    }
    for a in appts:
        appt_d = a.appointment_date if isinstance(a.appointment_date, date) else a.appointment_date.date()
        if granularity == "month":
            key = appt_d.strftime("%Y-%m")
        elif granularity == "week":
            key = (appt_d - timedelta(days=appt_d.weekday())).isoformat()
        else:
            key = appt_d.isoformat()
        if key not in buckets:
            continue
        buckets[key]["total"] += 1
        if a.is_visit:     buckets[key]["visits"]      += 1
        if a.is_noshow:    buckets[key]["noshow"]       += 1
        if a.is_cancelled: buckets[key]["cancels"]      += 1
        if a.new_patient:  buckets[key]["new_patients"] += 1

    for row in buckets.values():
        t = row["total"]
        row["visit_pct"] = round(row["visits"] / t * 100, 1) if t else 0

    return list(buckets.values())


def _appts_totals(appts: list) -> dict:
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


# ── Эндпоинты ───────────────────────────────────────────────────────────

@router.get("/calls")
async def report_calls(
    date_from:   date          = Query(default=None),
    date_to:     date          = Query(default=None),
    granularity: str           = Query(default="day"),
    operator_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today() - timedelta(days=1)
    if granularity not in ("day", "week", "month"):
        granularity = "day"

    prev_from, prev_to = prev_period(date_from, date_to)

    def _q(d_from, d_to):
        q = select(Call).where(and_(
            Call.call_start_date >= d_from,
            Call.call_start_date <= d_to + timedelta(days=1),
        ))
        if operator_id:
            q = q.where(Call.portal_user_id == operator_id)
        return q

    curr_calls = list(await db.scalars(_q(date_from, date_to)))
    prev_calls = list(await db.scalars(_q(prev_from, prev_to)))

    dates = _date_range(date_from, date_to, granularity)
    rows  = _calls_by_period(curr_calls, dates, granularity)

    curr_total = _calls_totals(curr_calls)
    prev_total = _calls_totals(prev_calls)
    summary = add_deltas(curr_total, prev_total, ["incoming", "outgoing", "missed", "total"])

    by_operator = []
    for uid, name in settings.LABVITA_OPERATORS.items():
        op_curr = [c for c in curr_calls if c.portal_user_id == uid]
        op_prev = [c for c in prev_calls if c.portal_user_id == uid]
        curr_s = _calls_totals(op_curr)
        prev_s = _calls_totals(op_prev)
        row = {"operator_id": uid, "name": name}
        row.update(add_deltas(curr_s, prev_s, ["incoming", "outgoing", "missed", "total"]))
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

    prev_from, prev_to = prev_period(date_from, date_to)

    def _q(d_from, d_to):
        q = select(Appointment).where(and_(
            Appointment.appointment_date >= d_from,
            Appointment.appointment_date <= d_to,
        ))
        if admin_surname:
            q = q.where(Appointment.administrator_surname == admin_surname)
        return q

    curr_appts = list(await db.scalars(_q(date_from, date_to)))
    prev_appts = list(await db.scalars(_q(prev_from, prev_to)))

    dates = _date_range(date_from, date_to, granularity)
    rows  = _appts_by_period(curr_appts, dates, granularity)

    curr_total = _appts_totals(curr_appts)
    prev_total = _appts_totals(prev_appts)
    summary = add_deltas(curr_total, prev_total,
                         ["total", "visits", "noshow", "new_patients", "visit_pct"])

    all_surnames = {a.administrator_surname for a in curr_appts if a.administrator_surname}
    by_admin = []
    for surname in sorted(all_surnames):
        curr_sub = [a for a in curr_appts if a.administrator_surname == surname]
        prev_sub = [a for a in prev_appts if a.administrator_surname == surname]
        curr_s = _appts_totals(curr_sub)
        prev_s = _appts_totals(prev_sub)
        group_info = settings.ADMIN_GROUPS.get(surname, {"group": "other", "label": "Прочие"})
        row = {
            "name":        surname,
            "group":       group_info["group"],
            "group_label": group_info["label"],
        }
        row.update(add_deltas(curr_s, prev_s,
                              ["total", "visits", "noshow", "new_patients", "visit_pct"]))
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
