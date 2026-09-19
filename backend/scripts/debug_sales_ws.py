"""
Отладочный скрипт — показывает все сырые WebSocket сообщения от МедОДС.
Запуск: cd backend && python scripts/debug_sales_ws.py
"""
import asyncio
import json
import sys
from datetime import date

sys.path.insert(0, ".")


async def main():
    from app.core.config import settings
    from app.services.medods import login
    from app.services.sales_collector import _post_sales_report, _ws_connect

    print("=== Логин ===")
    client = await login()
    cookies = dict(client.cookies)

    print("=== POST sales report ===")
    request_id = await _post_sales_report(client, date(2026, 9, 1), date(2026, 9, 18))
    await client.aclose()
    print(f"request_id: {request_id}")

    base = settings.MEDODS_URL.replace("https://", "").replace("http://", "")
    ws_url = f"wss://{base}/_ws"
    cookie_header = "; ".join(f"{k}={v}" for k, v in cookies.items())

    print(f"\n=== WebSocket: {ws_url} ===\n")

    async with _ws_connect(ws_url, cookie_header) as ws:
        # Подписываемся на стандартные каналы
        for channel in ("ReportChannel", "UserChannel"):
            await ws.send(json.dumps({
                "command": "subscribe",
                "identifier": json.dumps({"channel": channel}),
            }))

        private_channel = None
        deadline = asyncio.get_event_loop().time() + 120
        msg_count = 0

        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                print("\n[timeout 120s]")
                break
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            except asyncio.TimeoutError:
                break

            msg_count += 1
            try:
                m = json.loads(raw)
                t = m.get("type", "—")
                identifier = m.get("identifier", "")
                message = m.get("message")

                if t == "ping":
                    print(f"[{msg_count:03d}] ping")
                    continue

                print(f"[{msg_count:03d}] type={t!r} identifier={identifier!r}")
                if message is not None:
                    print(f"       message={json.dumps(message, ensure_ascii=False)[:500]}")

                # Ловим wsid из handshake и подписываемся на приватный канал
                if isinstance(message, dict):
                    meta = message.get("meta", {})
                    wsid = meta.get("wsid")
                    if wsid and wsid != private_channel:
                        private_channel = wsid
                        print(f"\n>>> Найден приватный канал: {wsid}")
                        print(f">>> Подписываемся...\n")
                        await ws.send(json.dumps({
                            "command": "subscribe",
                            "identifier": json.dumps({"channel": wsid}),
                        }))

                    # Смотрим data
                    data = message.get("data")
                    if isinstance(data, str):
                        if data == "eof":
                            print(f"       *** EOF *** meta={meta}")
                        else:
                            try:
                                parsed = json.loads(data)
                                batch = parsed.get("batch", [])
                                print(f"       → batch: {len(batch)} items, "
                                      f"types={list({i.get('type') for i in batch})}")
                                if batch:
                                    print(f"       → первый: {json.dumps(batch[0], ensure_ascii=False)[:300]}")
                            except Exception:
                                print(f"       → data(str): {data[:200]}")

            except Exception as e:
                print(f"[{msg_count:03d}] RAW: {raw[:200]}, error: {e}")

    print(f"\nИтого сообщений: {msg_count}")


if __name__ == "__main__":
    asyncio.run(main())
