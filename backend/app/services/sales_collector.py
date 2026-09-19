"""
Коллектор продаж по номенклатуре через ActionCable WebSocket МедОДС.

Механизм:
  1. POST /api/internal/analytics/reports/sales → {request_id}
  2. Сервер шлёт данные батчами через WebSocket (wss://.../_ ws)
     на канал по протоколу ActionCable
  3. Каждый батч — список batch[] с type="data" | type="total"
  4. Конец — сообщение data="eof" с meta.request_id

Зависимости:
  pip install websockets
"""
import asyncio
import json
import logging
from datetime import date

try:
    import websockets
except ImportError:
    raise ImportError("pip install websockets")

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.sale import Sale
from app.services.medods import login

logger = logging.getLogger(__name__)

_WS_TIMEOUT  = 60   # секунд ждать eof
_WS_URL_PATH = "/_ws"


def _fmt_period(d_from: date, d_to: date) -> str:
    MONTHS = ["", "января", "февраля", "марта", "апреля", "мая", "июня",
              "июля", "августа", "сентября", "октября", "ноября", "декабря"]
    def fmt(d: date) -> str:
        return f"{d.day:02d} {MONTHS[d.month]} {d.year}"
    return f"{fmt(d_from)} - {fmt(d_to)}"


def _ws_connect(ws_url: str, cookie_header: str):
    """
    Совместимый вызов websockets.connect для разных версий библиотеки:
      < 10.x  — extra_headers
      >= 10.x — additional_headers
    """
    ver = tuple(int(x) for x in websockets.__version__.split(".")[:2])
    header_key = "additional_headers" if ver >= (10, 0) else "extra_headers"
    return websockets.connect(
        ws_url,
        ping_interval=20,
        ping_timeout=30,
        open_timeout=15,
        **{header_key: {"Cookie": cookie_header}},
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


async def _collect_via_websocket(cookies: dict, request_id: str) -> list[dict]:
    """
    Подключается к ActionCable WebSocket, собирает батчи до eof.
    Возвращает список entry из type="data" батчей.
    """
    base = settings.MEDODS_URL.replace("https://", "").replace("http://", "")
    ws_url = f"wss://{base}{_WS_URL_PATH}"
    cookie_header = "; ".join(f"{k}={v}" for k, v in cookies.items())

    entries: list[dict] = []
    seen_eof = False

    async with _ws_connect(ws_url, cookie_header) as ws:
        # Ждём welcome
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        if msg.get("type") != "welcome":
            raise Exception(f"ActionCable: ожидал welcome, получил: {msg}")

        # Подписываемся на оба канала
        for channel in ("ReportChannel", "UserChannel"):
            await ws.send(json.dumps({
                "command": "subscribe",
                "identifier": json.dumps({"channel": channel}),
            }))

        # Ждём подтверждений
        confirmed = set()
        deadline = asyncio.get_event_loop().time() + 15
        while len(confirmed) < 2:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                break
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            m = json.loads(raw)
            if m.get("type") == "confirm_subscription":
                confirmed.add(m.get("identifier", ""))

        logger.info(f"[sales] WebSocket подписки подтверждены: {confirmed}")

        # Собираем до eof
        deadline = asyncio.get_event_loop().time() + _WS_TIMEOUT
        while not seen_eof:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                raise Exception(f"[sales] Timeout: eof не получен за {_WS_TIMEOUT}с")

            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            m = json.loads(raw)

            if m.get("type") in ("ping", "welcome", "confirm_subscription"):
                continue

            # Обрабатываем только ReportChannel
            if '"ReportChannel"' not in m.get("identifier", ""):
                continue

            message = m.get("message", {})
            if not isinstance(message, dict):
                continue

            data = message.get("data")

            if data == "eof":
                if message.get("meta", {}).get("request_id") == request_id:
                    seen_eof = True
                    logger.info(f"[sales] Получен eof для request_id={request_id}")
                continue

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


async def collect_sales(db: AsyncSession, date_from: date, date_to: date) -> dict:
    """
    Собирает продажи по номенклатуре за период через WebSocket.

    Один запрос = весь период (данные агрегированы МедОДС).
    Сохраняем с sale_date=date_from.

    Возвращает: {"fetched": N, "created": N, "updated": N}
    """
    client = await login()
    stats = {"fetched": 0, "created": 0, "updated": 0}

    try:
        cookies = dict(client.cookies)
        request_id = await _post_sales_report(client, date_from, date_to)
        logger.info(f"[sales] request_id={request_id} за {date_from}–{date_to}")
    finally:
        await client.aclose()

    entries = await _collect_via_websocket(cookies, request_id)
    stats["fetched"] = len(entries)
    logger.info(f"[sales] Получено {len(entries)} записей продаж")

    for entry in entries:
        title = (entry.get("title") or "").strip()
        if not title:
            continue

        existing = await db.scalar(
            select(Sale).where(
                and_(Sale.sale_date == date_from, Sale.service_title == title)
            )
        )

        vals = {
            "amount":      int(entry.get("amount", 0) or 0),
            "total_sum":   float(entry.get("sum", 0.0) or 0.0),
            "final_sum":   float(entry.get("finalSum", 0.0) or 0.0),
            "sum_percent": float(entry.get("sumPercent", 0.0) or 0.0),
            "unit":        (entry.get("measureUnitShortTitle") or "").strip() or None,
        }

        if existing:
            for k, v in vals.items():
                setattr(existing, k, v)
            stats["updated"] += 1
        else:
            db.add(Sale(sale_date=date_from, service_title=title, **vals))
            stats["created"] += 1

    await db.commit()
    logger.info(f"[sales] Создано: {stats['created']}, Обновлено: {stats['updated']}")
    return stats
