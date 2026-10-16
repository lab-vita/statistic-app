"""
Журнал обмена с МедОДС и Битрикс24 — смотреть в «Настройки → Журнал обмена».

Как устроено:
  • Все HTTP-клиенты к МедОДС и Битрикс24 создаются через make_client(source).
    Его транспорт записывает КАЖДЫЙ запрос: адрес и параметры (без секретов),
    код ответа, время, размер, тело ответа (до MAX_BODY символов), число записей,
    список полей и описание словами — что за данные пришли.
  • Сборщик, рассылка сводки и другие действия оборачиваются в `async with run(...)`:
    получается «сеанс» — сколько запросов, сколько записей, итог, ошибка и сообщения
    сборщика по ходу работы. Запросы вне сеанса (вход сотрудника, поиск в справочнике)
    пишутся без сеанса.
  • Секреты не пишутся: адрес вебхука Битрикс24 заменяется на «вебхук», пароль,
    токены, CSRF и cookies вырезаются из параметров и HTML.
  • Журнал чистится раз в сутки: запросы старше KEEP_REQUEST_DAYS, сеансы старше KEEP_RUN_DAYS.

Ошибка записи в журнал никогда не ломает сбор данных — только предупреждение в логе.
"""
from __future__ import annotations

import contextvars
import json
import logging
import re
import time
import traceback
from collections import Counter
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qsl, urlsplit

import httpx
from sqlalchemy import delete, text, update

from app.core.config import settings
from app.core.constants import MEDODS_STATUS_NAMES

logger = logging.getLogger(__name__)

MAX_BODY = 3_000_000          # символов тела ответа в журнале; больше — обрезаем с пометкой
MAX_EVENTS = 400              # сообщений сборщика на сеанс
KEEP_REQUEST_DAYS = 30
KEEP_RUN_DAYS = 180

SOURCES = {"medods": "МедОДС", "bitrix": "Битрикс24"}

TRIGGERS = {
    "schedule": "по расписанию",
    "digest":   "перед утренней сводкой",
    "manual":   "вручную",
    "resync":   "пересбор истории",
    "startup":  "при запуске сервера",
}

# Названия сеансов в журнале: ключ → (название, источник)
JOBS: dict[str, tuple[str, str]] = {
    "calls":           ("Звонки", "bitrix"),
    "appointments":    ("Записи на приём и их статусы", "medods"),
    "revenue":         ("Выручка по способам оплаты", "medods"),
    "payment_details": ("Платежи подробно", "medods"),
    "sales":           ("Продажи по услугам", "medods"),
    "services":        ("Справочник услуг", "medods"),
    "staff":           ("Сотрудники МедОДС", "medods"),
    "sales_match":     ("Сопоставление продаж со справочником услуг", "medods"),
    "resync":          ("Пересбор статусов записей", "medods"),
    "digest":          ("Утренняя сводка: рассылка", "bitrix"),
}

_SECRET_KEY = re.compile(r"pass|token|auth|secret|csrf|cookie|session|sign|key$", re.I)
_REDACTED = "•••"


# ─── Текущий сеанс ───────────────────────────────────────────

@dataclass
class RunState:
    id: int | None
    job: str
    requests: int = 0
    failed: int = 0
    records: int = 0
    bytes: int = 0
    events: list = field(default_factory=list)
    result: Any = None          # сборщик может положить сюда свой итог
    warnings: int = 0

    def event(self, level: str, msg: str) -> None:
        if len(self.events) < MAX_EVENTS:
            self.events.append({"at": _now().isoformat(), "level": level, "msg": _clean_text(msg)[:4000]})
        elif len(self.events) == MAX_EVENTS:
            self.events.append({"at": _now().isoformat(), "level": "INFO",
                                "msg": "… дальше сообщения не записываются"})


_current: contextvars.ContextVar[RunState | None] = contextvars.ContextVar("exchange_run", default=None)


def current_run() -> RunState | None:
    return _current.get()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _session():
    from app.db.database import async_session_factory
    return async_session_factory()


class _RunLogHandler(logging.Handler):
    """Сообщения логгеров приложения во время сеанса попадают в его ленту событий."""

    _SKIP = ("httpx", "httpcore", "sqlalchemy", "apscheduler", "uvicorn", "websockets", __name__)

    def emit(self, record: logging.LogRecord) -> None:
        state = _current.get()
        if state is None or record.name.startswith(self._SKIP):
            return
        try:
            msg = record.getMessage()
            if record.exc_info and record.levelno >= logging.ERROR:
                msg += "\n" + "".join(traceback.format_exception(*record.exc_info))[-4000:]
            state.event(record.levelname, msg)
            if record.levelno >= logging.WARNING:
                state.warnings += 1
        except Exception:  # noqa: BLE001
            pass


