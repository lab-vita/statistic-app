from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import date, timedelta
from typing import Optional
from app.db.database import get_db
from app.models.call import Call
from app.services.collector import collect_calls
from app.core.config import settings

router = APIRouter()

ALLOWED_INTERVALS = {1, 5, 10, 15, 30, 60, 120}
MAX_CALLBACK_HOURS = 24


def _calc_callbacks(calls: list) -> list:
    missed   = [c for c in calls if c.is_missed]
    outgoing = [c for c in calls if c.is_outgoing]

    out_by_phone: dict = {}
    for c in outgoing:
        out_by_phone.setdefault(c.phone_number, []).append(c)

    results = []
    for m in missed:
        callback = None
        if m.phone_number in out_by_phone:
            candidates = [
                c for c in out_by_phone[m.phone_number]
                if c.call_start_date > m.call_start_date
                and (c.call_start_date - m.call_start_date).total_seconds() <= MAX_CALLBACK_HOURS * 3600
            ]
            if candidates:
                callback = min(candidates, key=lambda c: c.call_start_date)

        results.append({
            "missed":           m,
            "called_back":      callback is not None,
            "reaction_seconds": int((callback.call_start_date - m.call_start_date).total_seconds()) if callback else None,
        })
    return results


def _callback_stats(callback_results: list) -> dict:
    total    = len(callback_results)
    called   = [r for r in callback_results if r["called_back"]]
    times    = [r["reaction_seconds"] for r in called if r["reaction_seconds"] is not None]
    return {
        "missed_total":     total,
        "callback_count":   len(called),
        "callback_pct":     round(len(called) / total * 100) if total else 0,
        "avg_reaction_sec": sum(times) // len(times) if times else 0,
    }


def _operator_stats(calls: list) -> dict:
    all_callbacks = _calc_callbacks(calls)
    result = {}

    for uid, name in settings.LABVITA_OPERATORS.items():
        op          = [c for c in calls if c.portal_user_id == uid]
        durations   = [c.call_duration for c in op if c.call_duration > 0]
        wait_times  = [c.call_duration for c in op if c.is_missed and c.call_duration > 0]
        op_callbacks = [r for r in all_callbacks if r["missed"].portal_user_id == uid]
        cb          = _callback_stats(op_callbacks)

        result[uid] = {
            "name":          name,
            "incoming":      sum(1 for c in op if c.is_incoming),
            "outgoing":      sum(1 for c in op if c.is_outgoing),
            "missed":        sum(1 for c in op if c.is_missed),
            "total":         len(op),
            "avg_duration":  sum(durations)  // len(durations)  if durations  else 0,
            "avg_wait_time": sum(wait_times) // len(wait_times) if wait_times else 0,
            **cb,
        }

    all_dur   = [c.call_duration for c in calls if c.call_duration > 0]
    all_waits = [c.call_duration for c in calls if c.is_missed and c.call_duration > 0]
    cb_total  = _callback_stats(all_callbacks)
    result["total"] = {
        "name":          "ИТОГО",
        "incoming":      sum(1 for c in calls if c.is_incoming),
        "outgoing":      sum(1 for c in calls if c.is_outgoing),
        "missed":        sum(1 for c in calls if c.is_missed),
        "total":         len(calls),
        "avg_duration":  sum(all_dur)   // len(all_dur)   if all_dur   else 0,
        "avg_wait_time": sum(all_waits) // len(all_waits) if all_waits else 0,
        **cb_total,
    }
    return result


