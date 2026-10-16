"""
Коллектор продаж по номенклатуре через ActionCable WebSocket МедОДС.

Механизм (выяснен через отладку):
  1. Открываем WebSocket wss://.../_ ws
  2. Подписываемся на ReportChannel + UserChannel
  3. Ждём handshake (type=report, meta.type=handshake)
  4. Только ПОСЛЕ handshake делаем POST → получаем request_id
  5. МедОДС шлёт батчи на оба канала одновременно — читаем только ReportChannel
  6. message.data — строка JSON с {"batch": [...]}
  7. Конец — message.data == "eof" с meta.request_id

Важно:
  МедОДС агрегирует данные за весь переданный период.
  Чтобы получить подневную разбивку — вызывать collect_sales за каждый день отдельно.
  backfill.py и scheduler делают это автоматически (итерация по дням).

Зависимости:
  pip install websockets
"""
import asyncio
import json
import logging
import time
from datetime import date

try:
    import websockets
except ImportError:
    raise ImportError("pip install websockets")

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.utils import normalize_service_title
from app.models.sale import Sale
from app.models.service import Service
from app.services import exchange_log
from app.services.medods import login

logger = logging.getLogger(__name__)

_WS_TIMEOUT   = 120   # секунд ждать eof после POST
_WS_URL_PATH  = "/_ws"
_READ_CHANNEL = "ReportChannel"  # UserChannel дублирует — читаем только один


def _fmt_period(d_from: date, d_to: date) -> str:
    MONTHS = ["", "января", "февраля", "марта", "апреля", "мая", "июня",
              "июля", "августа", "сентября", "октября", "ноября", "декабря"]
    def fmt(d: date) -> str:
        return f"{d.day:02d} {MONTHS[d.month]} {d.year}"
    return f"{fmt(d_from)} - {fmt(d_to)}"


def _ws_connect(ws_url: str, cookie_header: str):
    """Подключение к WebSocket. websockets 13.x использует extra_headers."""
    return websockets.connect(
        ws_url,
        extra_headers={"Cookie": cookie_header},
        ping_interval=20,
        ping_timeout=30,
        open_timeout=15,
    )


async def _post_sales_report(client, date_from: date, date_to: date) -> str:
    """POST запрос на генерацию отчёта. Возвращает request_id."""
    resp = await client.post(
        f"{settings.MEDODS_URL}/api/internal/analytics/reports/sales",
        json={
            "report": {
                "period": _fmt_period(date_from, date_to),
                "format": "JSON",
            },
            "limit": 25,
            "offset": 0,
            "sorting": [],
            "analysis_laboratory_ids": [],
            "clinic_ids": [int(settings.MEDODS_CLINIC_ID)],
            "doctor_ids": [],
            "entry_type_category_ids": [],
            "machine_ids": [],
            "by_company": False,
            "company_ids": [],
            "assistant_ids": [],
        },
    )
    if resp.status_code != 200:
        raise Exception(f"sales POST: HTTP {resp.status_code} — {resp.text[:200]}")
    data = resp.json()
    request_id = data.get("request_id")
    if not request_id:
        raise Exception(f"sales POST: нет request_id в ответе: {data}")
    return request_id


async def _collect_via_websocket(client, date_from: date, date_to: date) -> list[dict]:
    """
    Полный цикл: открываем WS → handshake → POST → собираем батчи → eof.
    Возвращает список entry из type="data" батчей.
    """
    base = settings.MEDODS_URL.replace("https://", "").replace("http://", "")
    ws_url = f"wss://{base}{_WS_URL_PATH}"
    cookie_header = "; ".join(f"{k}={v}" for k, v in dict(client.cookies).items())

    entries: list[dict] = []

    async with _ws_connect(ws_url, cookie_header) as ws:

        # Подписываемся на оба канала
        for channel in ("ReportChannel", "UserChannel"):
            await ws.send(json.dumps({
                "command": "subscribe",
                "identifier": json.dumps({"channel": channel}),
            }))

        # Ждём handshake перед POST
        handshake_count = 0
        deadline = asyncio.get_event_loop().time() + 15
        while handshake_count < 1:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                raise Exception("[sales] Timeout ожидания handshake")
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            m = json.loads(raw)
            msg = m.get("message") or {}
            if isinstance(msg, dict) and msg.get("meta", {}).get("type") == "handshake":
                handshake_count += 1
                logger.info("[sales] Handshake получен, делаем POST")

        # POST — только после handshake
        request_id = await _post_sales_report(client, date_from, date_to)
        logger.info("[sales] request_id=%s за %s–%s", request_id, date_from, date_to)

        # Собираем батчи до eof
        seen_eof = False
        deadline = asyncio.get_event_loop().time() + _WS_TIMEOUT
        while not seen_eof:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                raise Exception(f"[sales] Timeout: eof не получен за {_WS_TIMEOUT}с")

            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            m = json.loads(raw)

            if m.get("type") == "ping":
                continue

            # Читаем только ReportChannel чтобы не дублировать
            identifier = m.get("identifier", "")
            if f'"channel": "{_READ_CHANNEL}"' not in identifier \
               and f'"channel":"{_READ_CHANNEL}"' not in identifier:
                continue

            message = m.get("message")
            if not isinstance(message, dict):
                continue

            data = message.get("data")

            # EOF
            if data == "eof":
                if message.get("meta", {}).get("request_id") == request_id:
                    seen_eof = True
                    logger.info("[sales] EOF получен, всего entry: %d", len(entries))
                continue

            # Батч — data это строка JSON
            if isinstance(data, str):
                try:
                    batch_obj = json.loads(data)
                except json.JSONDecodeError:
                    continue
                for item in batch_obj.get("batch", []):
                    if item.get("type") == "data":
                        entry = item.get("data", {}).get("entry", {})
                        if entry:
                            entries.append(entry)

    return entries