class _SecretFilter(logging.Filter):
    """Убирает адрес вебхука Битрикс24 из логов контейнера (ошибки httpx печатают адрес целиком)."""

    def filter(self, record: logging.LogRecord) -> bool:
        hook = _webhook_base()
        if hook == "/":
            return True
        try:
            msg = record.getMessage()
            if record.exc_info:
                msg += "\n" + "".join(traceback.format_exception(*record.exc_info)).rstrip()
                record.exc_info = None
                record.exc_text = None
            if hook in msg:
                msg = msg.replace(hook, "{вебхук Битрикс24}/")
            record.msg, record.args = msg, None
        except Exception:  # noqa: BLE001
            pass
        return True


def install() -> None:
    """Один раз при старте: лента событий сеансов, логи без секрета вебхука, тишина httpx."""
    root = logging.getLogger()
    if not any(isinstance(h, _RunLogHandler) for h in root.handlers):
        root.addHandler(_RunLogHandler(level=logging.INFO))
    for h in root.handlers:
        if not isinstance(h, _RunLogHandler) and not any(isinstance(f, _SecretFilter) for f in h.filters):
            h.addFilter(_SecretFilter())
    # httpx на уровне INFO печатает каждый запрос целиком — вместе с секретом вебхука Битрикс24
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def _summarize_result(result: Any) -> str:
    labels = {
        "fetched": "получено", "created": "добавлено", "updated": "обновлено",
        "deactivated": "отключено", "total": "всего", "new": "новых", "saved": "сохранено",
        "matched": "сопоставлено", "unmatched": "не сопоставлено", "deleted": "удалено",
        "new_calls": "новых звонков", "new_appointments": "новых записей",
        "sent": "отправлено", "failed": "ошибок",
    }
    if result is None:
        return ""
    if isinstance(result, bool):
        return "готово" if result else "не выполнено"
    if isinstance(result, int):
        return f"новых записей в базе: {result}"
    if isinstance(result, dict) and result and all(re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(k)) for k in result):
        vals = [v for v in result.values() if isinstance(v, (int, float))]
        return f"дней: {len(result)}, строк: {sum(vals):g}"
    if isinstance(result, dict):
        parts = []
        for k, v in result.items():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                parts.append(f"{labels.get(k, k)}: {v:g}" if isinstance(v, float) else f"{labels.get(k, k)}: {v}")
            elif isinstance(v, list) and k in labels:
                parts.append(f"{labels[k]}: {len(v)}")
            elif isinstance(v, str) and k == "skipped" and v:
                parts.append(f"пропуск: {v}")
        if not parts and result and all(isinstance(v, (int, float)) for v in result.values()):
            parts.append(f"дней: {len(result)}, всего: {sum(result.values()):g}")
        return ", ".join(parts)
    return str(result)[:300]


def _jsonable(v: Any) -> Any:
    try:
        return json.loads(json.dumps(v, default=str))
    except Exception:  # noqa: BLE001
        return str(v)


