from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import date, datetime, time, timedelta
from typing import Optional

from app.db.database import get_db
from app.models.call import Call
from app.models.appointment import Appointment
from app.services.collector import collect_calls
from app.services.analytics.call_stats import (
    operator_stats_with_deltas,
    conversion_stats,
    OUTCOME_FAILED,
    OUTCOME_NONE,
    calc_callbacks,
    missed_share,
    received_count,
    CONVERSION_OPERATOR_IDS,
    MAX_CALLBACK_HOURS,
)
from app.core.config import settings
from app.core.utils import prev_period, to_local, local_date, local_window_utc, today_local, TZ_LOCAL
from app.core.constants import DAY_NAMES_RU
from app.core.auth import require_any

router = APIRouter()

ALLOWED_INTERVALS = {1, 5, 10, 15, 30, 60, 120}


# Запас вперёд для поиска обратных звонков (пропущенный вечером мог быть перезвонен на следующий день)
CALLBACK_LOOKAHEAD = timedelta(hours=MAX_CALLBACK_HOURS)


async def _load_calls(
    db: AsyncSession,
    date_from: date,
    date_to: date,
    lookahead: timedelta = timedelta(0),
) -> list:
    """
    Звонки за период date_from..date_to включительно — по границам СУТОК КЕМЕРОВО.

    Сутки клиники (00:00–24:00 по Кемерово) не совпадают с датой в UTC, поэтому
    фильтр идёт по точным моментам времени, а не по func.date(...). Все эндпоинты
    обязаны брать звонки только через эту функцию, иначе цифры в разных местах
    разойдутся (карточки, графики, тепловая карта).
    """
    start, end = local_window_utc(date_from, date_to)
    return list(await db.scalars(
        select(Call).where(
            and_(Call.call_start_date >= start, Call.call_start_date < end + lookahead)
        )
    ))


async def _load_period(
    db: AsyncSession, date_from: date, date_to: date, operator_id: Optional[str]
) -> tuple[list, list]:
    """
    Возвращает (звонки периода, пул для поиска обратных звонков).
    Считаются только звонки периода; пул — они же + ещё 24 часа вперёд.
    """
    start, end = local_window_utc(date_from, date_to)
    pool = _filter_by_operator(
        await _load_calls(db, date_from, date_to, CALLBACK_LOOKAHEAD), operator_id
    )
    calls = [c for c in pool if start <= c.call_start_date < end]
    return calls, pool


def _filter_by_operator(calls: list, operator_id: Optional[str]) -> list:
    if operator_id:
        return [c for c in calls if c.portal_user_id == operator_id]
    return calls


