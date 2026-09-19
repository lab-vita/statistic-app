"""
Отладочный скрипт v3 — слушаем WS, затем делаем POST.
Цель: увидеть что приходит в ответ на report после подписки.

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

    base = settings.MEDODS_URL.replace("https://", "").replace("http://", "")
    ws_url = f"wss://{base}/_ws"
    cookie_header = "; ".join(f"{k}={v}" for k, v in cookies.items())

    print(f"=== WebSocket: {ws_url} ===\n")

    async with _ws_connect(ws_url, cookie_header) as ws:
        # Подписываемся на стандартные каналы
        for channel in ("ReportChannel", "UserChannel"):
            await ws.send(json.dumps({
                "command": "subscribe",
                "identifier": json.dumps({"channel": channel}),
            }))

        # Ждём handshake (welcome + confirm x2 + handshake сообщения)
        print("Ждём handshake...")
        handshake_done = False
        deadline = asyncio.get_event_loop().time() + 15
        while not handshake_done:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                break
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            m = json.loads(raw)
            t = m.get("type", "—")
            msg = m.get("message", {})
            print(f"  {t} | {json.dumps(msg, ensure_ascii=False)[:200]}")
            # Считаем handshake завершённым когда оба канала прислали handshake
            if isinstance(msg, dict) and msg.get("meta", {}).get("type") == "handshake":
                handshake_done = True

        # Теперь делаем POST
        print("\n=== POST sales report ===")
        request_id = await _post_sales_report(client, date(2026, 9, 1), date(2026, 9, 18))
        print(f"request_id: {request_id}\n")
        print("Слушаем ответ 120 секунд...\n")

        deadline = asyncio.get_event_loop().time() + 120
        msg_count = 0
        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                print("[timeout]")
                break
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            except Exception as e:
                print(f"[WS closed: {e}]")
                break

            msg_count += 1
            m = json.loads(raw)
            t = m.get("type", "—")
            identifier = m.get("identifier", "")
            message = m.get("message")

            if t == "ping":
                print(f"[{msg_count:03d}] ping")
                continue

            # Печатаем всё подробно
            print(f"[{msg_count:03d}] type={t!r}")
            print(f"       identifier={identifier!r}")
            if message is not None:
                print(f"       message={json.dumps(message, ensure_ascii=False)[:600]}")

            # Если data — строка, пробуем распарсить
            if isinstance(message, dict):
                data = message.get("data")
                if data == "eof":
                    print(f"       *** EOF ***")
                    break
                if isinstance(data, str):
                    try:
                        parsed = json.loads(data)
                        batch = parsed.get("batch", [])
                        print(f"       → batch[{len(batch)}] types={list({i.get('type') for i in batch})}")
                        if batch:
                            print(f"       → batch[0]={json.dumps(batch[0], ensure_ascii=False)[:400]}")
                    except Exception:
                        print(f"       → data(str)={data[:200]}")

    await client.aclose()
    print(f"\nГотово, сообщений после POST: {msg_count}")


if __name__ == "__main__":
    asyncio.run(main())
