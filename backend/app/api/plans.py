"""
Планы.

Человек задаёт план на месяц (цифру на месяц по каждому показателю, рабочие дни,
выходные внутри месяца и, при желании, ручные значения отдельных дней) — это
хранится в plan_months. Из этих настроек сервер раскладывает план по дням и
пишет в таблицу plans: её читают карточки, виджеты главной и утренняя сводка.

Показатели:
  • суммы по дням — принятые и исходящие звонки, записи (по дню приёма), выручка;
  • целевые проценты на месяц — конверсия колл-центра в запись и доля явок.

GET  /api/plans/overview?year&month — план и факт по дням для страницы «Планы»
PUT  /api/plans/overview            — сохранить план месяца (нужно право plans:edit)
GET  /api/plans/month, /range       — дневной план (для карточек и виджетов)
"""
from calendar import monthrange
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, current_user, require_any
from app.core.utils import today_local
from app.db.database import get_db
from app.models.plan import Plan, PlanMonth

router = APIRouter()

# Фиксированный порог — не редактируется подневно
FIXED_THRESHOLDS = {
    "calls_missed_pct": 6.0,
}

# Суммы по дням: раскладываются по рабочим дням и пишутся в plans
SUM_METRICS = ["calls_incoming", "calls_outgoing", "appt_count", "revenue"]
# Целевой процент на месяц: по дням не раскладывается
PCT_METRICS = ["conversion_pct", "visit_pct"]
METRICS = SUM_METRICS

METRIC_INFO = {
    "calls_incoming": {"label": "Принятые звонки",  "unit": "count", "group": "calls",
                       "hint": "Входящие, на которые ответили"},
    "calls_outgoing": {"label": "Исходящие звонки", "unit": "count", "group": "calls",
                       "hint": "Все исходящие звонки"},
    "appt_count":     {"label": "Записи",           "unit": "count", "group": "appointments",
                       "hint": "Записи по дню приёма — как в разделе «Записи»"},
    "revenue":        {"label": "Выручка",          "unit": "rub",   "group": "revenue",
                       "hint": "Оплаты МедОДС"},
    "conversion_pct": {"label": "Конверсия в запись", "unit": "pct", "group": "calls",
                       "hint": "Колл-центр: сколько принятых звонков закончились записью"},
    "visit_pct":      {"label": "Доля явок",        "unit": "pct",   "group": "appointments",
                       "hint": "Пришли от прошедших записей"},
}
GROUP_PERMS = {"calls": ("view:calls", "view:plans"), "appointments": ("view:appointments", "view:plans"),
               "revenue": ("view:revenue",)}
DEFAULT_WORKDAYS = [0, 1, 2, 3, 4, 5]   # пн–сб: клиника принимает и по субботам


def _month_days(year: int, month: int) -> list[date]:
    return [date(year, month, d) for d in range(1, monthrange(year, month)[1] + 1)]


def _clean_config(cfg: dict | None) -> dict:
    cfg = dict(cfg or {})
    wd = [int(x) for x in cfg.get("workdays", DEFAULT_WORKDAYS) if 0 <= int(x) <= 6]
    return {
        "workdays":  sorted(set(wd)),
        "days_off":  sorted(set(cfg.get("days_off") or [])),
        "targets":   {k: float(v) for k, v in (cfg.get("targets") or {}).items()
                      if k in METRIC_INFO and v is not None},
        "overrides": {k: {d: float(v) for d, v in (o or {}).items()}
                      for k, o in (cfg.get("overrides") or {}).items() if k in SUM_METRICS},
    }


def working_days(year: int, month: int, cfg: dict) -> list[date]:
    off = set(cfg["days_off"])
    return [d for d in _month_days(year, month) if d.weekday() in cfg["workdays"] and d.isoformat() not in off]