def _filter_calls(calls: list, operator_id: Optional[str]) -> list:
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

    extended_to = date_to + timedelta(days=1)
    calls_extended = list(await db.scalars(
        select(Call).where(
            and_(
                func.date(Call.call_start_date) >= date_from,
                func.date(Call.call_start_date) <= extended_to,
            )
        )
    ))

    if operator_id:
        # Для оператора: его звонки + все исходящие (для поиска перезвонов)
        op_calls = [c for c in calls_extended if c.portal_user_id == operator_id]
        out_all  = [c for c in calls_extended if c.is_outgoing and c.portal_user_id == operator_id]
        stats_calls = op_calls
    else:
        stats_calls = calls_extended

    operators = _operator_stats(stats_calls)

    if operator_id:
        # Возвращаем только нужного оператора + total
        name = settings.LABVITA_OPERATORS.get(operator_id, operator_id)
        return {
            "date_from":   date_from,
            "date_to":     date_to,
            "operator_id": operator_id,
            "operators":   {
                operator_id: operators.get(operator_id, {}),
                "total":     operators.get(operator_id, {}),
            },
        }

    return {"date_from": date_from, "date_to": date_to, "operators": operators}


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
    calls = _filter_calls(calls, operator_id)

    days: dict = {}
    current = date_from
    while current <= date_to:
        days[current.isoformat()] = {
            "date": current.isoformat(), "incoming": 0, "outgoing": 0, "missed": 0, "total": 0,
        }
        current += timedelta(days=1)

    for c in calls:
        d = c.call_start_date.date().isoformat()
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
    calls = _filter_calls(calls, operator_id)

    slots: dict = {}
    minutes_in_day = 24 * 60
    t = 0
    while t < minutes_in_day:
        key = f"{t//60:02d}:{t%60:02d}"
        slots[key] = {"time": key, "incoming": 0, "outgoing": 0, "missed": 0}
        t += interval

    for c in calls:
        local_h   = (c.call_start_date.hour + 7) % 24
        local_m   = c.call_start_date.minute
        total_min = local_h * 60 + local_m
        slot_min  = (total_min // interval) * interval
        slot_min  = min(slot_min, minutes_in_day - interval)
        key = f"{slot_min//60:02d}:{slot_min%60:02d}"
        if key in slots:
            if c.is_incoming: slots[key]["incoming"] += 1
            if c.is_outgoing: slots[key]["outgoing"] += 1
            if c.is_missed:   slots[key]["missed"]   += 1

    filled = [s for s in slots.values() if s["incoming"] + s["outgoing"] + s["missed"] > 0]
    if filled:
        first = filled[0]["time"]
        last  = filled[-1]["time"]
        result = [s for s in slots.values() if s["time"] >= first and s["time"] <= last]
    else:
        result = []

    return {"date_from": date_from, "date_to": date_to, "interval": interval, "slots": result}


@router.get("/operators")
async def get_operators():
    """Список операторов."""
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
    """
    Тепловая карта: день недели (0=Пн..6=Вс) × час (UTC+7).
    Возвращает матрицу 7×24 с количеством звонков в каждой ячейке.
    """
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
    calls = _filter_calls(calls, operator_id)

    # Матрица [weekday][hour] = {incoming, outgoing, missed, total}
    matrix: dict = {}
    DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    for wd in range(7):
        for h in range(24):
            matrix[(wd, h)] = {"weekday": wd, "weekday_name": DAY_NAMES[wd],
                               "hour": h, "incoming": 0, "outgoing": 0,
                               "missed": 0, "total": 0}

    for c in calls:
        local_h  = (c.call_start_date.hour + 7) % 24
        # weekday: понедельник=0 ... воскресенье=6
        # Корректируем день недели при сдвиге UTC+7
        local_dt = c.call_start_date
        # Если после сдвига перешли на следующий день
        shifted_h = c.call_start_date.hour + 7
        wd = (local_dt.weekday() + (1 if shifted_h >= 24 else 0)) % 7

        key = (wd, local_h)
        if key in matrix:
            matrix[key]["total"] += 1
            if c.is_incoming: matrix[key]["incoming"] += 1
            if c.is_outgoing: matrix[key]["outgoing"] += 1
            if c.is_missed:   matrix[key]["missed"]   += 1

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "cells":     list(matrix.values()),
    }


@router.get("/comparison")
async def get_comparison(
    date_from: date = Query(default=None),
    date_to:   date = Query(default=None),
    metric:    str  = Query(default="total"),  # total | incoming | outgoing | missed
    db: AsyncSession = Depends(get_db),
):
    """
    Сравнение операторов по дням.
    Возвращает временной ряд для каждого оператора.
    metric: total | incoming | outgoing | missed
    """
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

    # Строим список дат
    dates = []
    current = date_from
    while current <= date_to:
        dates.append(current.isoformat())
        current += timedelta(days=1)

    # Для каждого оператора — ряд значений по датам
    series = []
    for uid, name in settings.LABVITA_OPERATORS.items():
        op_calls = [c for c in calls if c.portal_user_id == uid]
        by_date: dict = {d: 0 for d in dates}

        for c in op_calls:
            d = c.call_start_date.date().isoformat()
            if d not in by_date:
                continue
            if metric == "total":    by_date[d] += 1
            elif metric == "incoming" and c.is_incoming: by_date[d] += 1
            elif metric == "outgoing" and c.is_outgoing: by_date[d] += 1
            elif metric == "missed"   and c.is_missed:   by_date[d] += 1

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