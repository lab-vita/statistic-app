"""
Пациенты: неявки и повторные визиты.

GET /api/patients/noshows — неявки и отмены по врачам, дням недели и времени приёма
GET /api/patients/returns — какая доля пациентов возвращается и через сколько дней

Считаются записи по ДНЮ ПРИЁМА. Записи, чей приём ещё впереди или без отметки,
в доли не входят: о них пока неизвестно, пришёл человек или нет.
"""
from collections import defaultdict
from datetime import date, timedelta
from statistics import median

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    DAY_NAMES_RU, MEDODS_CANCEL_STATUSES, MEDODS_NOSHOW_STATUSES, MEDODS_VISIT_STATUSES,
)
from app.core.utils import calc_delta, prev_period, today_local
from app.db.database import get_db
from app.models.appointment import Appointment

router = APIRouter()

MIN_DOCTOR_APPTS = 10   # врачи с меньшим числом приёмов в рейтинг не попадают — доли случайны


def _pct(part: int, whole: int) -> float:
    return round(part / whole * 100, 1) if whole else 0.0


def _counter() -> dict:
    return {"visits": 0, "noshow": 0, "cancels": 0}


def _rates(c: dict) -> dict:
    """Доля неявок — от пришедших и не пришедших; доля отмен — от всех прошедших записей."""
    attended = c["visits"] + c["noshow"]
    return {
        **c,
        "appointments": attended + c["cancels"],
        "noshow_pct":   _pct(c["noshow"], attended),
        "cancel_pct":   _pct(c["cancels"], attended + c["cancels"]),
    }


def _kind(status: int) -> str | None:
    if status in MEDODS_VISIT_STATUSES:
        return "visits"
    if status in MEDODS_NOSHOW_STATUSES:
        return "noshow"
    if status in MEDODS_CANCEL_STATUSES:
        return "cancels"
    return None   # приём впереди / без отметки


def _hour(time_str: str | None) -> int | None:
    """'12:00-12:30' → 12."""
    try:
        return int((time_str or "").split(":")[0])
    except ValueError:
        return None


async def _load(db: AsyncSession, d_from: date, d_to: date) -> list[Appointment]:
    return list(await db.scalars(select(Appointment).where(and_(
        Appointment.appointment_date >= d_from,
        Appointment.appointment_date <= d_to,
    ))))