def distribute(year: int, month: int, cfg: dict, metric: str) -> dict[str, float]:
    """
    План на месяц → план по дням. Дни, поправленные вручную, остаются как есть;
    остаток делится поровну между остальными рабочими днями. Звонки и записи —
    целыми числами (лишние единицы — первым дням), выручка — до рубля.
    """
    target = cfg["targets"].get(metric)
    if target is None:
        return {}
    days = _month_days(year, month)
    over = {d: v for d, v in cfg["overrides"].get(metric, {}).items()
            if date.fromisoformat(d).year == year and date.fromisoformat(d).month == month}
    work = [d.isoformat() for d in working_days(year, month, cfg) if d.isoformat() not in over]
    out = {d.isoformat(): 0.0 for d in days}
    out.update(over)
    rest = max(0.0, target - sum(over.values()))
    if work and rest > 0:
        whole = int(round(rest))
        base, extra = divmod(whole, len(work))
        for i, d in enumerate(work):
            out[d] = float(base + (1 if i < extra else 0))
    return out


async def _load_config(db: AsyncSession, year: int, month: int) -> tuple[dict, bool]:
    row = await db.get(PlanMonth, (year, month))
    return _clean_config(row.config if row else None), row is not None


async def _daily_plans(db: AsyncSession, d_from: date, d_to: date) -> dict[str, dict[str, float]]:
    rows = await db.execute(select(Plan).where(and_(Plan.date >= d_from, Plan.date <= d_to)))
    out: dict[str, dict[str, float]] = {}
    for p in rows.scalars():
        out.setdefault(p.metric, {})[p.date.isoformat()] = p.value
    return out


# ─── Факт ────────────────────────────────────────────────────────────

async def _facts(db: AsyncSession, d_from: date, d_to: date, visible: set[str]) -> dict[str, dict]:
    """Факт по дням и за месяц — теми же расчётами, что в отчётах и разделах."""
    from app.api import calls as calls_api
    from app.services.report_builder import run_report

    allow = lambda *_p: True  # noqa: E731 — права проверены выше по группам показателей
    facts: dict[str, dict] = {}

    async def by_day(source: str, metrics: list[str], extra: dict | None = None) -> dict:
        rep = await run_report(db, {
            "source": source, "metrics": metrics, "group_by": ["period"], "granularity": "day",
            "date_from": d_from, "date_to": d_to, "compare": False, "filters": {},
            "options": extra or {},
        }, allow)
        days = {m: {r["keys"][0]: r["values"].get(m, 0) for r in rep["rows"]} for m in metrics}
        return {m: {"days": days[m], "total": rep["totals"]["values"].get(m, 0)} for m in metrics}

    if "calls" in visible:
        c = await by_day("calls", ["incoming", "outgoing"])
        facts["calls_incoming"], facts["calls_outgoing"] = c["incoming"], c["outgoing"]
        conv = await calls_api.get_conversion(date_from=d_from, date_to=d_to, db=db)
        facts["conversion_pct"] = {
            "days": {d["date"]: d["conversion_pct"] for d in conv.get("days", []) if d.get("incoming")},
            "total": conv["total"]["conversion_pct"] if conv.get("total") else 0,
        }
    if "appointments" in visible:
        a = await by_day("appointments", ["total", "visit_pct"])
        facts["appt_count"], facts["visit_pct"] = a["total"], a["visit_pct"]
    if "revenue" in visible:
        facts["revenue"] = (await by_day("revenue", ["sum"]))["sum"]
    return facts


# ─── Страница «Планы» ────────────────────────────────────────────────

