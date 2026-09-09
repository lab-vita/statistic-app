import httpx
import re
import json
from datetime import date
from app.core.config import settings


async def login() -> httpx.AsyncClient:
    """Авторизуется в МедОДС и возвращает готовый клиент с куками."""
    client = httpx.AsyncClient(
        headers={
            "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "ru,en;q=0.9",
        },
        follow_redirects=True,
        timeout=30,
    )

    # Шаг 1 — GET страницы входа
    resp = await client.get(
        f"{settings.MEDODS_URL}/users/sign_in",
        headers={"Accept": "text/html,application/xhtml+xml,*/*"},
    )

    # Извлекаем authenticity_token
    token = None
    for pattern in [
        r'<input[^>]+name=["\']authenticity_token["\'][^>]+value=["\']([^"\']+)["\']',
        r'<input[^>]+value=["\']([^"\']+)["\'][^>]+name=["\']authenticity_token["\']',
        r'"csrf-token"\s+content="([^"]+)"',
        r'content="([^"]+)"[^>]+name="csrf-token"',
    ]:
        m = re.search(pattern, resp.text)
        if m:
            token = m.group(1)
            break

    if not token:
        raise Exception("Не удалось получить CSRF-токен со страницы входа МедОДС")

    # Шаг 2 — POST авторизации
    resp2 = await client.post(
        f"{settings.MEDODS_URL}/users/sign_in",
        data={
            "authenticity_token": token,
            "user[username]":     settings.MEDODS_USERNAME,
            "user[password]":     settings.MEDODS_PASSWORD,
        },
        headers={
            "Accept":             "application/json",
            "Referer":            f"{settings.MEDODS_URL}/users/sign_in",
            "Origin":             settings.MEDODS_URL,
            "X-Requested-With":   "XMLHttpRequest",
        },
    )

    if resp2.status_code != 200:
        raise Exception(f"Ошибка авторизации МедОДС: {resp2.status_code}")

    # Шаг 3 — получаем свежий CSRF после логина
    resp3 = await client.get(
        f"{settings.MEDODS_URL}/",
        headers={"Accept": "text/html,application/xhtml+xml,*/*"},
    )

    csrf = None
    for pattern in [
        r'<meta[^>]+name=["\']csrf-token["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']csrf-token["\']',
        r'"csrfToken"\s*:\s*"([^"]+)"',
    ]:
        m = re.search(pattern, resp3.text)
        if m:
            csrf = m.group(1)
            break

    if not csrf:
        raise Exception("Не удалось получить свежий CSRF-токен после логина")

    # Устанавливаем заголовки для API-запросов
    client.headers.update({
        "Accept":           "application/json",
        "Content-Type":     "application/json",
        "Origin":           settings.MEDODS_URL,
        "Referer":          f"{settings.MEDODS_URL}/reports/doctor_appointments",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRF-Token":     csrf,
        "sec-fetch-dest":   "empty",
        "sec-fetch-mode":   "cors",
        "sec-fetch-site":   "same-origin",
    })

    return client


async def fetch_appointments(
    client: httpx.AsyncClient,
    date_from: date,
    date_to: date,
) -> list[dict]:
    """Забирает все записи на приём за период."""
    all_records, offset, total = [], 0, None
    limit = 100

    while True:
        resp = await client.post(
            f"{settings.MEDODS_URL}/reports/doctor_appointments_report",
            json={
                "report":               {"period": ""},
                "clinicIds":            [settings.MEDODS_CLINIC_ID],
                "createdDate":          [str(date_from), str(date_to)],
                "appointmentByDms":     "",
                "appointmentSourceIds": [],
                "appointmentStatuses":  [],
                "appointmentTypeIds":   [],
                "attractionSourceIds":  [],
                "clientGroupIds":       [],
                "newPatients":          False,
                "sorting":              [],
                "limit":                limit,
                "offset":               offset,
            },
        )

        if resp.status_code != 200:
            raise Exception(f"Ошибка запроса МедОДС: {resp.status_code} — {resp.text[:200]}")

        data     = resp.json()
        total    = total or data.get("count", 0)
        batch    = data.get("data", [])

        if not batch:
            break

        all_records.extend(batch)
        offset += limit

        if len(all_records) >= total:
            break

    return all_records