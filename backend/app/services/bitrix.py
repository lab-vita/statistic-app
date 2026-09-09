import httpx
import asyncio
from datetime import date
from app.core.config import settings

async def fetch_calls_for_number(client, number, date_from, date_to):
    seen, all_calls, start = set(), [], 0
    while True:
        for attempt in range(5):
            try:
                resp = await client.post(
                    settings.BITRIX_WEBHOOK_URL + "voximplant.statistic.get",
                    json={
                        "FILTER": {
                            ">=CALL_START_DATE": f"{date_from}T00:00:00+03:00",
                            "<=CALL_START_DATE": f"{date_to}T23:59:59+03:00",
                            "PORTAL_NUMBER": number,
                        },
                        "SORT": "ID", "ORDER": "ASC", "start": start,
                    },
                    timeout=60,
                )
                data = resp.json()
                break
            except Exception:
                await asyncio.sleep(2 ** attempt)
        else:
            break

        for c in data.get("result", []):
            if c.get("ID") not in seen:
                seen.add(c.get("ID"))
                all_calls.append(c)

        nxt = data.get("next")
        if nxt is None:
            break
        start = nxt
        await asyncio.sleep(2)

    return all_calls

async def fetch_all_calls(date_from: date, date_to: date) -> list[dict]:
    seen, result = set(), []
    async with httpx.AsyncClient() as client:
        for number in settings.LABVITA_NUMBERS:
            for c in await fetch_calls_for_number(client, number, date_from, date_to):
                if c.get("ID") not in seen:
                    seen.add(c.get("ID"))
                    result.append(c)
    return result

def classify_call(call: dict) -> dict:
    ctype = str(call.get("CALL_TYPE", ""))
    code  = str(call.get("CALL_FAILED_CODE", ""))
    return {
        "is_incoming": ctype == "2" and code == "200",
        "is_outgoing": ctype == "1",
        "is_missed":   ctype == "2" and code == "304",
    }