@asynccontextmanager
async def run(job: str, title: str, source: str, trigger: str = "schedule",
              period_from: date | None = None, period_to: date | None = None,
              user_id: str | None = None, user_name: str | None = None):
    """
    Сеанс обмена. Пример:
        async with exchange_log.run("calls", "Звонки", "bitrix", "manual", d1, d2) as r:
            r.result = await collect_calls(db, d1, d2)
    """
    from app.models.exchange_log import SyncRun

    state = RunState(id=None, job=job)
    try:
        async with _session() as db:
            row = SyncRun(job=job, title=title, source=source, trigger=trigger,
                          period_from=period_from, period_to=period_to,
                          user_id=user_id, user_name=user_name, status="running", events=[])
            db.add(row)
            await db.commit()
            state.id = row.id
    except Exception as exc:  # noqa: BLE001 — без журнала сбор всё равно идёт
        logger.warning("[exchange_log] сеанс не записан: %s", exc)

    token = _current.set(state)
    error: str | None = None
    try:
        yield state
    except BaseException as exc:
        root = getattr(exc, "orig", None) or exc          # у ошибок SQLAlchemy суть — в orig
        state.event("ERROR", f"{type(root).__name__}: {root}")
        head = f"{type(root).__name__}: {root}\n\n" if root is not exc else ""
        error = _clean_text(head + f"{type(exc).__name__}: {exc}\n\n"
                            + "".join(traceback.format_exception(exc))[-8000:])
        raise
    finally:
        _current.reset(token)
        if state.id is not None:
            status = "error" if error else ("warning" if state.failed or state.warnings else "ok")
            summary = _summarize_result(state.result)
            if error:
                summary = (summary + "; " if summary else "") + "ошибка: " + error.split("\n", 1)[0][:300]
            try:
                async with _session() as db:
                    await db.execute(update(SyncRun).where(SyncRun.id == state.id).values(
                        status=status, finished_at=_now(), summary=summary,
                        result=_jsonable(state.result), error=error,
                        requests=state.requests, failed=state.failed,
                        records=state.records, bytes=state.bytes, events=state.events,
                    ))
                    await db.commit()
            except Exception as exc:  # noqa: BLE001
                logger.warning("[exchange_log] итог сеанса не записан: %s", exc)


def job_run(key: str, trigger: str = "manual", period_from: date | None = None,
            period_to: date | None = None, user: Any = None):
    """Сеанс для сборщика из JOBS; user — кто запустил вручную (CurrentUser)."""
    title, source = JOBS.get(key, (key, ""))
    return run(key, title, source, trigger, period_from, period_to,
               getattr(user, "id", None), getattr(user, "name", None))


# ─── Без секретов ────────────────────────────────────────────