@router.get("/noshows")
async def noshows(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    prev_from, prev_to = prev_period(date_from, date_to)
    appts = await _load(db, date_from, date_to)
    prev  = await _load(db, prev_from, prev_to)

    total, prev_total = _counter(), _counter()
    by_weekday = [_counter() for _ in range(7)]
    by_hour: dict[int, dict] = defaultdict(_counter)
    by_doctor: dict[int, dict] = {}
    by_new = {"new": _counter(), "repeat": _counter()}
    pending = 0

    for a in prev:
        k = _kind(a.status)
        if k:
            prev_total[k] += 1

    for a in appts:
        k = _kind(a.status)
        if k is None:
            pending += 1
            continue
        total[k] += 1
        by_weekday[a.appointment_date.weekday()][k] += 1
        h = _hour(a.appointment_time)
        if h is not None:
            by_hour[h][k] += 1
        by_new["new" if a.new_patient else "repeat"][k] += 1
        if a.doctor_id:
            d = by_doctor.setdefault(a.doctor_id, {"doctor_id": a.doctor_id, "doctor_name": a.doctor_name or "—", **_counter()})
            d[k] += 1

    cur, was = _rates(total), _rates(prev_total)
    d_noshow = calc_delta(cur["noshow_pct"], was["noshow_pct"])
    doctors = [
        {**d, **_rates({k: d[k] for k in ("visits", "noshow", "cancels")})}
        for d in by_doctor.values()
    ]
    doctors = [d for d in doctors if d["visits"] + d["noshow"] >= MIN_DOCTOR_APPTS]
    doctors.sort(key=lambda d: (-d["noshow_pct"], -d["noshow"]))

    return {
        "date_from": date_from, "date_to": date_to,
        "prev_from": prev_from, "prev_to": prev_to,
        "total": {
            **cur,
            "pending": pending,
            "prev_noshow_pct": was["noshow_pct"],
            "noshow_pct_delta_dir": d_noshow["delta_dir"],
            "noshow_pct_delta_pct": d_noshow["delta_pct"],
        },
        "by_weekday": [{"weekday": i, "label": DAY_NAMES_RU[i], **_rates(c)} for i, c in enumerate(by_weekday)],
        "by_hour":    [{"hour": h, **_rates(by_hour[h])} for h in sorted(by_hour)],
        "by_patient": {k: _rates(v) for k, v in by_new.items()},
        "by_doctor":  doctors,
        "min_doctor_appts": MIN_DOCTOR_APPTS,
    }


# ─── Повторные визиты ───────────────────────────────────────

GAP_BUCKETS = [(1, 7, "до недели"), (8, 30, "до месяца"), (31, 90, "1–3 месяца"),
               (91, 180, "3–6 месяцев"), (181, 10_000, "больше полугода")]
RETURN_WINDOWS = (30, 90)


@router.get("/returns")
async def returns(
    date_from: date = Query(...),
    date_to:   date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Пациенты, пришедшие в периоде: сколько из них уже были у нас раньше, сколько
    вернулись после и через сколько дней. «Визит» — запись со статусом «пришёл»
    (один пациент в один день — один визит). История — сколько её есть в базе.
    """
    today = today_local()
    rows = (await db.execute(
        select(Appointment.client_id, Appointment.appointment_date, Appointment.doctor_id,
               Appointment.doctor_name, Appointment.status)
        .where(and_(
            Appointment.client_id.isnot(None),
            Appointment.appointment_date <= today,
            Appointment.status.in_(MEDODS_VISIT_STATUSES),
        ))
    )).all()

    visits: dict[int, dict[date, tuple]] = defaultdict(dict)   # клиент → день → (врач, имя)
    for r in rows:
        visits[r.client_id].setdefault(r.appointment_date, (r.doctor_id, r.doctor_name))
    data_since = min((d for v in visits.values() for d in v), default=None)

    patients = new = returning = 0
    gaps: list[int] = []
    came_back = {n: [0, 0] for n in RETURN_WINDOWS}           # окно → [вернулись, могли вернуться]
    doctors: dict[int, dict] = {}

    for client, days_map in visits.items():
        days = sorted(days_map)
        in_period = [d for d in days if date_from <= d <= date_to]
        if not in_period:
            continue
        patients += 1
        if days[0] < date_from:
            returning += 1
        else:
            new += 1
        # промежутки между визитами, у которых второй визит — в периоде
        for prev_d, d in zip(days, days[1:]):
            if date_from <= d <= date_to:
                gaps.append((d - prev_d).days)
        # вернулся ли после первого визита в периоде (берём первый, а не последний:
        # иначе в недавних периодах почти не остаётся тех, у кого было время вернуться)
        last = in_period[0]
        later = [d for d in days if d > last]
        for n in RETURN_WINDOWS:
            if last <= today - timedelta(days=n):
                came_back[n][1] += 1
                if later and (later[0] - last).days <= n:
                    came_back[n][0] += 1
        # удержание по врачу этого визита (окно 90 дней)
        doc_id, doc_name = days_map[last]
        if doc_id and last <= today - timedelta(days=90):
            d = doctors.setdefault(doc_id, {"doctor_id": doc_id, "doctor_name": doc_name or "—",
                                            "patients": 0, "came_back": 0, "same_doctor": 0})
            d["patients"] += 1
            nxt = later[0] if later and (later[0] - last).days <= 90 else None
            if nxt:
                d["came_back"] += 1
                if days_map[nxt][0] == doc_id:
                    d["same_doctor"] += 1

    buckets = [{"label": label, "count": sum(1 for g in gaps if lo <= g <= hi)} for lo, hi, label in GAP_BUCKETS]
    doc_list = [
        {**d, "came_back_pct": _pct(d["came_back"], d["patients"]),
         "same_doctor_pct": _pct(d["same_doctor"], d["patients"])}
        for d in doctors.values() if d["patients"] >= MIN_DOCTOR_APPTS
    ]
    doc_list.sort(key=lambda d: -d["came_back_pct"])

    # По месяцам: сколько пациентов пришли впервые, а сколько уже бывали
    first_visit = {c: min(v) for c, v in visits.items()}
    months: dict[str, dict] = {}
    m = date(date_to.year, date_to.month, 1)
    for _ in range(12):
        months[m.strftime("%Y-%m")] = {"month": m.strftime("%Y-%m"), "new": 0, "returning": 0}
        m = (m - timedelta(days=1)).replace(day=1)
    for client, days_map in visits.items():
        seen_months = {d.strftime("%Y-%m") for d in days_map}
        for key in seen_months & months.keys():
            first_key = first_visit[client].strftime("%Y-%m")
            months[key]["new" if first_key == key else "returning"] += 1

    # первый месяц истории неполный: там «новыми» выглядят все, кто пришёл
    since_key = data_since.strftime("%Y-%m") if data_since else None
    for row in months.values():
        row["reliable"] = since_key is not None and row["month"] > since_key

    return {
        "date_from": date_from, "date_to": date_to,
        "data_since": data_since,
        "patients": patients,
        "new": new,
        "returning": returning,
        "returning_pct": _pct(returning, patients),
        "came_back": [
            {"days": n, "count": cb, "eligible": el, "pct": _pct(cb, el)}
            for n, (cb, el) in came_back.items()
        ],
        "median_gap_days": round(median(gaps)) if gaps else None,
        "gap_buckets": buckets,
        "monthly": sorted(months.values(), key=lambda x: x["month"]),
        "by_doctor": doc_list,
        "min_doctor_patients": MIN_DOCTOR_APPTS,
    }
