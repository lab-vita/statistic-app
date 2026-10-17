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


# ─── Раскладка главной ───────────────────────────────────────────

class PlacedWidget(BaseModel):
    id:     str = Field(min_length=1, max_length=64)
    type:   str = Field(min_length=1, max_length=40)
    x:      int = Field(ge=0, le=11)
    y:      int = Field(ge=0, le=1000)
    w:      int = Field(ge=1, le=12)
    h:      int = Field(ge=1, le=20)
    config: dict[str, str] | None = None


class HomeLayout(BaseModel):
    # None — сбросить на раскладку по умолчанию
    layout: list[PlacedWidget] | None = Field(default=None, max_length=200)


# Без входа (AUTH_DISABLED, только локальная разработка) строки пользователя нет —
# раскладка живёт в памяти до перезапуска.
_dev_layout: dict[str, list | None] = {"layout": None}


@router.get("/home-layout")
async def get_home_layout(user: CurrentUser = Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
    """Виджеты главной сотрудника. null — не настраивал, показывается раскладка по умолчанию."""
    if settings.AUTH_DISABLED:
        return {"layout": _dev_layout["layout"]}
    row = await db.get(AppUser, user.id)
    return {"layout": row.home_layout if row is not None else None}


@router.put("/home-layout")
async def put_home_layout(body: HomeLayout, user: CurrentUser = Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
    """Сохранить раскладку главной — она будет одинаковой на любом компьютере и в любом браузере."""
    layout = [w.model_dump(exclude_none=True) for w in body.layout] if body.layout is not None else None
    if settings.AUTH_DISABLED:
        _dev_layout["layout"] = layout
        return {"ok": True}
    row = await db.get(AppUser, user.id)
    if row is not None:
        row.home_layout = layout
        await db.commit()
    return {"ok": True}
