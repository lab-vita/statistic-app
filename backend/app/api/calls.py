from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import date, timedelta
from typing import Optional

from app.db.database import get_db
from app.models.call import Call
from app.models.appointment import Appointment
from app.services.collector import collect_calls
from app.services.analytics.call_stats import (
    operator_stats_with_deltas,
    conversion_stats,
    CONVERSION_OPERATOR_IDS,
)
from app.core.config import settings
from app.core.utils import prev_period, to_local, local_date
from app.core.constants import DAY_NAMES_RU

router = APIRouter()

ALLOWED_INTERVALS = {1, 5, 10, 15, 30, 60, 120}


async def _load_calls(db: AsyncSession, date_from: date, date_to: date) -> list:
    """Load calls for a date range (extends to +1 day to catch UTC boundary)."""
    extended_to = date_to + timedelta(days=1)
    return list(await db.scalars(
        select(Call).where(
            and_(
                func.date(Call.call_start_date) >= date_from,
                func.date(Call.call_start_date) <= extended_to,
            )
        )
    ))


def _filter_by_operator(calls: list, operator_id: Optional[str]) -> list:
    if operator_id:
        return [c for c in calls if c.portal_user_id == operator_id]
    return calls


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
    count = await collect_calls(db, date_from, date_to)
    return {"status": "ok", "new_calls": count, "date_from": date_from, "date_to": date_to}


@router.get("/stats")
async def get_stats(
    date_from:   date           = Query(default=None),
    date_to:     date           = Query(default=None),
    operator_id: Optional[str]  = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=1)
    if not date_to:
        date_to = date_from

    prev_from, prev_to = prev_period(date_from, date_to)

    curr_calls = _filter_by_operator(await _load_calls(db, date_from, date_to), operator_id)
    prev_calls = _filter_by_operator(await _load_calls(db, prev_from, prev_to), operator_id)

    operators_with_delta = operator_stats_with_deltas(curr_calls, prev_calls)

    if operator_id:
        return {
            "date_from":   date_from,
            "date_to":     date_to,
            "prev_from":   prev_from,
            "prev_to":     prev_to,
            "operator_id": operator_id,
            "operators": {
                operator_id: operators_with_delta.get(operator_id, {}),
                "total":     operators_with_delta.get("total", {}),
            },
        }

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "prev_from": prev_from,
        "prev_to":   prev_to,
        "operators": operators_with_delta,
    }


