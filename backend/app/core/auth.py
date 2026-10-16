"""
Проверка «кто пришёл» и «что ему можно» для всех /api/* эндпоинтов.

Токен берётся из заголовка  Authorization: Bearer <token>.
При КАЖДОМ запросе пользователь и его права перечитываются из таблицы app_users —
поэтому отключение сотрудника или смена прав действуют сразу, а не после
истечения токена.

Ответы:  401 — не вошёл / отключён;  403 — вошёл, но права на это нет.
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import ALL_PERMISSIONS, effective_permissions
from app.core.security import verify_token
from app.db.database import get_db
from app.models.app_user import AppRole, AppUser


@dataclass
class CurrentUser:
    id: str
    name: str
    role: str
    permissions: frozenset[str]
    role_label: str = ""
    avatar: str | None = None
    # пройденная версия обучающего тура; None — ещё не видел
    tour_version: int | None = None

    @property
    def is_owner(self) -> bool:
        return self.role == "owner"

    def has_any(self, *perms: str) -> bool:
        return self.is_owner or any(p in self.permissions for p in perms)


async def current_user(request: Request, db: AsyncSession = Depends(get_db)) -> CurrentUser:
    if settings.AUTH_DISABLED:
        return CurrentUser(id="0", name="dev", role="owner", permissions=ALL_PERMISSIONS, role_label="Владелец")

    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    user_id = verify_token(token) if scheme.lower() == "bearer" else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Требуется вход через Битрикс24")

    user = await db.get(AppUser, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Доступ запрещён")

    role = await db.get(AppRole, user.role)
    return CurrentUser(
        id=user.bitrix_user_id,
        name=user.name,
        role=user.role,
        permissions=effective_permissions(user.role, user.permissions,
                                          role.permissions if role else None),
        role_label=role.name if role else user.role,
        avatar=user.avatar_url,
        tour_version=user.tour_version,
    )


def require_any(*perms: str):
    """
    Зависимость: пускает, если у пользователя есть ХОТЯ БЫ ОДНО из перечисленных прав.
    Владелец проходит всегда.   Пример:  Depends(require_any("view:calls", "view:reports"))
    """
    async def checker(user: CurrentUser = Depends(current_user)) -> CurrentUser:
        if not user.has_any(*perms):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return user
    return checker
