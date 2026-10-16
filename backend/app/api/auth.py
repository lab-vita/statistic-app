from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.app_user import AppUser

router = APIRouter()


@router.get("/me")
async def me(user: CurrentUser = Depends(current_user)):
    """Кто сейчас вошёл и что ему можно. Фронтенд по этому решает, что показывать."""
    return {
        "id": user.id,
        "name": user.name,
        "role": user.role,
        "role_label": user.role_label or user.role,
        "avatar": user.avatar,
        "permissions": sorted(user.permissions),
        "tour_version": user.tour_version,
    }


class TourSeen(BaseModel):
    version: int = Field(ge=1, le=1000)


@router.post("/tour")
async def tour_seen(body: TourSeen, user: CurrentUser = Depends(current_user),
                    db: AsyncSession = Depends(get_db)):
    """
    Сотрудник прошёл или закрыл обучающий тур — больше не запускать его сам.
    Хранится у пользователя, поэтому действует на любом компьютере и в любом браузере.
    """
    if settings.AUTH_DISABLED:
        return {"ok": True, "tour_version": body.version}
    row = await db.get(AppUser, user.id)
    if row is not None and (row.tour_version or 0) < body.version:
        row.tour_version = body.version
        await db.commit()
    return {"ok": True, "tour_version": body.version}