@router.get("/overview")
async def overview(year: int, month: int, user: CurrentUser = Depends(current_user),
                   db: AsyncSession = Depends(get_db)):
    if not (1 <= month <= 12 and 2000 <= year <= 2100):
        raise HTTPException(400, "Неверный месяц")
    days = _month_days(year, month)
    d_from, d_to = days[0], days[-1]
    today = today_local()

    visible = {g for g, perms in GROUP_PERMS.items() if user.has_any(*perms)}
    cfg, saved = await _load_config(db, year, month)
    daily = await _daily_plans(db, d_from, d_to)
    # факт считаем только по прошедшим и сегодняшнему дню
    facts = await _facts(db, d_from, min(d_to, today), visible) if d_from <= today else {}

    metrics = []
    for key, info in METRIC_INFO.items():
        if info["group"] not in visible:
            continue
        is_sum = key in SUM_METRICS
        plan_days = daily.get(key, {}) if is_sum else {}
        target = cfg["targets"].get(key)
        if target is None and is_sum and any(plan_days.values()):
            target = sum(plan_days.values())       # план введён раньше по дням, без цифры на месяц
        fact = facts.get(key, {"days": {}, "total": None})
        metrics.append({
            "key": key, **info, "kind": "sum" if is_sum else "pct",
            "target": target,
            "plan_days": plan_days,
            "overrides": cfg["overrides"].get(key, {}),
            "fact_days": fact["days"],
            "fact_total": fact["total"],
        })

    return {
        "year": year, "month": month, "today": today.isoformat(),
        "saved": saved,
        "workdays": cfg["workdays"],
        "days_off": cfg["days_off"],
        "working_days": [d.isoformat() for d in working_days(year, month, cfg)],
        "can_edit": user.has_any("plans:edit"),
        "metrics": metrics,
    }


