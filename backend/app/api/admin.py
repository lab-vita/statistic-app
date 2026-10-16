"""
Настройки доступа: кто открывает приложение, с какой ролью, и сами роли.

Адреса требуют права users:manage (сотрудники и роли) или digest:manage (утренняя сводка) —
проверяется в каждом обработчике. Правила, которые не дают запереть себя или повысить себя:

  • свою собственную запись и свою роль менять нельзя;
  • записи владельцев и роль «Владелец» выдаёт и меняет только владелец;
  • право «Управлять доступом» включает в роли и выдаёт только владелец;
  • нельзя создать роль или выдать роль с правами, которых нет у самого выдающего,
    и нельзя менять сотрудника или роль, у которых прав больше, чем у вас.
"""
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, current_user
from app.core.permissions import (
    ALL_PERMISSIONS,
    DEFAULT_ROLE,
    OWNER_ONLY_PERMISSIONS,
    OWNER_ROLE,
    PERMISSION_DEFS,
    effective_permissions,
    with_requirements,
)
from app.db.database import get_db
from app.models.app_user import AccessRequest, AppRole, AppUser
from app.services import access, digest
from app.services.scheduler import schedule_digest

router = APIRouter()

_ID_RE = re.compile(r"^\d{1,12}$")


# ─── Проверки ───────────────────────────────────────────────

def _need(actor: CurrentUser, perm: str) -> None:
    if not actor.has_any(perm):
        raise HTTPException(403, "Недостаточно прав")


def _manage(actor: CurrentUser = Depends(current_user)) -> CurrentUser:
    _need(actor, "users:manage")
    return actor


def _digest_admin(actor: CurrentUser = Depends(current_user)) -> CurrentUser:
    _need(actor, "digest:manage")
    return actor


def _any_admin(actor: CurrentUser = Depends(current_user)) -> CurrentUser:
    if not actor.has_any("users:manage", "digest:manage"):
        raise HTTPException(403, "Недостаточно прав")
    return actor


def _role_perms(role: AppRole) -> frozenset[str]:
    return effective_permissions(role.id, None, list(role.permissions or []))


def _can_control(actor: CurrentUser, perms: frozenset[str] | set[str], what: str) -> None:
    """actor может выдавать/менять набор прав perms."""
    if actor.is_owner:
        return
    if OWNER_ONLY_PERMISSIONS & set(perms):
        raise HTTPException(403, f"{what}: право «Управлять доступом» выдаёт только владелец")
    if not set(perms) <= actor.permissions:
        raise HTTPException(403, f"{what}: нельзя выдать права, которых нет у вас самого")


async def _get_role(db: AsyncSession, role_id: str) -> AppRole:
    role = await db.get(AppRole, role_id)
    if role is None:
        raise HTTPException(422, "Такой роли нет")
    return role


async def _check_assign(actor: CurrentUser, db: AsyncSession, role_id: str) -> AppRole:
    role = await _get_role(db, role_id)
    if role.id == OWNER_ROLE and not actor.is_owner:
        raise HTTPException(403, "Роль «Владелец» может выдать только владелец")
    _can_control(actor, _role_perms(role), "Роль")
    return role


async def _check_target(actor: CurrentUser, db: AsyncSession, target: AppUser) -> None:
    if target.bitrix_user_id == actor.id:
        raise HTTPException(403, "Свой собственный доступ менять нельзя")
    if target.role == OWNER_ROLE and not actor.is_owner:
        raise HTTPException(403, "Доступ владельца может менять только владелец")
    role = await db.get(AppRole, target.role)
    if role is not None and not actor.is_owner and not _role_perms(role) <= actor.permissions:
        raise HTTPException(403, "У этого сотрудника больше прав, чем у вас")


# ─── Представление ──────────────────────────────────────────

