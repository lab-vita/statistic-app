"""
Коллектор продаж по номенклатуре через ActionCable WebSocket МедОДС.

Механизм:
  1. POST /api/internal/analytics/reports/sales → {request_id}
  2. Сервер шлёт данные батчами через WebSocket (wss://.../_ ws)
     на канал по протоколу ActionCable
  3. Каждый батч — список batch[] с type="data" | type="total"
  4. Конец — сообщение data="eof" с meta.request_id

Зависимости:
  pip install websockets  (уже есть в большинстве сред)
"""
import asyncio
import json
import logging
from datetime import date, timedelta
from typing import AsyncIterator

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

# ActionCable каналы з которых приходят данные
_REPORT_CHANNELS = {'{"channel":"ReportChannel"}', '{"channel":"UserChannel"}'}
_WS_TIMEOUT = 60  # секунд ждать eof
_WS_URL_PATH = "/_ws"


def _fmt_period(d_from: date, d_to: date) -> str:
    MONTHS = ["", "января", "февраля", "марта", "апреля", "мая", "июня",
              "июля", "августа", "сентября", "октября", "ноября", "декабря"]
    def fmt(d: date) -> str:
        return f"{d.day:02d} {MONTHS[d.month]} {d.year}"
    return f"{fmt(d_from)} - {fmt(d_to)}"


async def _post_sales_report(
    client,
    date_from: date,
    date_to: date,
) -> str:
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


async def _collect_via_websocket(
    cookies: dict,
    request_id: str,
) -> list[dict]:
    """
    Подключается к ActionCable WebSocket, ждёт батчи с данными
    до получения eof. Возвращает список записей entry.
    """
    # Базовый URL без https://
    base = settings.MEDODS_URL.replace("https://", "").replace("http://", "")
    ws_url = f"wss://{base}{_WS_URL_PATH}"

    # Cookie для авторизации
    cookie_header = "; ".join(f"{k}={v}" for k, v in cookies.items())

    entries: list[dict] = []
    seen_eof = False

    async with websockets.connect(
        ws_url,
        extra_headers={"Cookie": cookie_header},
        ping_interval=20,
        ping_timeout=30,
        open_timeout=15,
    ) as ws:
        # ActionCable handshake: ждём welcome
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        if msg.get("type") != "welcome":
            raise Exception(f"ActionCable: ожидал welcome, получил: {msg}")

        # Подписываемся на оба канала
        for channel in ("ReportChannel", "UserChannel"):
            await ws.send(json.dumps({
                "command": "subscribe",
                "identifier": json.dumps({"channel": channel}),
            }))

        # Ждём подтверждения подписок
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

        # Собираем сообщения до eof
        deadline = asyncio.get_event_loop().time() + _WS_TIMEOUT
        while not seen_eof:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                raise Exception(f"[sales] Timeout: eof не получен за {_WS_TIMEOUT}с")

            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            except asyncio.TimeoutError:
                raise Exception(f"[sales] WebSocket timeout при ожидании батча")

            m = json.loads(raw)

            # Пропускаем ping и прочее
            if m.get("type") in ("ping", "welcome", "confirm_subscription"):
                continue

            identifier = m.get("identifier", "")
            # Обрабатываем только ReportChannel (UserChannel дублирует данные)
            if '"ReportChannel"' not in identifier:
                continue

            message = m.get("message", {})
            if not isinstance(message, dict):
                continue

            data = message.get("data")

            # eof — конец передачи
            if data == "eof":
                meta = message.get("meta", {})
                if meta.get("request_id") == request_id:
                    seen_eof = True
                    logger.info(f"[sales] Получен eof для request_id={request_id}")
                continue

            # Батч данных
            if isinstance(data, str):
                try:
                    batch_obj = json.loads(data)
                except json.JSONDecodeError:
                    continue
                batch = batch_obj.get("batch", [])
                for item in batch:
                    if item.get("type") == "data":
                        entry = item.get("data", {}).get("entry", {})
                        if entry:
                            entries.append(entry)

    return entries


async def collect_sales(
    db: AsyncSession,
    date_from: date,
    date_to: date,
) -> dict:
    """
    Собирает продажи по номенклатуре за период через WebSocket.

    Важно: один запрос = весь период. Не делить на дни!
    Данные приходят агрегированные за весь период,
    поэтому сохраняем как sale_date=date_from.

    Возвращает: {"fetched": N, "created": N, "updated": N}
    """
    client = await login()
    stats = {"fetched": 0, "created": 0, "updated": 0}

    try:
        # Извлекаем куки из httpx-клиента для WS
        cookies = dict(client.cookies)

        # POST → request_id
        request_id = await _post_sales_report(client, date_from, date_to)
        logger.info(f"[sales] request_id={request_id} за {date_from}–{date_to}")

    finally:
        await client.aclose()

    # Получаем данные через WebSocket
    entries = await _collect_via_websocket(cookies, request_id)
    stats["fetched"] = len(entries)
    logger.info(f"[sales] Получено {len(entries)} записей продаж")

    # Upsert: ключ (sale_date, service_title)
    # Используем date_from как дату периода для простоты.
    # Для ежедневного сбора date_from == date_to.
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