class OverviewIn(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    workdays: list[int] = Field(default_factory=lambda: list(DEFAULT_WORKDAYS))
    days_off: list[str] = Field(default_factory=list)
    targets: dict[str, float | None] = Field(default_factory=dict)
    overrides: dict[str, dict[str, float]] = Field(default_factory=dict)


@router.put("/overview", dependencies=[Depends(require_any("plans:edit"))])
async def save_overview(body: OverviewIn, user: CurrentUser = Depends(current_user),
                        db: AsyncSession = Depends(get_db)):
    """Сохранить план месяца и переразложить его по дням."""
    days = _month_days(body.year, body.month)
    in_month = {d.isoformat() for d in days}
    old, _ = await _load_config(db, body.year, body.month)
    visible = {g for g, perms in GROUP_PERMS.items() if user.has_any(*perms)}

    new = _clean_config(body.model_dump())
    new["days_off"] = [d for d in new["days_off"] if d in in_month]
    new["overrides"] = {k: {d: v for d, v in o.items() if d in in_month} for k, o in new["overrides"].items()}
    # показатели, которые человеку не видны, не трогаем — берём как были
    for key, info in METRIC_INFO.items():
        if info["group"] not in visible:
            if key in old["targets"]:
                new["targets"][key] = old["targets"][key]
            else:
                new["targets"].pop(key, None)
            if key in old["overrides"]:
                new["overrides"][key] = old["overrides"][key]
    new["targets"] = {k: v for k, v in new["targets"].items() if v is not None and v >= 0}

    row = await db.get(PlanMonth, (body.year, body.month))
    if row is None:
        db.add(PlanMonth(year=body.year, month=body.month, config=new))
    else:
        row.config = new

    # дневной план для карточек, виджетов и сводки
    await db.execute(delete(Plan).where(and_(Plan.date >= days[0], Plan.date <= days[-1],
                                             Plan.metric.in_(SUM_METRICS))))
    for metric in SUM_METRICS:
        for d, v in distribute(body.year, body.month, new, metric).items():
            if v:
                db.add(Plan(date=date.fromisoformat(d), metric=metric, value=v))
    await db.commit()
    return await overview(body.year, body.month, user, db)


# ─── Дневной план для карточек и виджетов ────────────────────────────

@router.get("/month")
async def get_month(year: int, month: int, db: AsyncSession = Depends(get_db)):
    """Планы за месяц — по дням."""
    days_list = _month_days(year, month)
    daily = await _daily_plans(db, days_list[0], days_list[-1])
    days = []
    for d in days_list:
        days.append({
            "date": d.isoformat(), "weekday": d.weekday(), "is_weekend": d.weekday() >= 5,
            **{m: daily.get(m, {}).get(d.isoformat(), 0) for m in SUM_METRICS},
        })
    return {
        "year": year, "month": month, "days": days,
        "totals": {m: sum(r[m] for r in days) for m in SUM_METRICS},
        "fixed": FIXED_THRESHOLDS,
    }


@router.get("/range")
async def get_range(date_from: date, date_to: date, db: AsyncSession = Depends(get_db)):
    """Планы за произвольный период — для сравнения факт/план в карточках."""
    rows = await db.execute(select(Plan).where(and_(Plan.date >= date_from, Plan.date <= date_to)))
    by_day: dict = {}
    for p in rows.scalars():
        by_day.setdefault(p.date.isoformat(), {})[p.metric] = p.value

    totals = {m: 0.0 for m in SUM_METRICS}
    for day_data in by_day.values():
        for metric, val in day_data.items():
            if metric in totals:
                totals[metric] += val

    # целевые проценты месяца, в который попадает начало периода
    cfg, _ = await _load_config(db, date_from.year, date_from.month)
    return {
        "date_from": date_from,
        "date_to":   date_to,
        "by_day":    by_day,
        "totals":    totals,
        "targets":   {k: v for k, v in cfg["targets"].items() if k in PCT_METRICS},
        "fixed":     FIXED_THRESHOLDS,
    }


# ─── Совместимость: прямое сохранение по дням ────────────────────────

class PlanItem(BaseModel):
    date:   date
    metric: str
    value:  float


class BulkUpsert(BaseModel):
    items: list[PlanItem]


@router.post("/upsert", dependencies=[Depends(require_any("plans:edit"))])
async def upsert(body: BulkUpsert, db: AsyncSession = Depends(get_db)):
    """Сохранить/обновить планы по дням (bulk)."""
    for item in body.items:
        existing = await db.get(Plan, (item.date, item.metric))
        if existing:
            existing.value = item.value
        else:
            db.add(Plan(date=item.date, metric=item.metric, value=item.value))
    await db.commit()
    return {"status": "ok", "saved": len(body.items)}


class BulkFill(BaseModel):
    """Заполнить диапазон дат одним значением для одной метрики (старый способ ввода)."""
    date_from: date
    date_to:   date
    metric:    str
    value:     float
    skip_weekends: bool = True


@router.post("/fill", dependencies=[Depends(require_any("plans:edit"))])
async def fill(body: BulkFill, db: AsyncSession = Depends(get_db)):
    current, saved = body.date_from, 0
    while current <= body.date_to:
        if not (body.skip_weekends and current.weekday() >= 5):
            existing = await db.get(Plan, (current, body.metric))
            if existing:
                existing.value = body.value
            else:
                db.add(Plan(date=current, metric=body.metric, value=body.value))
            saved += 1
        current += timedelta(days=1)
    await db.commit()
    return {"status": "ok", "saved": saved}


# ─── Таблицы и перенос старых ключей ─────────────────────────────────

# Прежняя страница сохраняла план под своими названиями — их никто не читал.
LEGACY_KEYS = {"incoming": "calls_incoming", "appointments": "appt_count"}
LEGACY_DROP = ("incoming", "appointments", "visits", "conversion")


async def create_tables(engine) -> None:
    """Создать plan_months, если её нет, и перенести план, сохранённый под старыми ключами."""
    import logging
    log = logging.getLogger(__name__)
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: PlanMonth.__table__.create(c, checkfirst=True))
    from app.db.database import async_session_factory
    async with async_session_factory() as db:
        rows = list((await db.execute(select(Plan).where(Plan.metric.in_(LEGACY_DROP)))).scalars())
        if not rows:
            return
        moved = 0
        for p in rows:
            new_key = LEGACY_KEYS.get(p.metric)
            if new_key and p.value:
                cur = await db.get(Plan, (p.date, new_key))
                if cur is None:
                    db.add(Plan(date=p.date, metric=new_key, value=p.value))
                    moved += 1
                elif not cur.value:
                    cur.value = p.value
                    moved += 1
            await db.delete(p)
        await db.commit()
        log.info("[plans] старые ключи плана: удалено %s строк, перенесено %s значений", len(rows), moved)