def _user_out(u: AppUser, roles: dict[str, AppRole]) -> dict:
    role = roles.get(u.role)
    return {
        "id": u.bitrix_user_id,
        "name": u.name,
        "avatar": u.avatar_url,
        "position": u.position,
        "role": u.role,
        "role_name": role.name if role else u.role,
        "permissions": sorted(effective_permissions(u.role, u.permissions,
                                                    list(role.permissions) if role else None)),
        "is_active": u.is_active,
        "created_at": u.created_at,
        "last_login_at": u.last_login_at,
    }


def _role_out(r: AppRole, users: int) -> dict:
    return {
        "id": r.id, "name": r.name, "description": r.description or "",
        "permissions": sorted(_role_perms(r)), "system": r.system, "users": users,
    }


async def _roles(db: AsyncSession) -> dict[str, AppRole]:
    return {r.id: r for r in await access.load_roles(db)}


async def _role_counts(db: AsyncSession) -> dict[str, int]:
    rows = await db.execute(select(AppUser.role, func.count()).group_by(AppUser.role))
    return {r: n for r, n in rows.all()}


# ─── Справочник ─────────────────────────────────────────────

@router.get("/meta")
async def meta(actor: CurrentUser = Depends(_any_admin), db: AsyncSession = Depends(get_db)):
    counts = await _role_counts(db)
    return {
        "permissions": [{"key": p.key, "label": p.label, "group": p.group, "hint": p.hint,
                         "requires": list(p.requires)} for p in PERMISSION_DEFS],
        "roles": [_role_out(r, counts.get(r.id, 0)) for r in await access.load_roles(db)],
        "owner_only": sorted(OWNER_ONLY_PERMISSIONS),
        "me": {"id": actor.id, "is_owner": actor.is_owner, "permissions": sorted(actor.permissions)},
    }


# ─── Роли ───────────────────────────────────────────────────

class RoleIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=300)
    permissions: list[str] = Field(default_factory=list)


class RolePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=300)
    permissions: list[str] | None = None


def _clean_perms(perms: list[str]) -> list[str]:
    unknown = sorted(set(perms) - ALL_PERMISSIONS)
    if unknown:
        raise HTTPException(422, f"Неизвестные права: {', '.join(unknown)}")
    return with_requirements(perms)


async def _check_name(db: AsyncSession, name: str, skip_id: str | None = None) -> str:
    name = " ".join(name.split())
    if not name:
        raise HTTPException(422, "Укажите название роли")
    for r in await access.load_roles(db):
        if r.id != skip_id and r.name.lower() == name.lower():
            raise HTTPException(409, "Роль с таким названием уже есть")
    return name


@router.get("/roles")
async def list_roles(_: CurrentUser = Depends(_manage), db: AsyncSession = Depends(get_db)):
    counts = await _role_counts(db)
    return {"roles": [_role_out(r, counts.get(r.id, 0)) for r in await access.load_roles(db)]}


@router.post("/roles", status_code=201)
async def create_role(body: RoleIn, actor: CurrentUser = Depends(_manage), db: AsyncSession = Depends(get_db)):
    name = await _check_name(db, body.name)
    perms = _clean_perms(body.permissions)
    _can_control(actor, set(perms), "Роль")
    last = max([r.position for r in await access.load_roles(db)] or [0])
    role = AppRole(id=access.new_role_id(name), name=name, description=body.description.strip(),
                   permissions=perms, system=False, position=last + 10)
    db.add(role)
    await db.commit()
    await access.refresh_role_cache(db)
    return _role_out(role, 0)


@router.patch("/roles/{role_id}")
async def update_role(role_id: str, body: RolePatch, actor: CurrentUser = Depends(_manage),
                      db: AsyncSession = Depends(get_db)):
    role = await _get_role(db, role_id)
    if role.system:
        raise HTTPException(403, "Встроенную роль изменить нельзя")
    if role.id == actor.role and not actor.is_owner:
        raise HTTPException(403, "Свою собственную роль менять нельзя — попросите владельца")
    _can_control(actor, _role_perms(role), "Роль")
    if body.name is not None:
        role.name = await _check_name(db, body.name, skip_id=role.id)
    if body.description is not None:
        role.description = body.description.strip()
    if body.permissions is not None:
        perms = _clean_perms(body.permissions)
        _can_control(actor, set(perms), "Роль")
        role.permissions = perms
    await db.commit()
    await access.refresh_role_cache(db)
    return _role_out(role, (await _role_counts(db)).get(role.id, 0))