async def _resolve_service_id(db: AsyncSession, title_normalized: str) -> int | None:
    """
    Ищет service_id по нормализованному названию.
    Сначала точное совпадение, затем совпадение после нормализации services.title.
    """
    # Точное совпадение (большинство случаев после нормализации)
    row = await db.scalar(
        select(Service).where(Service.title == title_normalized)
    )
    if row:
        return row.id

    # Нормализуем справочник на лету для оставшихся случаев
    # (когда в services.title тоже есть пробел в конце или кириллица)
    from sqlalchemy import func, text
    result = await db.execute(
        select(Service.id, Service.title)
    )
    for svc_id, svc_title in result:
        if normalize_service_title(svc_title) == title_normalized:
            return svc_id
    return None


async def collect_sales(db: AsyncSession, date_from: date, date_to: date) -> dict:
    """
    Собирает продажи по номенклатуре за период через WebSocket.

    МедОДС возвращает агрегат за весь период — для подневной разбивки
    вызывать этот метод за каждый день отдельно (date_from == date_to).
    Записи сохраняются с sale_date=date_from.

    Возвращает: {"fetched": N, "created": N, "updated": N}
    """
    client = await login()
    stats = {"fetched": 0, "created": 0, "updated": 0}

    ws_url = settings.MEDODS_URL.replace("https://", "wss://").replace("http://", "ws://") + _WS_URL_PATH
    title = f"Продажи по услугам за {_fmt_period(date_from, date_to)} (данные по WebSocket)"
    t0 = time.monotonic()
    try:
        entries = await _collect_via_websocket(client, date_from, date_to)
    except Exception as exc:
        await exchange_log.record(
            source="medods", method="WS", url=ws_url, endpoint="/_ws (ReportChannel)", ok=False,
            duration_ms=int((time.monotonic() - t0) * 1000), error=f"{type(exc).__name__}: {exc}",
            described=exchange_log.Described(title, ""))
        raise
    finally:
        await client.aclose()

    total = sum(float(e.get("finalSum") or 0) for e in entries)
    await exchange_log.record(
        source="medods", method="WS", url=ws_url, endpoint="/_ws (ReportChannel)",
        duration_ms=int((time.monotonic() - t0) * 1000), content_type="application/json",
        body=json.dumps(entries, ensure_ascii=False, indent=1),
        described=exchange_log.Described(
            title,
            f"Строк услуг: {len(entries)}, итого к оплате {total:,.0f} ₽".replace(",", " "),
            len(entries), exchange_log.fields_of(entries)))

    stats["fetched"] = len(entries)
    logger.info("[sales] Получено %d записей за %s", len(entries), date_from)

    for entry in entries:
        raw_title = (entry.get("title") or "").strip()
        if not raw_title:
            continue

        # Нормализуем перед сохранением и матчингом
        title = normalize_service_title(raw_title)

        # Ищем service_id по нормализованному названию
        service_id = await _resolve_service_id(db, title)

        # exclude_from_analytics: берём из services если нашли, иначе False
        exclude = False
        if service_id:
            svc = await db.get(Service, service_id)
            exclude = bool(svc.exclude_from_analytics) if svc else False

        existing = await db.scalar(
            select(Sale).where(
                and_(Sale.sale_date == date_from, Sale.service_title == title)
            )
        )

        vals = {
            "service_id":             service_id,
            "exclude_from_analytics": exclude,
            "amount":                 int(entry.get("amount", 0) or 0),
            "total_sum":              float(entry.get("sum", 0.0) or 0.0),
            "final_sum":              float(entry.get("finalSum", 0.0) or 0.0),
            "sum_percent":            float(entry.get("sumPercent", 0.0) or 0.0),
            "unit":                   (entry.get("measureUnitShortTitle") or "").strip() or None,
        }

        if existing:
            for k, v in vals.items():
                setattr(existing, k, v)
            stats["updated"] += 1
        else:
            db.add(Sale(sale_date=date_from, service_title=title, **vals))
            stats["created"] += 1

    await db.commit()
    logger.info("[sales] Создано: %d, Обновлено: %d", stats["created"], stats["updated"])
    return stats
