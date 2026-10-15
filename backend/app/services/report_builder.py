"""
Конструктор отчётов: какие данные можно взять, какие показатели посчитать
и по каким признакам сгруппировать.

Источник (SourceDef) умеет:
  • загрузить строки за период (load);
  • разложить строку на «базовые счётчики» (base) — числа, которые складываются,
    или значения для подсчёта уникальных (множества);
  • посчитать показатели из сумм базовых счётчиков (MetricDef.fn) — поэтому доли
    и средние в итоговой строке считаются честно, а не как среднее средних.

Группировка (DimDef) превращает строку в пару (ключ, подпись). Период есть у
всех источников, остальные — свои у каждого.

Объём данных клиники — десятки тысяч строк в год, поэтому всё считается в
памяти: один запрос в базу на период, дальше — Python.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Awaitable, Callable

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import (
    DAY_NAMES_RU, MEDODS_CANCEL_STATUSES, MEDODS_NOSHOW_STATUSES, MEDODS_PENDING_STATUSES,
    MEDODS_STATUS_NAMES, MEDODS_VISIT_STATUSES,
)
from app.core.utils import TZ_LOCAL, calc_delta, local_window_utc, prev_period, to_local
from app.models.appointment import Appointment
from app.models.call import Call
from app.models.payment_detail import PaymentDetail
from app.models.sale import Sale
from app.models.service import Service, ServiceCategory

MAX_ROWS = 500
MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
             "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
NONE_LABEL = "Не указано"


# ─── Описания ────────────────────────────────────────────────────────

@dataclass
class MetricDef:
    key: str
    label: str
    unit: str                       # count | rub | pct | sec | min
    fn: Callable[[dict], float]
    better: str | None = "up"       # в какую сторону изменение — хорошо
    hint: str = ""


@dataclass
class DimDef:
    key: str
    label: str
    fn: Callable[[Any], tuple[Any, str] | None]
    ordered: bool = False           # естественный порядок (дни недели, часы), а не по величине


@dataclass
class SourceDef:
    key: str
    label: str
    hint: str
    permissions: tuple[str, ...]
    load: Callable[[AsyncSession, date, date, dict], Awaitable[list]]
    day: Callable[[Any], date]
    base: Callable[[Any], dict]
    metrics: list[MetricDef]
    dims: list[DimDef]
    sets: frozenset[str] = frozenset()                 # базовые поля «уникальные значения»
    options: list[dict] = field(default_factory=list)  # доп. настройки источника

    def metric(self, key: str) -> MetricDef | None:
        return next((m for m in self.metrics if m.key == key), None)

    def dim(self, key: str) -> DimDef | None:
        return next((d for d in self.dims if d.key == key), None)


def _ratio(a: float, b: float, k: float = 1.0, digits: int = 1) -> float:
    return round(a / b * k, digits) if b else 0.0


def _s(base: dict, key: str) -> float:
    v = base.get(key, 0)
    return len(v) if isinstance(v, set) else v


# ─── Звонки ──────────────────────────────────────────────────────────

async def _load_calls(db: AsyncSession, d_from: date, d_to: date, _opts: dict) -> list:
    start, end = local_window_utc(d_from, d_to)
    return list((await db.execute(
        select(Call.call_start_date, Call.call_duration, Call.portal_user_id,
               Call.is_incoming, Call.is_outgoing, Call.is_missed)
        .where(and_(Call.call_start_date >= start, Call.call_start_date < end))
    )).all())


def _call_local(r) -> datetime:
    return to_local(r.call_start_date)


def _call_base(r) -> dict:
    answered = (r.is_incoming or r.is_outgoing) and (r.call_duration or 0) > 0
    return {
        "incoming": int(bool(r.is_incoming)),
        "outgoing": int(bool(r.is_outgoing)),
        "missed":   int(bool(r.is_missed)),
        "total":    1,
        "dur_sum":  (r.call_duration or 0) if answered else 0,
        "dur_n":    int(answered),
    }


def _operator(r):
    name = settings.LABVITA_OPERATORS.get(str(r.portal_user_id or ""))
    return (name, name) if name else ("_other", "Другие сотрудники")


CALLS = SourceDef(
    key="calls", label="Звонки", hint="Телефония Битрикс24: входящие, исходящие, пропущенные",
    permissions=("view:calls", "view:reports"),
    load=_load_calls,
    day=lambda r: _call_local(r).date(),
    base=_call_base,
    metrics=[
        MetricDef("received", "Поступило входящих", "count", lambda b: b["incoming"] + b["missed"],
                  hint="Принятые и пропущенные"),
        MetricDef("incoming", "Принято", "count", lambda b: b["incoming"]),
        MetricDef("missed", "Пропущено", "count", lambda b: b["missed"], better="down"),
        MetricDef("missed_pct", "Доля пропущенных", "pct",
                  lambda b: _ratio(b["missed"], b["incoming"] + b["missed"], 100), better="down"),
        MetricDef("outgoing", "Исходящие", "count", lambda b: b["outgoing"]),
        MetricDef("total", "Всего звонков", "count", lambda b: b["total"]),
        MetricDef("talk_min", "Минут разговоров", "min", lambda b: round(b["dur_sum"] / 60)),
        MetricDef("avg_duration", "Средний разговор", "sec", lambda b: _ratio(b["dur_sum"], b["dur_n"], digits=0),
                  better=None, hint="Средняя длительность состоявшегося разговора"),
    ],
    dims=[
        DimDef("weekday", "День недели", lambda r: _weekday(_call_local(r).date()), ordered=True),
        DimDef("hour", "Час", lambda r: _hour_label(_call_local(r).hour), ordered=True),
        DimDef("operator", "Оператор", _operator),
    ],
)


# ─── Записи и пациенты ───────────────────────────────────────────────

APPT_GROUP_LABELS = {"callcenter": "Колл-центр", "admin": "Администраторы", "other": "Прочие"}


async def _load_appts(db: AsyncSession, d_from: date, d_to: date, opts: dict) -> list:
    cols = (Appointment.appointment_date, Appointment.appointment_time, Appointment.status,
            Appointment.new_patient, Appointment.client_id, Appointment.doctor_id,
            Appointment.doctor_name, Appointment.administrator_surname,
            Appointment.attraction_source_title, Appointment.created_at_medods)
    if opts.get("date_basis") == "created":
        # время создания из МедОДС — уже местное; запас в день с каждой стороны, точно — в day()
        start = datetime.combine(d_from - timedelta(days=1), datetime.min.time())
        end = datetime.combine(d_to + timedelta(days=2), datetime.min.time())
        where = or_(
            and_(Appointment.created_at_medods >= start, Appointment.created_at_medods < end),
            and_(Appointment.created_at_medods.is_(None),
                 Appointment.appointment_date >= d_from, Appointment.appointment_date <= d_to),
        )
    else:
        where = and_(Appointment.appointment_date >= d_from, Appointment.appointment_date <= d_to)
    return list((await db.execute(select(*cols).where(where))).all())


def _appt_created_day(r) -> date:
    ts = r.created_at_medods
    if ts is None:
        return r.appointment_date
    if ts.tzinfo is not None:
        return ts.astimezone(TZ_LOCAL).date()
    return ts.date()


def _appt_base(r) -> dict:
    visit = r.status in MEDODS_VISIT_STATUSES
    return {
        "total":    1,
        "visits":   int(visit),
        "noshow":   int(r.status in MEDODS_NOSHOW_STATUSES),
        "cancels":  int(r.status in MEDODS_CANCEL_STATUSES),
        "pending":  int(r.status in MEDODS_PENDING_STATUSES or r.status not in MEDODS_STATUS_NAMES),
        "new":      int(bool(r.new_patient)),
        "patients": r.client_id if visit and r.client_id else None,
    }


def _appt_hour(r):
    try:
        return _hour_label(int((r.appointment_time or "").split(":")[0]))
    except ValueError:
        return None


def _admin_group(r):
    g = settings.ADMIN_GROUPS.get(r.administrator_surname or "", {}).get("group", "other")
    return g, APPT_GROUP_LABELS[g]


APPOINTMENTS = SourceDef(
    key="appointments", label="Записи и пациенты",
    hint="Записи МедОДС: кто пришёл, не пришёл, отменил; новые и уникальные пациенты",
    permissions=("view:appointments", "view:reports"),
    load=_load_appts,
    day=lambda r: r.appointment_date,       # подменяется в run() для «по дню создания»
    base=_appt_base,
    sets=frozenset({"patients"}),
    metrics=[
        MetricDef("total", "Записей", "count", lambda b: b["total"]),
        MetricDef("visits", "Пришли", "count", lambda b: b["visits"]),
        MetricDef("noshow", "Не пришли", "count", lambda b: b["noshow"], better="down"),
        MetricDef("cancels", "Отменены", "count", lambda b: b["cancels"], better="down"),
        MetricDef("pending", "Ещё впереди", "count", lambda b: b["pending"], better=None,
                  hint="Приём не состоялся или не отмечен"),
        MetricDef("visit_pct", "Доля явок", "pct",
                  lambda b: _ratio(b["visits"], b["total"] - b["pending"], 100),
                  hint="От прошедших записей"),
        MetricDef("noshow_pct", "Доля неявок", "pct",
                  lambda b: _ratio(b["noshow"], b["visits"] + b["noshow"], 100), better="down",
                  hint="Не пришли ÷ (пришли + не пришли)"),
        MetricDef("cancel_pct", "Доля отмен", "pct",
                  lambda b: _ratio(b["cancels"], b["total"] - b["pending"], 100), better="down"),
        MetricDef("new", "Записи новых пациентов", "count", lambda b: b["new"]),
        MetricDef("patients", "Уникальных пациентов", "count", lambda b: _s(b, "patients"),
                  hint="Сколько разных пациентов пришли"),
    ],
    dims=[
        DimDef("weekday", "День недели", lambda r: _weekday(r.appointment_date), ordered=True),
        DimDef("hour", "Час приёма", _appt_hour, ordered=True),
        DimDef("doctor", "Врач", lambda r: (r.doctor_id or r.doctor_name, r.doctor_name) if r.doctor_name else None),
        DimDef("admin", "Кто записал", lambda r: (r.administrator_surname, r.administrator_surname)
               if r.administrator_surname else None),
        DimDef("admin_group", "Группа сотрудников", _admin_group),
        DimDef("source", "Источник", lambda r: (r.attraction_source_title, r.attraction_source_title)
               if r.attraction_source_title else ("_none", NONE_LABEL)),
        DimDef("patient_type", "Пациент", lambda r: ("new", "Новый") if r.new_patient else ("repeat", "Повторный"),
               ordered=True),
        DimDef("status", "Статус", lambda r: (r.status, MEDODS_STATUS_NAMES.get(r.status, f"Статус {r.status}"))),
    ],
    options=[{
        "key": "date_basis", "label": "Считать записи",
        "values": [{"value": "visit", "label": "По дню приёма"},
                   {"value": "created", "label": "По дню создания"}],
        "default": "visit",
    }],
)


# ─── Выручка (оплаты) ────────────────────────────────────────────────

async def _load_payments(db: AsyncSession, d_from: date, d_to: date, _opts: dict) -> list:
    return list((await db.execute(
        select(PaymentDetail.payment_date, PaymentDetail.total_paid, PaymentDetail.by_cash,
               PaymentDetail.by_card, PaymentDetail.by_cashless, PaymentDetail.by_credit,
               PaymentDetail.by_balance, PaymentDetail.client_id, PaymentDetail.doctor_id,
               PaymentDetail.doctor_name, PaymentDetail.doctor_surname, PaymentDetail.company_title)
        .where(and_(PaymentDetail.payment_date >= d_from, PaymentDetail.payment_date <= d_to,
                    PaymentDetail.kind == 6))
    )).all())


def _pay_doctor(r):
    if not r.doctor_id and not r.doctor_surname:
        return ("_none", "Без врача")
    name = " ".join(x for x in (r.doctor_surname, r.doctor_name) if x) or str(r.doctor_id)
    return (r.doctor_id or name, name)


REVENUE = SourceDef(
    key="revenue", label="Выручка", hint="Оплаты МедОДС: суммы, способы оплаты, средний чек",
    permissions=("view:revenue",),
    load=_load_payments,
    day=lambda r: r.payment_date,
    base=lambda r: {
        "sum": r.total_paid or 0, "n": 1,
        "cash": r.by_cash or 0, "card": r.by_card or 0, "cashless": r.by_cashless or 0,
        "credit": r.by_credit or 0, "balance": r.by_balance or 0,
        "clients": r.client_id,
    },
    sets=frozenset({"clients"}),
    metrics=[
        MetricDef("sum", "Выручка", "rub", lambda b: b["sum"]),
        MetricDef("n", "Оплат", "count", lambda b: b["n"]),
        MetricDef("avg_check", "Средний чек", "rub", lambda b: _ratio(b["sum"], b["n"], digits=0)),
        MetricDef("clients", "Пациентов оплатили", "count", lambda b: _s(b, "clients")),
        MetricDef("cash", "Наличными", "rub", lambda b: b["cash"], better=None),
        MetricDef("card", "Картой", "rub", lambda b: b["card"], better=None),
        MetricDef("cashless", "Безналичными", "rub", lambda b: b["cashless"], better=None),
        MetricDef("credit", "Кредитом", "rub", lambda b: b["credit"], better=None),
        MetricDef("balance", "С лицевого счёта", "rub", lambda b: b["balance"], better=None),
    ],
    dims=[
        DimDef("weekday", "День недели", lambda r: _weekday(r.payment_date), ordered=True),
        DimDef("doctor", "Врач", _pay_doctor),
        DimDef("payer", "Плательщик", lambda r: (r.company_title, r.company_title)
               if r.company_title else ("_private", "Частные лица")),
    ],
)


# ─── Услуги (продажи) ────────────────────────────────────────────────

ROOT_CATEGORY_ID = 373


async def _load_sales(db: AsyncSession, d_from: date, d_to: date, _opts: dict) -> list:
    rows = list((await db.execute(
        select(Sale.sale_date, Sale.service_title, Sale.final_sum, Sale.amount, Service.category_id)
        .outerjoin(Service, Service.id == Sale.service_id)
        .where(and_(Sale.sale_date >= d_from, Sale.sale_date <= d_to,
                    Sale.exclude_from_analytics == False))  # noqa: E712
    )).all())
    cats = {c.id: c for c in (await db.scalars(select(ServiceCategory))).all()}

    def top(cat_id):
        seen = set()
        while cat_id in cats and cat_id not in seen:
            seen.add(cat_id)
            c = cats[cat_id]
            if c.parent_id in (None, ROOT_CATEGORY_ID) or c.parent_id not in cats:
                return c.title
            cat_id = c.parent_id
        return "Без направления"

    return [_SaleRow(r.sale_date, r.service_title, float(r.final_sum or 0), int(r.amount or 0), top(r.category_id))
            for r in rows]


@dataclass
class _SaleRow:
    sale_date: date
    service_title: str
    final_sum: float
    amount: int
    direction: str


SALES = SourceDef(
    key="sales", label="Услуги", hint="Продажи услуг МедОДС: направления, услуги, количество",
    permissions=("view:revenue",),
    load=_load_sales,
    day=lambda r: r.sale_date,
    base=lambda r: {"sum": r.final_sum, "qty": r.amount},
    metrics=[
        MetricDef("sum", "Сумма продаж", "rub", lambda b: round(b["sum"])),
        MetricDef("qty", "Оказано услуг", "count", lambda b: b["qty"]),
        MetricDef("avg_price", "Средняя цена", "rub", lambda b: _ratio(b["sum"], b["qty"], digits=0), better=None),
    ],
    dims=[
        DimDef("weekday", "День недели", lambda r: _weekday(r.sale_date), ordered=True),
        DimDef("direction", "Направление", lambda r: (r.direction, r.direction)),
        DimDef("service", "Услуга", lambda r: (r.service_title, r.service_title)),
    ],
)


SOURCES: dict[str, SourceDef] = {s.key: s for s in (CALLS, APPOINTMENTS, REVENUE, SALES)}

PERIOD_DIM = {"key": "period", "label": "Период"}


# ─── Помощники группировок ───────────────────────────────────────────

def _weekday(d: date):
    return d.weekday(), DAY_NAMES_RU[d.weekday()]


def _hour_label(h: int):
    return h, f"{h:02d}:00"


def auto_granularity(d_from: date, d_to: date) -> str:
    span = (d_to - d_from).days + 1
    return "day" if span <= 31 else "week" if span <= 120 else "month"


def bucket_start(d: date, g: str) -> date:
    if g == "month":
        return d.replace(day=1)
    if g == "week":
        return d - timedelta(days=d.weekday())
    return d


def bucket_label(b: date, g: str, lo: date | None = None, hi: date | None = None) -> str:
    """Подпись дня / недели / месяца; неполные края периода обрезаются: «Октябрь 2026 (1–14)»."""
    if g == "day":
        return f"{b:%d.%m.%Y}"
    end = (b.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1) if g == "month" \
        else b + timedelta(days=6)
    s, e = max(b, lo or b), min(end, hi or end)
    if g == "month":
        label = f"{MONTHS_RU[b.month - 1]} {b.year}"
        return label if (s, e) == (b, end) else f"{label} ({s.day}–{e.day})"
    return f"{s:%d.%m}–{e:%d.%m.%Y}"


def prev_bucket(b: date, g: str) -> date:
    if g == "month":
        return (b - timedelta(days=1)).replace(day=1)
    return b - timedelta(days=7 if g == "week" else 1)


def buckets(d_from: date, d_to: date, g: str) -> list[date]:
    out, d = [], bucket_start(d_from, g)
    while d <= d_to:
        out.append(d)
        d = (d.replace(day=28) + timedelta(days=4)).replace(day=1) if g == "month" \
            else d + timedelta(days=7 if g == "week" else 1)
    return out


# ─── Схема для интерфейса ────────────────────────────────────────────

def schema_for(has_any: Callable[..., bool]) -> list[dict]:
    out = []
    for s in SOURCES.values():
        if not has_any(*s.permissions):
            continue
        out.append({
            "key": s.key, "label": s.label, "hint": s.hint,
            "metrics": [{"key": m.key, "label": m.label, "unit": m.unit, "better": m.better, "hint": m.hint}
                        for m in s.metrics],
            "dimensions": [PERIOD_DIM] + [{"key": d.key, "label": d.label} for d in s.dims],
            "options": s.options,
        })
    return out


# ─── Расчёт ──────────────────────────────────────────────────────────

class ReportError(ValueError):
    pass


def _new_acc() -> dict:
    return {}


def _add(acc: dict, base: dict, sets: frozenset[str]) -> None:
    for k, v in base.items():
        if k in sets:
            s = acc.setdefault(k, set())
            if v is not None:
                s.add(v)
        else:
            acc[k] = acc.get(k, 0) + v


def _values(src: SourceDef, metrics: list[MetricDef], acc: dict) -> dict:
    full = defaultdict(int, acc)
    for k in src.sets:
        full.setdefault(k, set())
    return {m.key: m.fn(full) for m in metrics}


def _delta(metrics: list[MetricDef], cur: dict, prev: dict | None) -> dict:
    if prev is None:
        return {}
    out = {}
    for m in metrics:
        d = calc_delta(cur.get(m.key, 0), prev.get(m.key, 0))
        out[m.key] = {"pct": d["delta_pct"], "dir": d["delta_dir"]}
    return out


async def run_report(db: AsyncSession, cfg: dict, has_any: Callable[..., bool]) -> dict:
    src = SOURCES.get(cfg.get("source", ""))
    if not src:
        raise ReportError("Неизвестный источник данных")
    if not has_any(*src.permissions):
        raise PermissionError("Нет доступа к этим данным")

    metrics = [m for k in cfg.get("metrics") or [] if (m := src.metric(k))]
    if not metrics:
        raise ReportError("Выберите хотя бы один показатель")

    d_from: date = cfg["date_from"]
    d_to: date = cfg["date_to"]
    if d_from > d_to:
        raise ReportError("Дата начала позже даты окончания")
    if (d_to - d_from).days > 366 * 3:
        raise ReportError("Период не больше трёх лет")

    g = cfg.get("granularity") or "auto"
    if g not in ("day", "week", "month"):
        g = auto_granularity(d_from, d_to)

    opts = {o["key"]: (cfg.get("options") or {}).get(o["key"], o["default"]) for o in src.options}
    day_fn = src.day
    if src is APPOINTMENTS and opts.get("date_basis") == "created":
        day_fn = _appt_created_day

    group_keys = [k for k in (cfg.get("group_by") or []) if k][:2]
    dims: list[tuple[str, str, Callable, bool]] = []
    for k in group_keys:
        if k == "period":
            dims.append(("period", PERIOD_DIM["label"], None, True))
        elif (d := src.dim(k)):
            dims.append((d.key, d.label, d.fn, d.ordered))
        else:
            raise ReportError(f"Неизвестная группировка: {k}")
    if len({d[0] for d in dims}) < len(dims):
        raise ReportError("Две одинаковые группировки")

    filters = {k: {str(v) for v in vals} for k, vals in (cfg.get("filters") or {}).items()
               if vals and k != "period" and src.dim(k)}
    filter_fns = {k: src.dim(k).fn for k in filters}
    filter_labels: dict[str, dict[str, str]] = {k: {} for k in filters}

    compare = bool(cfg.get("compare", True))
    p_from, p_to = prev_period(d_from, d_to)

    async def aggregate(a_from: date, a_to: date, total_from: date | None = None):
        rows = await src.load(db, a_from, a_to, opts)
        total_from = total_from or a_from
        bks = buckets(a_from, a_to, g)
        groups: dict[tuple, dict] = {}
        labels: dict[tuple, list[str]] = {}
        sortkeys: dict[tuple, list] = {}
        total: dict = _new_acc()
        for r in rows:
            day = day_fn(r)
            if day < a_from or day > a_to:
                continue
            skip = False
            for fk, fn in filter_fns.items():
                kv = fn(r) or ("_none", NONE_LABEL)
                if str(kv[0]) not in filters[fk]:
                    skip = True
                    break
                filter_labels[fk][str(kv[0])] = kv[1]
            if skip:
                continue
            base = src.base(r)
            if day >= total_from:
                _add(total, base, src.sets)
            if not dims:
                continue
            key, lab, sk = [], [], []
            for dk, _dl, fn, _ord in dims:
                if dk == "period":
                    b = bucket_start(day, g)
                    key.append(b.isoformat()); lab.append(bucket_label(b, g, a_from, a_to)); sk.append(b)
                else:
                    kv = fn(r)
                    if kv is None:
                        kv = ("_none", NONE_LABEL)
                    key.append(kv[0]); lab.append(kv[1]); sk.append(kv[0])
            key_t = tuple(key)
            if key_t not in groups:
                groups[key_t] = _new_acc()
                labels[key_t] = lab
                sortkeys[key_t] = sk
            _add(groups[key_t], base, src.sets)
        # пустые дни/недели/месяцы — чтобы на графике не было дыр
        if len(dims) == 1 and dims[0][0] == "period":
            for b in bks:
                if (b.isoformat(),) not in groups:
                    groups[(b.isoformat(),)] = _new_acc()
                    labels[(b.isoformat(),)] = [bucket_label(b, g, a_from, a_to)]
                    sortkeys[(b.isoformat(),)] = [b]
        return groups, labels, sortkeys, total, bks

    groups, labels, sortkeys, total_acc, bks = await aggregate(d_from, d_to)
    prev_groups, prev_total_acc = {}, None
    if compare:
        # для строк по периоду нужен целиком предыдущий день/неделя/месяц перед первым
        ext_from = p_from
        if any(d[0] == "period" for d in dims):
            ext_from = min(p_from, prev_bucket(bucket_start(d_from, g), g))
        pg, _pl, _ps, pt, _pb = await aggregate(ext_from, p_to, total_from=p_from)
        prev_groups, prev_total_acc = pg, pt

    # С чем сравнивать строку. Если в группировке есть период — с предыдущим днём /
    # неделей / месяцем (строка «Октябрь» — к «Сентябрю»), иначе — с той же строкой
    # за прошлый период такой же длины.
    period_pos = next((i for i, d in enumerate(dims) if d[0] == "period"), None)

    def prev_acc(key_t: tuple) -> dict | None:
        if period_pos is None:
            return prev_groups.get(key_t)
        pb = prev_bucket(date.fromisoformat(key_t[period_pos]), g).isoformat()
        pk = key_t[:period_pos] + (pb,) + key_t[period_pos + 1:]
        return groups.get(pk) if pk in groups else prev_groups.get(pk)

    first = metrics[0]
    rows = []
    for key_t, acc in groups.items():
        vals = _values(src, metrics, acc)
        prev_vals = None
        if compare:
            pa = prev_acc(key_t)
            prev_vals = _values(src, metrics, pa) if pa is not None else {m.key: 0 for m in metrics}
        rows.append({
            "keys": [str(k) for k in key_t],
            "labels": labels[key_t],
            "_sort": sortkeys[key_t],
            "values": vals,
            "prev": prev_vals,
            "delta": _delta(metrics, vals, prev_vals),
        })

    # Порядок: период, дни недели, часы — естественный; остальное — по первому показателю
    def sort_key(row):
        out = []
        for i, (_dk, _dl, _fn, ordered) in enumerate(dims):
            if ordered:
                sk = row["_sort"][i]
                out.append((0, sk if not isinstance(sk, str) else 0, str(sk)))
            else:
                # по сумме первого показателя внутри этой группы первого уровня — ниже
                out.append((1, -level_totals[i].get(tuple(row["keys"][: i + 1]), 0), row["labels"][i]))
        return out

    level_totals: list[dict] = []
    for i in range(len(dims)):
        lt: dict[tuple, float] = defaultdict(float)
        for row in rows:
            lt[tuple(row["keys"][: i + 1])] += row["values"].get(first.key, 0) or 0
        level_totals.append(lt)
    rows.sort(key=sort_key)
    truncated = len(rows) > MAX_ROWS
    rows = rows[:MAX_ROWS]
    for row in rows:
        row.pop("_sort", None)

    # Прошлый период для графика: только по дням — день сдвигается ровно на длину периода
    prev_series = None
    if compare and len(dims) == 1 and period_pos == 0 and g == "day":
        span = (d_to - d_from).days + 1
        prev_series = []
        for row in rows:
            pd = date.fromisoformat(row["keys"][0]) - timedelta(days=span)
            pa = prev_groups.get((pd.isoformat(),))
            prev_series.append(_values(src, metrics, pa) if pa is not None else {m.key: 0 for m in metrics})

    total_vals = _values(src, metrics, total_acc)
    prev_total_vals = _values(src, metrics, prev_total_acc) if compare else None

    return {
        "source": {"key": src.key, "label": src.label},
        "date_from": d_from.isoformat(), "date_to": d_to.isoformat(),
        "prev_from": p_from.isoformat() if compare else None,
        "prev_to": p_to.isoformat() if compare else None,
        "granularity": g,
        "options": opts,
        "metrics": [{"key": m.key, "label": m.label, "unit": m.unit, "better": m.better} for m in metrics],
        "dimensions": [{"key": d[0], "label": d[1]} for d in dims],
        "filters": [
            {"key": k, "label": src.dim(k).label,
             "values": [filter_labels[k].get(v, v) for v in sorted(vals, key=lambda v: filter_labels[k].get(v, v))]}
            for k, vals in filters.items()
        ],
        "row_compare": None if not compare else ("bucket" if period_pos is not None else "period"),
        "rows": rows,
        "truncated": truncated,
        "prev_series": prev_series,
        "totals": {"values": total_vals, "prev": prev_total_vals,
                   "delta": _delta(metrics, total_vals, prev_total_vals)},
    }


async def dimension_values(db: AsyncSession, source: str, dim: str, d_from: date, d_to: date,
                           has_any: Callable[..., bool], options: dict | None = None) -> list[dict]:
    """Значения группировки за период — для фильтра «только …»."""
    src = SOURCES.get(source)
    if not src or not has_any(*src.permissions):
        raise ReportError("Нет доступа к этим данным")
    d = src.dim(dim)
    if not d:
        raise ReportError("Неизвестная группировка")
    opts = {o["key"]: (options or {}).get(o["key"], o["default"]) for o in src.options}
    counts: dict[str, list] = {}
    for r in await src.load(db, d_from, d_to, opts):
        kv = d.fn(r) or ("_none", NONE_LABEL)
        c = counts.setdefault(str(kv[0]), [kv[1], 0, kv[0]])
        c[1] += 1
    items = sorted(counts.items(), key=lambda kv: (kv[1][2] if d.ordered and not isinstance(kv[1][2], str) else 0,
                                                   -kv[1][1] if not d.ordered else 0, kv[1][0]))
    return [{"value": k, "label": v[0], "count": v[1]} for k, v in items]
