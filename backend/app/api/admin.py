"""
Админ-панель: кому можно открывать приложение и с какими правами.

Все адреса требуют права users:manage (см. main.py). Дополнительно действуют правила,
которые не дают запереть себя или повысить себя:

  • свои собственные права менять нельзя (иначе легко отключить себя по ошибке);
  • записи владельцев меняет только владелец;
  • выдать роль владельца или право «Управлять доступом» может только владелец;
  • нельзя выдать право, которого нет у самого выдающего.
"""
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, current_user
from app.core.permissions import (
    ALL_PERMISSIONS,
    DEFAULT_ROLE,
    OWNER_ONLY_PERMISSIONS,
    PERMISSIONS,
    ROLES,
    effective_permissions,
    role_permissions,
)
from app.db.database import get_db
from app.models.app_user import AccessRequest, AppUser
from app.services import digest
from app.services.scheduler import schedule_digest

router = APIRouter()

_ID_RE = re.compile(r"^\d{1,12}$")


# ─── Схемы ──────────────────────────────────────────────────

class UserCreate(BaseModel):
    bitrix_user_id: str
    name: str = Field(default="", max_length=200)
    role: str = DEFAULT_ROLE
    permissions: list[str] | None = None      # не указано → берётся шаблон роли


class UserPatch(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    role: str | None = None
    permissions: list[str] | None = None
    is_active: bool | None = None


class ApproveIn(BaseModel):
    role: str = DEFAULT_ROLE
    permissions: list[str] | None = None


# ─── Помощники ──────────────────────────────────────────────

def _user_out(u: AppUser) -> dict:
    return {
        "id": u.bitrix_user_id,
        "name": u.name,
        "role": u.role,
        "permissions": sorted(effective_permissions(u.role, u.permissions)),
        "is_active": u.is_active,
        "created_at": u.created_at,
        "last_login_at": u.last_login_at,
    }


def _check_role(role: str) -> None:
    if role not in ROLES:
        raise HTTPException(422, f"Неизвестная роль: {role}")


def _check_perms(perms: list[str]) -> list[str]:
    unknown = sorted(set(perms) - ALL_PERMISSIONS)
    if unknown:
        raise HTTPException(422, f"Неизвестные права: {', '.join(unknown)}")
    return sorted(set(perms))


def _resolve_grant(actor: CurrentUser, role: str, perms: list[str] | None) -> tuple[str, list[str]]:
    """Проверить, что actor вправе выдать такую роль и права. Вернуть итоговые (role, permissions)."""
    _check_role(role)
    final = role_permissions(role) if perms is None else _check_perms(perms)
    if role == "owner":
        final = sorted(ALL_PERMISSIONS)
    if not actor.is_owner:
        if role == "owner":
            raise HTTPException(403, "Роль владельца может выдать только владелец")
        if OWNER_ONLY_PERMISSIONS & set(final):
            raise HTTPException(403, "Право «Управлять доступом» может выдать только владелец")
        if not set(final) <= actor.permissions:
            raise HTTPException(403, "Нельзя выдать право, которого нет у вас самого")
    return role, final


def _check_target(actor: CurrentUser, target: AppUser) -> None:
    if target.bitrix_user_id == actor.id:
        raise HTTPException(403, "Свой собственный доступ менять нельзя")
    if target.role == "owner" and not actor.is_owner:
        raise HTTPException(403, "Запись владельца может менять только владелец")


# ─── Справочник для интерфейса ──────────────────────────────

@router.get("/meta")
async def meta():
    return {
        "permissions": [{"key": k, "label": l, "group": g} for k, l, g in PERMISSIONS],
        "roles": [
            {"id": rid, "label": r["label"], "permissions": r["permissions"]}
            for rid, r in ROLES.items()
        ],
        "owner_only": sorted(OWNER_ONLY_PERMISSIONS),
    }


# ─── Сотрудники ─────────────────────────────────────────────

@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AppUser).order_by(AppUser.created_at, AppUser.bitrix_user_id))).scalars().all()
    rows = sorted(rows, key=lambda u: (u.role != "owner", not u.is_active, (u.name or "").lower()))
    return {"users": [_user_out(u) for u in rows]}


@router.post("/users", status_code=201)
async def create_user(body: UserCreate, actor: CurrentUser = Depends(current_user),
                      db: AsyncSession = Depends(get_db)):
    uid = body.bitrix_user_id.strip()
    if not _ID_RE.match(uid):
        raise HTTPException(422, "ID должен состоять из цифр (число из адреса профиля в Битрикс24)")
    role, perms = _resolve_grant(actor, body.role, body.permissions)
    if await db.get(AppUser, uid) is not None:
        raise HTTPException(409, "Этот сотрудник уже есть в списке")

    user = AppUser(bitrix_user_id=uid, name=body.name.strip(), role=role,
                   permissions=perms, is_active=True)
    db.add(user)
    # если человек уже просил доступ — запрос закрыт
    req = await db.get(AccessRequest, uid)
    if req is not None:
        if not user.name:
            user.name = req.name
        await db.delete(req)
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserPatch, actor: CurrentUser = Depends(current_user),
                      db: AsyncSession = Depends(get_db)):
    user = await db.get(AppUser, user_id)
    if user is None:
        raise HTTPException(404, "Сотрудник не найден")
    _check_target(actor, user)

    if body.role is not None or body.permissions is not None:
        new_role = body.role if body.role is not None else user.role
        if body.permissions is not None:
            perms: list[str] | None = body.permissions          # права заданы явно
        elif new_role != user.role:
            perms = None                                        # сменили роль → шаблон новой роли
        else:
            perms = list(user.permissions or [])                # ничего не меняем
        user.role, user.permissions = _resolve_grant(actor, new_role, perms)

    if body.name is not None:
        user.name = body.name.strip()
    if body.is_active is not None:
        user.is_active = body.is_active

    await db.commit()
    await db.refresh(user)
    return _user_out(user)