@router.delete("/roles/{role_id}", status_code=204)
async def delete_role(role_id: str, actor: CurrentUser = Depends(_manage), db: AsyncSession = Depends(get_db)):
    role = await _get_role(db, role_id)
    if role.system:
        raise HTTPException(403, "Встроенную роль удалить нельзя")
    _can_control(actor, _role_perms(role), "Роль")
    n = (await _role_counts(db)).get(role.id, 0)
    if n:
        raise HTTPException(409, f"Роль назначена сотрудникам ({n}) — сначала выдайте им другую роль")
    await db.delete(role)
    await db.commit()
    await access.refresh_role_cache(db)


# ─── Сотрудники с доступом ──────────────────────────────────

class NewUser(BaseModel):
    id: str
    name: str = Field(default="", max_length=200)
    avatar: str | None = Field(default=None, max_length=1000)
    position: str | None = Field(default=None, max_length=300)


class UsersAdd(BaseModel):
    users: list[NewUser] = Field(min_length=1, max_length=200)
    role: str = DEFAULT_ROLE


class UserPatch(BaseModel):
    role: str | None = None
    is_active: bool | None = None


@router.get("/users")
async def list_users(_: CurrentUser = Depends(_any_admin), db: AsyncSession = Depends(get_db)):
    await access.sync_profiles(db)
    roles = await _roles(db)
    rows = (await db.execute(select(AppUser))).scalars().all()
    rows = sorted(rows, key=lambda u: (u.role != OWNER_ROLE, not u.is_active, (u.name or "").lower()))
    return {"users": [_user_out(u, roles) for u in rows]}


@router.post("/users", status_code=201)
async def add_users(body: UsersAdd, actor: CurrentUser = Depends(_manage), db: AsyncSession = Depends(get_db)):
    """Дать доступ сотрудникам портала, выбранным из списка Битрикс24."""
    await _check_assign(actor, db, body.role)
    ids = []
    for u in body.users:
        uid = u.id.strip()
        if not _ID_RE.match(uid):
            raise HTTPException(422, f"Неверный ID сотрудника: {uid}")
        ids.append(uid)
    try:
        profiles = await access.fetch_profiles(ids)
    except Exception:  # noqa: BLE001 — нет связи с порталом: берём то, что пришло из списка
        profiles = {}

    now = datetime.now(timezone.utc)
    added, skipped = [], []
    for u in body.users:
        uid = u.id.strip()
        if await db.get(AppUser, uid) is not None:
            skipped.append(uid)
            continue
        p = profiles.get(uid) or {}
        user = AppUser(bitrix_user_id=uid, name=(p.get("name") or u.name).strip(), role=body.role,
                       permissions=[], is_active=True,
                       avatar_url=p.get("avatar") or u.avatar, position=p.get("position") or u.position,
                       profile_synced_at=now if p else None)
        db.add(user)
        req = await db.get(AccessRequest, uid)
        if req is not None:
            await db.delete(req)
        added.append(uid)
    await db.commit()
    return {"added": added, "skipped": skipped}


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserPatch, actor: CurrentUser = Depends(_manage),
                      db: AsyncSession = Depends(get_db)):
    user = await db.get(AppUser, user_id)
    if user is None:
        raise HTTPException(404, "Сотрудник не найден")
    await _check_target(actor, db, user)
    if body.role is not None and body.role != user.role:
        await _check_assign(actor, db, body.role)
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    await db.commit()
    await db.refresh(user)
    return _user_out(user, await _roles(db))