def _redact(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: (_REDACTED if _SECRET_KEY.search(str(k)) else _redact(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_redact(v) for v in obj]
    return obj


def _webhook_base() -> str:
    return (settings.BITRIX_WEBHOOK_URL or "").rstrip("/") + "/"


def clean_url(url: str) -> str:
    """Адрес без секрета вебхука и без токенов в параметрах."""
    hook = _webhook_base()
    if hook != "/" and url.startswith(hook):
        url = "{вебхук Битрикс24}/" + url[len(hook):]
    parts = urlsplit(url)
    if parts.query:
        q = "&".join(f"{k}={_REDACTED if _SECRET_KEY.search(k) else v}"
                     for k, v in parse_qsl(parts.query, keep_blank_values=True))
        url = url.split("?", 1)[0] + "?" + q
    return url


def _endpoint(url: str) -> str:
    hook = _webhook_base()
    if hook != "/" and url.startswith(hook):
        return url[len(hook):].split("?", 1)[0]
    path = urlsplit(url).path
    if "/rest/" in path:                      # profile.json и др. по токену сотрудника
        return path.split("/rest/", 1)[1]
    return path or "/"


_HTML_SECRETS = [
    re.compile(r'(name=["\']csrf-token["\'][^>]*content=["\'])[^"\']+', re.I),
    re.compile(r'(content=["\'])[^"\']+(["\'][^>]*name=["\']csrf-token)', re.I),
    re.compile(r'(name=["\']authenticity_token["\'][^>]*value=["\'])[^"\']+', re.I),
    re.compile(r'(value=["\'])[^"\']+(["\'][^>]*name=["\']authenticity_token)', re.I),
    re.compile(r'("csrfToken"\s*:\s*")[^"]+', re.I),
]


def _clean_text(s: str) -> str:
    for rx in _HTML_SECRETS:
        s = rx.sub(lambda m: m.group(1) + _REDACTED + (m.group(2) if m.lastindex and m.lastindex >= 2 else ""), s)
    hook = _webhook_base()
    if hook != "/":
        s = s.replace(hook, "{вебхук Битрикс24}/")
    return s


clean_text = _clean_text


def _request_params(request: httpx.Request) -> Any:
    ctype = request.headers.get("content-type", "")
    try:
        raw = request.content
    except Exception:  # noqa: BLE001 — потоковое тело
        return None
    if not raw:
        q = dict(parse_qsl(urlsplit(str(request.url)).query, keep_blank_values=True))
        return _redact(q) or None
    if "json" in ctype:
        try:
            return _redact(json.loads(raw))
        except ValueError:
            pass
    if "x-www-form-urlencoded" in ctype:
        return _redact(dict(parse_qsl(raw.decode("utf-8", "replace"), keep_blank_values=True)))
    return f"{len(raw)} байт ({ctype or 'без типа'})"


# ─── Описание данных словами ────────────────────────────────

def _n(x: Any) -> str:
    try:
        return f"{int(x):,}".replace(",", " ")
    except (TypeError, ValueError):
        return str(x)


def _ru_date(v: Any) -> str:
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", str(v or ""))
    return f"{m.group(3)}.{m.group(2)}.{m.group(1)}" if m else ""


def _rub(x: float) -> str:
    return f"{x:,.0f}".replace(",", " ") + " ₽"


def _first_list(data: Any) -> list | None:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ("data", "result", "items", "rows", "users", "records", "categories", "entryTypes"):
            v = data.get(k)
            if isinstance(v, list):
                return v
            if isinstance(v, dict):
                inner = _first_list(v)
                if inner is not None:
                    return inner
    return None


def _fields(rows: list | None) -> list[str] | None:
    if not rows or not isinstance(rows[0], dict):
        return None
    keys: list[str] = []
    for r in rows[:20]:
        if isinstance(r, dict):
            for k in r:
                if k not in keys:
                    keys.append(k)
    return keys[:120]


fields_of = _fields


@dataclass
class Described:
    title: str
    summary: str
    records: int | None = None
    fields: list[str] | None = None
    keep_body: bool = True


def _sum_field(rows: list, *path: str) -> float:
    total = 0.0
    for r in rows:
        v: Any = r
        for p in path:
            v = v.get(p) if isinstance(v, dict) else None
        try:
            total += float(v or 0)
        except (TypeError, ValueError):
            pass
    return total


def _describe_bitrix(endpoint: str, params: Any, data: Any) -> Described:
    if isinstance(data, dict) and data.get("error"):
        d = _describe_bitrix_ok(endpoint, params, {})
        d.summary = f"Ошибка Битрикс24: {data.get('error')} — {data.get('error_description') or ''}".strip(" —")
        d.records, d.fields = 0, None
        return d
    return _describe_bitrix_ok(endpoint, params, data)


def _describe_bitrix_ok(endpoint: str, params: Any, data: Any) -> Described:
    p = params if isinstance(params, dict) else {}
    result = data.get("result") if isinstance(data, dict) else None
    total = data.get("total") if isinstance(data, dict) else None
    nxt = data.get("next") if isinstance(data, dict) else None
    page = f", с позиции {p.get('start')}" if p.get("start") else ""
    more = f"; всего по фильтру {_n(total)}" if total is not None else ""
    more += f", дальше — с позиции {nxt}" if nxt is not None else ", это последняя страница"

    if endpoint == "voximplant.statistic.get":
        rows = result if isinstance(result, list) else []
        f = p.get("FILTER") or {}
        c = Counter()
        for r in rows:
            t, code = str(r.get("CALL_TYPE")), str(r.get("CALL_FAILED_CODE"))
            c["входящих принятых" if t == "2" and code == "200" else
              "пропущенных" if t == "2" and code == "304" else
              "исходящих" if t == "1" else "прочих"] += 1
        ops = Counter(str(r.get("PORTAL_USER_ID") or "—") for r in rows)
        op_txt = ", ".join(f"{settings.LABVITA_OPERATORS.get(k, 'сотрудник ' + k)} — {v}"
                           for k, v in ops.most_common(6))
        period = ""
        if f.get(">=CALL_START_DATE"):
            d1, d2 = _ru_date(f.get(">=CALL_START_DATE")), _ru_date(f.get("<=CALL_START_DATE"))
            period = f" за {d1}" if d1 == d2 or not d2 else f" за {d1} — {d2}"
        parts = ", ".join(f"{k} {v}" for k, v in c.items())
        return Described(
            f"Звонки телефонии по номеру {f.get('PORTAL_NUMBER', '—')}{period}{page}",
            f"Звонков на странице: {len(rows)}" + (f" ({parts})" if parts else "")
            + (f". По сотрудникам: {op_txt}" if op_txt else "") + more,
            len(rows), _fields(rows))
    if endpoint == "user.get":
        rows = result if isinstance(result, list) else []
        return Described(f"Справочник сотрудников портала{page}",
                         f"Сотрудников на странице: {len(rows)}{more}", len(rows), _fields(rows))
    if endpoint == "im.search.user.list":
        rows = list(result.values()) if isinstance(result, dict) else (result or [])
        return Described(f"Поиск сотрудников портала «{p.get('FIND', '')}»",
                         f"Найдено: {len(rows)}", len(rows), _fields(rows))
    if endpoint == "im.user.list.get":
        rows = list(result.values()) if isinstance(result, dict) else (result or [])
        ids = p.get("ID") or []
        return Described(f"Фото и должности сотрудников ({len(ids) if isinstance(ids, list) else 1} шт.)",
                         f"Получено профилей: {len(rows)}", len(rows), _fields(rows))
    if endpoint in ("profile", "profile.json"):
        r = result if isinstance(result, dict) else {}
        name = " ".join(x for x in (r.get("NAME"), r.get("LAST_NAME")) if x)
        return Described("Профиль сотрудника, открывшего приложение",
                         f"Сотрудник: {name or '—'} (ID {r.get('ID', '—')})" + (", администратор портала" if r.get("ADMIN") else ""),
                         1 if r else 0, _fields([r]) if r else None)
    if endpoint.startswith("imbot.") or endpoint.startswith("im."):
        what = {
            "imbot.register": "Регистрация чат-бота", "imbot.update": "Обновление чат-бота",
            "imbot.unregister": "Удаление чат-бота", "imbot.message.add": "Сообщение от бота",
            "imbot.bot.list": "Список чат-ботов портала", "im.message.add": "Сообщение в чат",
        }.get(endpoint, f"Чат: {endpoint}")
        dialog = p.get("DIALOG_ID") or p.get("TO")
        return Described(what + (f" → диалог {dialog}" if dialog else ""),
                         f"Ответ портала: {json.dumps(result, ensure_ascii=False)[:300]}" if result is not None else "Ответ без данных",
                         None, None)
    rows = _first_list(data)
    return Described(f"Битрикс24: {endpoint}{page}",
                     (f"Записей: {len(rows)}" if rows is not None else "Ответ получен") + (more if total is not None else ""),
                     len(rows) if rows is not None else None, _fields(rows))


def _describe_medods(method: str, endpoint: str, params: Any, data: Any, text_body: str, ctype: str) -> Described:
    p = params if isinstance(params, dict) else {}
    offset = p.get("offset")
    page = f", с позиции {offset}" if offset else ""

    if endpoint == "/users/sign_in":
        step = "страница входа (получение CSRF)" if method == "GET" else "отправка логина и пароля"
        return Described(f"Вход в МедОДС: {step}", "Служебный шаг авторизации, тело ответа не сохраняется",
                         None, None, keep_body=False)
    if endpoint == "/" and "html" in ctype:
        return Described("Вход в МедОДС: свежий CSRF-токен после входа",
                         "Служебный шаг авторизации, тело ответа не сохраняется", None, None, keep_body=False)

    if endpoint == "/reports/doctor_appointments_report":
        rows = (data or {}).get("data") or [] if isinstance(data, dict) else []
        count = data.get("count") if isinstance(data, dict) else None
        by_date = bool((p.get("report") or {}).get("period"))
        period = ((p.get("report") or {}).get("period") if by_date
                  else " — ".join(dict.fromkeys(_ru_date(x) for x in (p.get("createdDate") or []))))
        st = Counter()
        new = 0
        for r in rows:
            a = r.get("appointment", r) if isinstance(r, dict) else {}
            st[MEDODS_STATUS_NAMES.get(a.get("status"), f"статус {a.get('status')}")] += 1
            new += 1 if a.get("newPatient") else 0
        st_txt = ", ".join(f"{k} — {v}" for k, v in st.most_common())
        return Described(
            f"Записи на приём {'на дни приёма' if by_date else 'созданные в дни'} {period}{page}",
            f"Записей на странице: {len(rows)} из {_n(count)}" + (f". Статусы: {st_txt}" if st_txt else "")
            + (f". Новых пациентов: {new}" if new else ""),
            len(rows), _fields([(r.get("appointment", r) if isinstance(r, dict) else r) for r in rows]))

    if endpoint == "/reports/create_payment_types":
        rows = (data or {}).get("data") or [] if isinstance(data, dict) else []
        nz = [r for r in rows if float(r.get("sum") or 0) or int(r.get("amount") or 0)]
        txt = ", ".join(f"{r.get('title')} — {_n(r.get('amount'))} шт. на {_rub(float(r.get('sum') or 0))}" for r in nz[:10])
        return Described(f"Выручка по способам оплаты за {p.get('report[period]', '—')}",
                         f"Способов оплаты: {len(rows)} (с оплатами — {len(nz)}). "
                         f"Итого {_rub(_sum_field(rows, 'sum'))}" + (f": {txt}" if txt else ""),
                         len(rows), _fields(rows))

    if endpoint == "/reports/payments_report":
        rows = (data or {}).get("data") or [] if isinstance(data, dict) else []
        count = data.get("count") if isinstance(data, dict) else None
        kinds = Counter(str((r.get("payment") or {}).get("kind")) for r in rows if isinstance(r, dict))
        names = {"6": "оплаты", "7": "страховые", "2": "возвраты"}
        k_txt = ", ".join(f"{names.get(k, 'вид ' + k)} — {v}" for k, v in kinds.most_common())
        return Described(
            f"Платежи (подробно) за {(p.get('report') or {}).get('period', '—')}{page}",
            f"Платежей на странице: {len(rows)} из {_n(count)}"
            + (f" ({k_txt})" if k_txt else "")
            + f". Сумма по странице: {_rub(_sum_field(rows, 'payment', 'totalIncome'))}",
            len(rows), _fields([(r.get("payment", r) if isinstance(r, dict) else r) for r in rows]))

    if endpoint == "/api/internal/analytics/reports/sales":
        rid = data.get("request_id") if isinstance(data, dict) else None
        return Described(f"Запрос отчёта продаж по услугам за {(p.get('report') or {}).get('period', '—')}",
                         f"МедОДС принял запрос, номер {rid or '—'}; данные придут по WebSocket", None, None)

    if endpoint == "/categories/entry_types":
        d = data if isinstance(data, dict) else {}
        cats = d.get("categories") or []
        items = d.get("entryTypes") or d.get("entry_types") or d.get("items") or []
        return Described(f"Справочник услуг: категория {p.get('id', '—')}",
                         f"Подкатегорий: {len(cats)}, услуг: {len(items)}",
                         len(cats) + len(items), _fields(items or cats))

    if endpoint == "/users" and "html" in ctype:
        ids = re.findall(r'data-href="/users/(\d+)/edit"', text_body)
        return Described(f"Список сотрудников МедОДС, страница {p.get('page', 1)}",
                         f"HTML-страница: найдено сотрудников {len(ids)}", len(ids), None)
    m = re.fullmatch(r"/users/(\d+)/edit", endpoint)
    if m:
        u = re.search(r'gon\.specific\s*=\s*(\{.*?\});\s*//\]\]>', text_body, re.DOTALL)
        name = ""
        if u:
            try:
                user = json.loads(u.group(1)).get("user") or {}
                name = " ".join(x for x in (user.get("surname"), user.get("name"), user.get("secondName")) if x)
            except ValueError:
                pass
        return Described(f"Карточка сотрудника МедОДС №{m.group(1)}",
                         f"HTML-страница с данными сотрудника{': ' + name if name else ''}", 1, None)

    rows = _first_list(data)
    if rows is not None:
        return Described(f"МедОДС: {method} {endpoint}{page}", f"Записей: {len(rows)}", len(rows), _fields(rows))
    if "html" in ctype:
        return Described(f"МедОДС: {method} {endpoint}", "HTML-страница", None, None)
    return Described(f"МедОДС: {method} {endpoint}", "Ответ получен", None, None)


def describe(source: str, method: str, endpoint: str, params: Any, ctype: str, body: str) -> Described:
    data = None
    if "json" in ctype or body[:1] in ("{", "["):
        try:
            data = json.loads(body)
        except ValueError:
            data = None
    try:
        if source == "bitrix":
            return _describe_bitrix(endpoint, params, data)
        return _describe_medods(method, endpoint, params, data, body, ctype)
    except Exception as exc:  # noqa: BLE001 — описание не должно ломать журнал
        return Described(f"{SOURCES.get(source, source)}: {method} {endpoint}", f"Ответ получен (описание не собрано: {exc})")


# ─── Запись запроса ──────────────────────────────────────────

async def record(*, source: str, method: str, url: str, endpoint: str | None = None,
                 params: Any = None, status_code: int | None = None, ok: bool = True,
                 duration_ms: int = 0, content_type: str = "", body: str | None = None,
                 error: str | None = None, described: Described | None = None) -> None:
    """Записать один обмен. Используется транспортом и вручную (WebSocket)."""
    from app.models.exchange_log import SyncRequest

    state = _current.get()
    endpoint = endpoint or _endpoint(url)
    body = body or ""
    error = _clean_text(error) if error else None
    d = described or (describe(source, method, endpoint, params, content_type, body) if (body or ok)
                      else Described(f"{SOURCES.get(source, source)}: {method} {endpoint}", ""))
    if error:
        d.summary = f"Ошибка: {error}" + (f". {d.summary}" if d.summary and d.summary != "Ответ получен" else "")
    elif not ok and status_code:
        d.summary = f"Ответ с ошибкой HTTP {status_code}. " + d.summary

    stored = _clean_text(body) if d.keep_body else None
    truncated = bool(stored and len(stored) > MAX_BODY)
    if truncated:
        stored = stored[:MAX_BODY]

    if state is not None:
        state.requests += 1
        state.failed += 0 if ok and not error else 1
        state.records += d.records or 0
        state.bytes += len(body.encode("utf-8", "ignore")) if body else 0

    try:
        async with _session() as db:
            db.add(SyncRequest(
                run_id=state.id if state else None, source=source, method=method,
                endpoint=endpoint[:300], url=clean_url(url)[:4000], title=d.title[:2000],
                params=_jsonable(params), status_code=status_code, ok=ok and not error,
                duration_ms=duration_ms, response_bytes=len(body.encode("utf-8", "ignore")),
                content_type=content_type[:200], records=d.records, summary=d.summary[:8000],
                fields=d.fields, body=stored, body_truncated=truncated, error=error,
            ))
            await db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[exchange_log] запрос не записан: %s", exc)


class LoggingTransport(httpx.AsyncBaseTransport):
    """Транспорт httpx, который записывает каждый запрос и ответ в журнал."""

    def __init__(self, source: str, inner: httpx.AsyncBaseTransport | None = None):
        self.source = source
        self._inner = inner or httpx.AsyncHTTPTransport()

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        params = _request_params(request)
        t0 = time.monotonic()
        try:
            response = await self._inner.handle_async_request(request)
            await response.aread()
        except Exception as exc:
            await record(source=self.source, method=request.method, url=url, params=params,
                         ok=False, duration_ms=int((time.monotonic() - t0) * 1000),
                         error=f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__)
            raise
        ctype = response.headers.get("content-type", "")
        try:
            body = response.text
        except Exception:  # noqa: BLE001
            body = f"[{len(response.content)} байт, не текст]"
        await record(source=self.source, method=request.method, url=url, params=params,
                     status_code=response.status_code, ok=response.status_code < 400,
                     duration_ms=int((time.monotonic() - t0) * 1000), content_type=ctype, body=body)
        return response

    async def aclose(self) -> None:
        await self._inner.aclose()


def make_client(source: str, **kwargs) -> httpx.AsyncClient:
    """httpx.AsyncClient, чьи запросы попадают в журнал обмена. source: medods / bitrix."""
    return httpx.AsyncClient(transport=LoggingTransport(source), **kwargs)


# ─── Очистка ─────────────────────────────────────────────────

async def cleanup() -> dict:
    from app.models.exchange_log import SyncRequest, SyncRun
    now = _now()
    async with _session() as db:
        r1 = await db.execute(delete(SyncRequest).where(SyncRequest.at < now - timedelta(days=KEEP_REQUEST_DAYS)))
        r2 = await db.execute(delete(SyncRun).where(SyncRun.started_at < now - timedelta(days=KEEP_RUN_DAYS)))
        # сеансы, оборванные перезапуском сервера
        await db.execute(update(SyncRun).where(SyncRun.status == "running",
                                               SyncRun.started_at < now - timedelta(hours=6))
                         .values(status="error", error="Сеанс прервался (сервер перезапускался?)",
                                 finished_at=now))
        await db.commit()
    out = {"requests_deleted": r1.rowcount, "runs_deleted": r2.rowcount}
    logger.info("[exchange_log] очистка: %s", out)
    return out


async def create_tables(engine) -> None:
    from app.db.database import Base
    from app.models import exchange_log as _m  # noqa: F401 — регистрирует таблицы

    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(
            c, tables=[_m.SyncRun.__table__, _m.SyncRequest.__table__]))
        # сеансы, которые шли в момент остановки сервера, больше не идут
        await conn.execute(text(
            "UPDATE sync_runs SET status = 'error', finished_at = now(), "
            "error = 'Сеанс прервался: сервер перезапустился' WHERE status = 'running'"))