# ─── Запросы на доступ ──────────────────────────────────────

@router.get("/requests")
async def list_requests(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AccessRequest).order_by(AccessRequest.last_requested_at.desc()))).scalars().all()
    return {"requests": [
        {"id": r.bitrix_user_id, "name": r.name,
         "first_requested_at": r.first_requested_at, "last_requested_at": r.last_requested_at}
        for r in rows
    ]}


@router.post("/requests/{user_id}/approve", status_code=201)
async def approve_request(user_id: str, body: ApproveIn, actor: CurrentUser = Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
    req = await db.get(AccessRequest, user_id)
    if req is None:
        raise HTTPException(404, "Запрос не найден")
    role, perms = _resolve_grant(actor, body.role, body.permissions)
    if await db.get(AppUser, user_id) is not None:
        await db.delete(req)
        await db.commit()
        raise HTTPException(409, "Этот сотрудник уже есть в списке")

    user = AppUser(bitrix_user_id=user_id, name=req.name, role=role, permissions=perms, is_active=True)
    db.add(user)
    await db.delete(req)
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.delete("/requests/{user_id}", status_code=204)
async def dismiss_request(user_id: str, db: AsyncSession = Depends(get_db)):
    req = await db.get(AccessRequest, user_id)
    if req is None:
        raise HTTPException(404, "Запрос не найден")
    await db.delete(req)
    await db.commit()


# ─── Утренняя сводка ────────────────────────────────────────

class DigestPatch(BaseModel):
    enabled:    bool | None = None
    time:       str | None = Field(default=None, max_length=5)
    recipients: list[str] | None = None
    app_url:    str | None = Field(default=None, max_length=500)


def _digest_out(cfg: dict) -> dict:
    return {
        "enabled":    cfg["enabled"],
        "time":       cfg["time"],
        "recipients": [str(r) for r in cfg.get("recipients", [])],
        "app_url":    cfg.get("app_url", ""),
        "bot_ready":  bool(cfg.get("bot_id")),
        "bot_error":  cfg.get("bot_error"),
        "last_sent_for": cfg.get("last_sent_for"),
        "last_result":   cfg.get("last_result"),
    }


@router.get("/digest")
async def get_digest(db: AsyncSession = Depends(get_db)):
    return _digest_out(await digest.get_config(db))


@router.put("/digest")
async def put_digest(body: DigestPatch, db: AsyncSession = Depends(get_db)):
    cfg = await digest.get_config(db)
    if body.time is not None:
        try:
            h, m = digest.parse_time(body.time)
        except ValueError:
            raise HTTPException(422, "Время в формате ЧЧ:ММ, например 08:30")
        cfg["time"] = f"{h:02d}:{m:02d}"
    if body.recipients is not None:
        ids = sorted({r.strip() for r in body.recipients if r.strip()})
        bad = [r for r in ids if not _ID_RE.match(r)]
        if bad:
            raise HTTPException(422, f"Неверный ID: {', '.join(bad)}")
        known = set((await db.execute(
            select(AppUser.bitrix_user_id).where(AppUser.bitrix_user_id.in_(ids))
        )).scalars().all()) if ids else set()
        missing = [r for r in ids if r not in known]
        if missing:
            raise HTTPException(422, f"Нет в списке сотрудников: {', '.join(missing)}")
        cfg["recipients"] = ids
    if body.app_url is not None:
        url = body.app_url.strip()
        if url and not url.startswith("https://"):
            raise HTTPException(422, "Ссылка должна начинаться с https://")
        cfg["app_url"] = url
    if body.enabled is not None:
        cfg["enabled"] = body.enabled

    cfg = await digest.save_config(db, cfg)
    schedule_digest(cfg["time"])
    return _digest_out(cfg)


@router.get("/digest/preview")
async def digest_preview(actor: CurrentUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Как сводка за вчера выглядит для текущего пользователя."""
    perms = ALL_PERMISSIONS if actor.is_owner else actor.permissions
    return await digest.preview(db, frozenset(perms))


@router.post("/digest/test")
async def digest_test(actor: CurrentUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Отправить сводку за вчера себе — проверить, что бот работает и как выглядит сообщение."""
    result = await digest.send_digest(db, only_user=actor.id)
    cfg = await digest.get_config(db)
    return {**result, "digest": _digest_out(cfg)}
