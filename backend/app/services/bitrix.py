import httpx
import asyncio
from datetime import date
from app.core.config import settings

_PAGE_SIZE = 50   # Лимит Bitrix API
_RETRY_ATTEMPTS = 5


async def fetch_calls_for_number(
    client: httpx.AsyncClient,
    number: str,
    date_from: date,
    date_to: date,
) -> list[dict]:
    """Загружает все звонки за номер с пагинацией."""
    seen: set     = set()
    all_calls: list = []
    start = 0

    while True:
        for attempt in range(_RETRY_ATTEMPTS):
            try:
                resp = await client.post(
                    settings.BITRIX_WEBHOOK_URL + "voximplant.statistic.get",
                    json={
                        "FILTER": {
                            ">=CALL_START_DATE": f"{date_from}T00:00:00+07:00",
                            "<=CALL_START_DATE": f"{date_to}T23:59:59+07:00",
                            "PORTAL_NUMBER": number,
                        },
                        "SORT": "ID",
                        "ORDER": "ASC",
                        "start": start,
                    },
                    timeout=60,
                )
                resp.raise_for_status()
                data = resp.json()
                break
            except Exception:
                if attempt == _RETRY_ATTEMPTS - 1:
                    raise
                await asyncio.sleep(2 ** attempt)  # Только при ошибке

        for c in data.get("result", []):
            cid = c.get("ID")
            if cid not in seen:
                seen.add(cid)
                all_calls.append(c)

        nxt = data.get("next")
        if nxt is None:
            break
        start = nxt
        # Без sleep между страницами — Bitrix выдерживает 50 RPS

    return all_calls


async def fetch_all_calls(date_from: date, date_to: date) -> list[dict]:
    """Загружает звонки по всем номерам клиники параллельно."""
    async with httpx.AsyncClient() as client:
        tasks = [
            fetch_calls_for_number(client, number, date_from, date_to)
            for number in settings.LABVITA_NUMBERS
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    seen: set     = set()
    all_calls: list = []
    for res in results:
        if isinstance(res, Exception):
            continue
        for c in res:
            cid = c.get("ID")
            if cid not in seen:
                seen.add(cid)
                all_calls.append(c)

    return all_calls


def classify_call(call: dict) -> dict:
    ctype = str(call.get("CALL_TYPE", ""))
    code  = str(call.get("CALL_FAILED_CODE", ""))
    return {
        "is_incoming": ctype == "2" and code == "200",
        "is_outgoing": ctype == "1",
        "is_missed":   ctype == "2" and code == "304",
    }