@router.post("/collect", dependencies=[Depends(require_any("data:collect"))])
async def collect(
    date_from: date = Query(default=None),
    date_to:   date = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = today_local() - timedelta(days=1)
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
        date_from = today_local() - timedelta(days=1)
    if not date_to:
        date_to = date_from

    prev_from, prev_to = prev_period(date_from, date_to)

    curr_calls, curr_pool = await _load_period(db, date_from, date_to, operator_id)
    prev_calls, prev_pool = await _load_period(db, prev_from, prev_to, operator_id)

    operators_with_delta = operator_stats_with_deltas(curr_calls, prev_calls, curr_pool, prev_pool)

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


def _appt_created_day(a: Appointment) -> date:
    """
    День, когда запись СОЗДАНА (а не день приёма). Время из МедОС приходит без
    часового пояса и уже по Кемерово; если пояс есть — переводим в местное.
    Старые записи без даты создания считаем по дню приёма.
    """
    ts = a.created_at_medods
    if ts is None:
        return a.appointment_date
    if ts.tzinfo is not None:
        return ts.astimezone(TZ_LOCAL).date()
    return ts.date()


def _patient_outcome(group: list[Appointment]) -> str:
    """Итог записей одного пациента: visited / waiting / noshow / cancelled."""
    if any(a.is_visit for a in group):
        return "visited"
    if any(not (a.is_noshow or a.is_cancelled) for a in group):
        return "waiting"  # ожидает, одобрена или статус ещё не проставлен
    if any(a.is_noshow for a in group):
        return "noshow"
    return "cancelled"


@router.get("/conversion")
async def get_conversion(
    date_from: date = Query(default=None),
    date_to:   date = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Конверсия звонок → запись для операторов колл-центра.
    Только для Белобородовой, Пирожковой, Часовских.

    Записи берутся по дню СОЗДАНИЯ: звонок и запись, сделанная в этом разговоре,
    попадают в один период. Раньше записи брались по дню приёма, и запись,
    сделанная неделю назад на сегодня, считалась сегодняшней конверсией —
    отсюда значения больше 100%. Считаются пациенты, а не записи (см. ниже).
    """
    if not date_from:
        date_from = today_local() - timedelta(days=1)
    if not date_to:
        date_to = date_from

    calls = await _load_calls(db, date_from, date_to)

    # С запасом по дню с каждой стороны (на случай времени с поясом), точный день — ниже
    start = datetime.combine(date_from - timedelta(days=1), time.min)
    end   = datetime.combine(date_to + timedelta(days=2), time.min)
    candidates = list(await db.scalars(
        select(Appointment).where(or_(
            and_(Appointment.created_at_medods >= start, Appointment.created_at_medods < end),
            and_(
                Appointment.created_at_medods.is_(None),
                Appointment.appointment_date >= date_from,
                Appointment.appointment_date <= date_to,
            ),
        ))
    ))
    in_period = [a for a in candidates if date_from <= _appt_created_day(a) <= date_to]

    # Считаем записанных ПАЦИЕНТОВ, а не записи: за один звонок пациента часто
    # записывают к двум врачам — это одна успешная продажа, а не две.
    # Один пациент у одного оператора в один день = одна запись.
    seen: dict[tuple, list[Appointment]] = {}
    appts: list[Appointment] = []
    for a in in_period:
        patient = a.client_id or a.client_phone or f"appt:{a.medods_id}"
        key = (a.administrator_surname, _appt_created_day(a), patient)
        if key not in seen:
            seen[key] = []
            appts.append(a)
        seen[key].append(a)

    appts_by_surname: dict[str, int] = {}
    for a in appts:
        if a.administrator_surname:
            appts_by_surname[a.administrator_surname] = (
                appts_by_surname.get(a.administrator_surname, 0) + 1
            )

    rows, total_incoming, total_appts = conversion_stats(calls, appts_by_surname)
    total_conversion = round(total_appts / total_incoming * 100, 1) if total_incoming else 0

    # Чем закончились записи этих пациентов (для воронки колл-центра): пришёл,
    # если хоть одна из его записей того дня состоялась; иначе — ждёт приёма,
    # не пришёл или отменил. Считаются те же пациенты, что и в конверсии.
    surnames = {r["surname"] for r in rows}
    outcomes = {"visited": 0, "noshow": 0, "cancelled": 0, "waiting": 0}
    visits_by_surname: dict[str, int] = {}
    for (surname, _day, _patient), group in seen.items():
        if surname not in surnames:
            continue
        outcome = _patient_outcome(group)
        outcomes[outcome] += 1
        if outcome == "visited":
            visits_by_surname[surname] = visits_by_surname.get(surname, 0) + 1
    for r in rows:
        r["visits"] = visits_by_surname.get(r["surname"], 0)
    resolved = outcomes["visited"] + outcomes["noshow"] + outcomes["cancelled"]

    # По дням — те же операторы и та же база, для графиков конверсии
    op_ids   = {r["operator_id"] for r in rows}
    days: dict[str, dict] = {}
    d = date_from
    while d <= date_to:
        days[d.isoformat()] = {"date": d.isoformat(), "incoming": 0, "appointments": 0, "conversion_pct": 0}
        d += timedelta(days=1)
    for c in calls:
        if c.is_incoming and c.portal_user_id in op_ids:
            key = local_date(c.call_start_date).isoformat()
            if key in days:
                days[key]["incoming"] += 1
    for a in appts:
        if a.administrator_surname in surnames:
            key = _appt_created_day(a).isoformat()
            if key in days:
                days[key]["appointments"] += 1
    for day in days.values():
        day["conversion_pct"] = (
            round(day["appointments"] / day["incoming"] * 100, 1) if day["incoming"] else 0
        )

    return {
        "date_from": date_from,
        "date_to":   date_to,
        "operators": rows,
        "total": {
            "incoming":       total_incoming,
            "appointments":   total_appts,
            "conversion_pct": total_conversion,
            **outcomes,
            # явка — среди тех, чей приём уже прошёл (ждущих не считаем)
            "visit_pct": round(outcomes["visited"] / resolved * 100, 1) if resolved else 0,
        },
        "days": list(days.values()),
    }


@router.get("/daily")
async def get_daily(
    date_from:   date          = Query(default=None),
    date_to:     date          = Query(default=None),
    operator_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not date_from:
        date_from = today_local() - timedelta(days=7)
    if not date_to:
        date_to = today_local() - timedelta(days=1)

    # calls — звонки периода, pool — они же + запас вперёд для поиска обратных звонков (как в /stats)
    calls, pool = await _load_period(db, date_from, date_to, operator_id)

    days: dict[str, dict] = {}
    current = date_from
    while current <= date_to:
        days[current.isoformat()] = {
            "date": current.isoformat(), "incoming": 0, "outgoing": 0, "missed": 0, "lost": 0, "total": 0,
        }
        current += timedelta(days=1)

    for c in calls:
        d = local_date(c.call_start_date).isoformat()
        if d in days:
            days[d]["total"] += 1
            if c.is_incoming: days[d]["incoming"] += 1
            if c.is_outgoing: days[d]["outgoing"] += 1
            if c.is_missed:   days[d]["missed"]   += 1

    # «Потеряно» по дням — тем же расчётом, что и в /stats; день — это день пропущенного звонка
    for r in calc_callbacks(calls, pool):
        if r["outcome"] in (OUTCOME_FAILED, OUTCOME_NONE):
            d = local_date(r["missed"].call_start_date).isoformat()
            if d in days:
                days[d]["lost"] += 1

    for day in days.values():
        day["received"]   = received_count(day["incoming"], day["missed"])
        day["missed_pct"] = missed_share(day["incoming"], day["missed"])

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
        date_from = today_local() - timedelta(days=1)
    if not date_to:
        date_to = date_from
    if interval not in ALLOWED_INTERVALS:
        interval = 60

    calls = await _load_calls(db, date_from, date_to)
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
        date_from = today_local() - timedelta(days=30)
    if not date_to:
        date_to = today_local() - timedelta(days=1)

    calls = await _load_calls(db, date_from, date_to)
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
        date_from = today_local() - timedelta(days=7)
    if not date_to:
        date_to = today_local() - timedelta(days=1)
    if metric not in {"total", "incoming", "outgoing", "missed"}:
        metric = "total"

    calls = await _load_calls(db, date_from, date_to)

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