@router.delete("/users/{user_id}", status_code=204)
async def remove_user(user_id: str, actor: CurrentUser = Depends(_manage), db: AsyncSession = Depends(get_db)):
    """Убрать сотрудника из списка доступа. Если он снова откроет приложение — появится запрос."""
    user = await db.get(AppUser, user_id)
    if user is None:
        raise HTTPException(404, "Сотрудник не найден")
    await _check_target(actor, db, user)
    await db.delete(user)
    cfg = await digest.get_config(db)
    if user_id in [str(r) for r in cfg.get("recipients", [])]:
        cfg["recipients"] = [r for r in cfg["recipients"] if str(r) != user_id]
        await digest.save_config(db, cfg)
    await db.commit()


# ─── Сотрудники портала ─────────────────────────────────────

@router.get("/bitrix/employees")
async def bitrix_employees(q: str = Query(default="", max_length=100), _: CurrentUser = Depends(_manage),
                           db: AsyncSession = Depends(get_db)):
    """Сотрудники Битрикс24 для выбора: с фото, должностью и отметкой, есть ли уже доступ."""
    try:
        res = await access.search_employees(q)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Битрикс24 не отдал список сотрудников: {digest.explain_error(e)}") from None
    have = {u.bitrix_user_id: u.role for u in (await db.execute(select(AppUser))).scalars().all()}
    for u in res["users"]:
        u["has_access"] = u["id"] in have
        u["role"] = have.get(u["id"])
    return res


# ─── Запросы на доступ ──────────────────────────────────────

class ApproveIn(BaseModel):
    role: str = DEFAULT_ROLE


@router.get("/requests")
async def list_requests(_: CurrentUser = Depends(_manage), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AccessRequest).order_by(AccessRequest.last_requested_at.desc()))).scalars().all()
    return {"requests": [
        {"id": r.bitrix_user_id, "name": r.name, "avatar": r.avatar_url, "position": r.position,
         "first_requested_at": r.first_requested_at, "last_requested_at": r.last_requested_at}
        for r in rows
    ]}


@router.post("/requests/{user_id}/approve", status_code=201)
async def approve_request(user_id: str, body: ApproveIn, actor: CurrentUser = Depends(_manage),
                          db: AsyncSession = Depends(get_db)):
    req = await db.get(AccessRequest, user_id)
    if req is None:
        raise HTTPException(404, "Запрос не найден")
    await _check_assign(actor, db, body.role)
    if await db.get(AppUser, user_id) is None:
        db.add(AppUser(bitrix_user_id=user_id, name=req.name, role=body.role, permissions=[],
                       is_active=True, avatar_url=req.avatar_url, position=req.position))
    await db.delete(req)
    await db.commit()
    user = await db.get(AppUser, user_id)
    return _user_out(user, await _roles(db))


@router.delete("/requests/{user_id}", status_code=204)
async def dismiss_request(user_id: str, _: CurrentUser = Depends(_manage), db: AsyncSession = Depends(get_db)):
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
async def get_digest(_: CurrentUser = Depends(_digest_admin), db: AsyncSession = Depends(get_db)):
    return _digest_out(await digest.get_config(db))


@router.put("/digest")
async def put_digest(body: DigestPatch, _: CurrentUser = Depends(_digest_admin), db: AsyncSession = Depends(get_db)):
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
async def digest_preview(actor: CurrentUser = Depends(_digest_admin), db: AsyncSession = Depends(get_db)):
    """Как сводка за вчера выглядит для текущего пользователя."""
    perms = ALL_PERMISSIONS if actor.is_owner else actor.permissions
    return await digest.preview(db, frozenset(perms))


@router.post("/digest/test")
async def digest_test(actor: CurrentUser = Depends(_digest_admin), db: AsyncSession = Depends(get_db)):
    """Отправить сводку за вчера себе — проверить, что бот работает и как выглядит сообщение."""
    result = await digest.send_digest(db, only_user=actor.id)
    cfg = await digest.get_config(db)
    return {**result, "digest": _digest_out(cfg)}
