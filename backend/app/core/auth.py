"""
Проверка «кто пришёл» для всех /api/* эндпоинтов.

Токен берётся из заголовка  Authorization: Bearer <token>.
При КАЖДОМ запросе пользователь перепроверяется по таблице app_users —
поэтому отключение сотрудника или смена его роли действуют сразу,
а не после истечения токена.
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import verify_token
from app.db.database import get_db
from app.models.app_user import AppUser


@dataclass
class CurrentUser:
    id: str
    name: str
    role: str


async def current_user(request: Request, db: AsyncSession = Depends(get_db)) -> CurrentUser:
    if settings.AUTH_DISABLED:
        return CurrentUser(id="0", name="dev", role="owner")

    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    user_id = verify_token(token) if scheme.lower() == "bearer" else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Требуется вход через Битрикс24")

    user = await db.get(AppUser, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Доступ запрещён")

    return CurrentUser(id=user.bitrix_user_id, name=user.name, role=user.role)


def require_roles(*roles: str):
    """Задел под ролевую модель: Depends(require_roles("owner", "admin"))."""
    async def checker(user: CurrentUser = Depends(current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return user
    return checker
