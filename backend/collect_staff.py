# backend/collect_staff.py
# Запуск из папки backend: python collect_staff.py
#
# Результат: all_staff.json — все активные сотрудники клиники №1
# Используются те же настройки из .env что и в основном приложении

import asyncio
import httpx
import re
import json
from app.core.config import settings


async def login() -> httpx.AsyncClient:
    """Авторизация в МедОДС — точно как в medods.py."""
    client = httpx.AsyncClient(
        headers={
            "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "ru,en;q=0.9",
        },
        follow_redirects=True,
        timeout=30,
    )

    resp = await client.get(
        f"{settings.MEDODS_URL}/users/sign_in",
        headers={"Accept": "text/html,application/xhtml+xml,*/*"},
    )

    token = None
    for pattern in [
        r'<input[^>]+name=["\']authenticity_token["\'][^>]+value=["\']([^"\']+)["\']',
        r'<input[^>]+value=["\']([^"\']+)["\'][^>]+name=["\']authenticity_token["\']',
        r'"csrf-token"\s+content="([^"]+)"',
    ]:
        m = re.search(pattern, resp.text)
        if m:
            token = m.group(1)
            break

    if not token:
        raise Exception("Не удалось получить CSRF-токен")

    await client.post(
        f"{settings.MEDODS_URL}/users/sign_in",
        data={
            "authenticity_token": token,
            "user[username]":     settings.MEDODS_USERNAME,
            "user[password]":     settings.MEDODS_PASSWORD,
        },
        headers={
            "Accept":           "application/json",
            "Referer":          f"{settings.MEDODS_URL}/users/sign_in",
            "Origin":           settings.MEDODS_URL,
            "X-Requested-With": "XMLHttpRequest",
        },
    )

    print("✓ Авторизован")
    return client


async def get_all_user_ids(client: httpx.AsyncClient) -> list[int]:
    """Собирает все id сотрудников со всех страниц пагинации."""
    ids = []
    page = 1

    while True:
        resp = await client.get(
            f"{settings.MEDODS_URL}/users",
            params={"page": page},
            headers={"Accept": "text/html,application/xhtml+xml,*/*"},
        )
        found = re.findall(r'data-href="/users/(\d+)/edit"', resp.text)
        if not found:
            break

        ids.extend(int(i) for i in found)
        print(f"  Страница {page}: +{len(found)} сотрудников")

        # Проверяем есть ли следующая страница
        if f'href="/users?page={page + 1}"' not in resp.text:
            break

        page += 1
        await asyncio.sleep(0.3)

    print(f"✓ Всего ID: {len(ids)}")
    return ids


async def get_user_data(client: httpx.AsyncClient, user_id: int) -> dict | None:
    """Получает полные данные сотрудника из gon.specific.user."""
    resp = await client.get(
        f"{settings.MEDODS_URL}/users/{user_id}/edit",
        headers={"Accept": "text/html,application/xhtml+xml,*/*"},
    )

    m = re.search(r'gon\.specific\s*=\s*(\{.*?\});\s*//\]\]>', resp.text, re.DOTALL)
    if not m:
        print(f"  ⚠ Не удалось распарсить gon.specific для id={user_id}")
        return None

    try:
        data = json.loads(m.group(1))
        return data.get("user")
    except Exception as e:
        print(f"  ⚠ JSON ошибка для id={user_id}: {e}")
        return None


async def main():
    client = await login()

    # Шаг 1: собираем все ID со всех страниц
    all_ids = await get_all_user_ids(client)

    # Шаг 2: заходим на каждого и берём полные данные
    users = []
    for i, uid in enumerate(all_ids):
        user = await get_user_data(client, uid)
        if not user:
            continue

        # Фильтр: только активные (user_status_id=1) из клиники №1
        if user.get("user_status_id") != 1:
            print(f"  [{i+1}/{len(all_ids)}] ПРОПУСК (уволен): {user.get('full_name')}")
            continue
        if settings.MEDODS_CLINIC_ID not in user.get("clinic_ids", []):
            print(f"  [{i+1}/{len(all_ids)}] ПРОПУСК (другая клиника): {user.get('full_name')}")
            continue

        users.append(user)
        print(f"  [{i+1}/{len(all_ids)}] ✓ {user.get('full_name')} — {user.get('specialties_titles')}")
        await asyncio.sleep(0.2)

    await client.aclose()

    # Шаг 3: сохраняем результат
    with open("all_staff.json", "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Готово. Сохранено {len(users)} сотрудников → all_staff.json")


if __name__ == "__main__":
    asyncio.run(main())