@router.get("/conversion")
async def get_conversion(
    date_from: date = Query(default=None),
    date_to:   date = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Конверсия звонок → запись для операторов колл-центра.
    Только для Белобородовой, Пирожковой, Часовских.
    """
    if not date_from:
        date_from = date.today() - timedelta(days=1)
    if not date_to:
        date_to = date_from

    calls = await _load_calls(db, date_from, date_to)

    appts = list(await db.scalars(
        select(Appointment).where(
            and_(
                Appointment.appointment_date >= date_from,
                Appointment.appointment_date <= date_to,
            )
        )
    ))
    appts_by_surname: dict[str, int] = {}
    for a in appts:
        if a.administrator_surname:
            appts_by_surname[a.administrator_surname] = (
                appts_by_surname.get(a.administrator_surname, 0) + 1
            )

    rows, total_incoming, total_appts = conversion_stats(calls, appts_by_surname)
    total_conversion = round(total_appts / total_incoming * 100, 1) if total_incoming else 0

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "operators": rows,
        "total": {
            "incoming":       total_incoming,
            "appointments":   total_appts,
            "conversion_pct": total_conversion,
        },
    }


@router.get("/daily")
async def get_daily(
    date_from:   date          = Query(default=None),
    date_to:     date          = Query(default=None),
    operator_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=7)
    if not date_to:
        date_to = date.today() - timedelta(days=1)

    calls = list(await db.scalars(
        select(Call).where(
            and_(
                func.date(Call.call_start_date) >= date_from,
                func.date(Call.call_start_date) <= date_to,
            )
        )
    ))
    calls = _filter_by_operator(calls, operator_id)

    days: dict[str, dict] = {}
    current = date_from
    while current <= date_to:
        days[current.isoformat()] = {
            "date": current.isoformat(), "incoming": 0, "outgoing": 0, "missed": 0, "total": 0,
        }
        current += timedelta(days=1)

    for c in calls:
        d = local_date(c.call_start_date).isoformat()
        if d in days:
            days[d]["total"] += 1
            if c.is_incoming: days[d]["incoming"] += 1
            if c.is_outgoing: days[d]["outgoing"] += 1
            if c.is_missed:   days[d]["missed"]   += 1

    return {"date_from": date_from, "date_to": date_to, "days": list(days.values())}


@router.get("/hourly")
async def get_hourly(
    date_from:   date          = Query(default=None),
    date_to:     date          = Query(default=None),
    interval:    int           = Query(default=60),
    operator_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=1)
    if not date_to:
        date_to = date_from
    if interval not in ALLOWED_INTERVALS:
        interval = 60

    calls = list(await db.scalars(
        select(Call).where(
            and_(
                func.date(Call.call_start_date) >= date_from,
                func.date(Call.call_start_date) <= date_to,
            )
        )
    ))
    calls = _filter_by_operator(calls, operator_id)

    minutes_in_day = 24 * 60
    slots: dict[str, dict] = {}
    t = 0
    while t < minutes_in_day:
        key = f"{t // 60:02d}:{t % 60:02d}"
        slots[key] = {"time": key, "incoming": 0, "outgoing": 0, "missed": 0}
        t += interval

    for c in calls:
        loc = to_local(c.call_start_date)
        total_min = loc.hour * 60 + loc.minute
        slot_min = (total_min // interval) * interval
        slot_min = min(slot_min, minutes_in_day - interval)
        key = f"{slot_min // 60:02d}:{slot_min % 60:02d}"
        if key in slots:
            if c.is_incoming: slots[key]["incoming"] += 1
            if c.is_outgoing: slots[key]["outgoing"] += 1
            if c.is_missed:   slots[key]["missed"]   += 1

    filled = [s for s in slots.values() if s["incoming"] + s["outgoing"] + s["missed"] > 0]
    if filled:
        first = filled[0]["time"]
        last  = filled[-1]["time"]
        result = [s for s in slots.values() if first <= s["time"] <= last]
    else:
        result = []

    return {"date_from": date_from, "date_to": date_to, "interval": interval, "slots": result}


@router.get("/operators")
async def get_operators():
    return {
        "operators": [
            {"id": uid, "name": name}
            for uid, name in settings.LABVITA_OPERATORS.items()
        ]
    }


@router.get("/heatmap")
async def get_heatmap(
    date_from:   date          = Query(default=None),
    date_to:     date          = Query(default=None),
    operator_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today() - timedelta(days=1)

    calls = list(await db.scalars(
        select(Call).where(
            and_(
                func.date(Call.call_start_date) >= date_from,
                func.date(Call.call_start_date) <= date_to,
            )
        )
    ))
    calls = _filter_by_operator(calls, operator_id)

    matrix: dict[tuple, dict] = {}
    for wd in range(7):
        for h in range(24):
            matrix[(wd, h)] = {
                "weekday":      wd,
                "weekday_name": DAY_NAMES_RU[wd],
                "hour":         h,
                "incoming":     0,
                "outgoing":     0,
                "missed":       0,
                "total":        0,
            }

    for c in calls:
        loc = to_local(c.call_start_date)
        # weekday может сдвинуться, если +7 ч переходит на следующий день
        wd = loc.date().weekday()
        key = (wd, loc.hour)
        if key in matrix:
            matrix[key]["total"] += 1
            if c.is_incoming: matrix[key]["incoming"] += 1
            if c.is_outgoing: matrix[key]["outgoing"] += 1
            if c.is_missed:   matrix[key]["missed"]   += 1

    return {"date_from": date_from, "date_to": date_to, "cells": list(matrix.values())}


@router.get("/comparison")
async def get_comparison(
    date_from: date = Query(default=None),
    date_to:   date = Query(default=None),
    metric:    str  = Query(default="total"),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = date.today() - timedelta(days=7)
    if not date_to:
        date_to = date.today() - timedelta(days=1)
    if metric not in {"total", "incoming", "outgoing", "missed"}:
        metric = "total"

    calls = list(await db.scalars(
        select(Call).where(
            and_(
                func.date(Call.call_start_date) >= date_from,
                func.date(Call.call_start_date) <= date_to,
            )
        )
    ))

    dates = []
    current = date_from
    while current <= date_to:
        dates.append(current.isoformat())
        current += timedelta(days=1)

    series = []
    for uid, name in settings.LABVITA_OPERATORS.items():
        op_calls = [c for c in calls if c.portal_user_id == uid]
        by_date: dict[str, int] = {d: 0 for d in dates}

        for c in op_calls:
            d = local_date(c.call_start_date).isoformat()
            if d not in by_date:
                continue
            if metric == "total":                           by_date[d] += 1
            elif metric == "incoming" and c.is_incoming:   by_date[d] += 1
            elif metric == "outgoing" and c.is_outgoing:   by_date[d] += 1
            elif metric == "missed"   and c.is_missed:     by_date[d] += 1

        series.append({
            "operator_id": uid,
            "name":        name,
            "values":      [{"date": d, "value": by_date[d]} for d in dates],
        })

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "metric":    metric,
        "dates":     dates,
        "series":    series,
    }
