"""
Точки входа для Битрикс24 (локальное серверное приложение).

POST /bitrix/install — Битрикс вызывает один раз при установке приложения.
POST /bitrix/handler — Битрикс вызывает при КАЖДОМ открытии приложения из меню портала
                       и передаёт в теле запроса AUTH_ID (токен текущего пользователя).

Что делает handler:
  1. Спрашивает у САМОГО портала (BITRIX_PORTAL_DOMAIN), кто владелец этого токена.
     Домен берётся из настроек, а не из запроса — подсунуть чужой сервер нельзя.
  2. Ищет этого человека в таблице app_users. Нет в списке → «Доступ ограничен».
  3. Выдаёт наш токен и перенаправляет на сайт: /#t=<токен>
     (после # — часть адреса, которая не уходит на сервер и не попадает в журналы).
"""
import html
import logging
from datetime import datetime, timezone
from urllib.parse import parse_qs

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import ALL_PERMISSIONS
from app.core.security import create_token
from app.db.database import get_db
from app.models.app_user import AccessRequest, AppUser

logger = logging.getLogger(__name__)
router = APIRouter()

_PAGE = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5;}}
.card{{background:#fff;border-radius:8px;padding:32px 40px;
box-shadow:0 2px 8px rgba(0,0,0,.1);text-align:center;max-width:420px;}}
h2{{color:#1a1a1a;margin:0 0 8px;font-size:18px;}}
p{{color:#666;font-size:13px;line-height:1.5;margin:0;}}
</style></head><body><div class="card">{body}</div></body></html>"""


def _denied(title: str, text: str, status: int = 403) -> HTMLResponse:
    body = f"<h2>{html.escape(title)}</h2><p>{html.escape(text)}</p>"
    return HTMLResponse(_PAGE.format(body=body), status_code=status)


async def _read_params(request: Request) -> dict[str, str]:
    """Битрикс шлёт форму (application/x-www-form-urlencoded) + параметры в адресе."""
    raw = (await request.body())[:64_000].decode("utf-8", "ignore")
    form = {k: v[0] for k, v in parse_qs(raw).items() if v}
    return {**dict(request.query_params), **form}


async def _fetch_profile(auth_id: str) -> dict | None:
    """Спросить у портала: чей это токен. Возвращает профиль или None."""
    url = f"https://{settings.BITRIX_PORTAL_DOMAIN}/rest/profile.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params={"auth": auth_id})
    except httpx.HTTPError as exc:
        logger.warning("[bitrix_app] портал не ответил: %s", exc)
        return None
    if resp.status_code != 200:
        logger.warning("[bitrix_app] profile вернул HTTP %s", resp.status_code)
        return None
    try:
        result = resp.json().get("result")
    except ValueError:
        return None
    if isinstance(result, dict) and result.get("ID"):
        return result
    return None


@router.get("/handler")
async def handler_direct():
    """Прямой заход по ссылке (не из Битрикс24)."""
    return _denied(
        "Доступ ограничен",
        "Это приложение доступно только внутри портала Битрикс24. "
        "Откройте его через левое меню.",
    )


@router.post("/handler")
async def handler(request: Request, db: AsyncSession = Depends(get_db)):
    if not settings.SESSION_SECRET or not settings.BITRIX_PORTAL_DOMAIN:
        logger.error("[bitrix_app] не заданы SESSION_SECRET / BITRIX_PORTAL_DOMAIN")
        return _denied("Приложение не настроено", "Обратитесь к администратору.", 503)

    params = await _read_params(request)
    auth_id = params.get("AUTH_ID", "")
    if not auth_id:
        return _denied("Доступ ограничен", "Откройте приложение через портал Битрикс24.")

    profile = await _fetch_profile(auth_id)
    if not profile:
        return _denied("Доступ ограничен", "Не удалось подтвердить вашу учётную запись в Битрикс24.")

    uid = str(profile["ID"])
    name = f"{profile.get('NAME', '')} {profile.get('LAST_NAME', '')}".strip()
    photo = profile.get("PERSONAL_PHOTO")
    avatar = photo if isinstance(photo, str) and photo.startswith("http") else None

    user = await db.get(AppUser, uid)
    # Самый первый вход владельца: создаём ему запись автоматически
    if user is None and settings.OWNER_BITRIX_USER_ID and uid == settings.OWNER_BITRIX_USER_ID:
        user = AppUser(bitrix_user_id=uid, name=name, role="owner",
                       permissions=sorted(ALL_PERMISSIONS), is_active=True)
        db.add(user)
        logger.info("[bitrix_app] создан владелец: id=%s", uid)

    if user is None:
        # Личность подтверждена порталом, но в списке доступа человека нет:
        # оставляем запрос — владелец увидит его в админ-панели и сможет разрешить.
        now = datetime.now(timezone.utc)
        req = await db.get(AccessRequest, uid)
        if req is None:
            db.add(AccessRequest(bitrix_user_id=uid, name=name, avatar_url=avatar,
                                 first_requested_at=now, last_requested_at=now))
        else:
            req.last_requested_at = now
            if name:
                req.name = name
            if avatar:
                req.avatar_url = avatar
        await db.commit()
        logger.warning("[bitrix_app] запрос доступа: id=%s (%s)", uid, name)
        return _denied(
            "Нет доступа",
            "Вас нет в списке пользователей приложения. "
            "Запрос на доступ отправлен администратору.",
        )

    if not user.is_active:
        logger.warning("[bitrix_app] отказ: id=%s (%s) отключён", uid, name)
        return _denied("Доступ отключён", "Ваш доступ к приложению отключён. Обратитесь к администратору.")

    user.last_login_at = datetime.now(timezone.utc)
    if not user.name:
        user.name = name
    if avatar:
        user.avatar_url = avatar
    await db.commit()

    token = create_token(user.bitrix_user_id)
    logger.info("[bitrix_app] вход: id=%s role=%s", uid, user.role)
    return RedirectResponse(url=f"/#t={token}", status_code=303)


@router.api_route("/install", methods=["GET", "POST"])
async def install():
    """Страница установки: сообщает Битрикс24, что установка завершена."""
    return HTMLResponse(
        '<!DOCTYPE html><html><head><meta charset="UTF-8">'
        '<script src="//api.bitrix24.com/api/v1/"></script></head>'
        "<body><p>Установка…</p>"
        "<script>BX24.init(function(){BX24.installFinish();});</script>"
        "</body></html>"
    )


@router.post("/bot-event")
async def bot_event():
    """
    События чат-бота «Пульс» (сообщение боту, приветствие, удаление).
    Портал требует адрес для них при регистрации бота, но бот только присылает
    утреннюю сводку и ни на что не отвечает — поэтому просто подтверждаем приём.
    """
    return {"result": True}
