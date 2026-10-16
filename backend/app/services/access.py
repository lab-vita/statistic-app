"""
Доступ к приложению: роли, справочник сотрудников Битрикс24, фото и должности.

Сотрудники портала берутся через входящий вебхук:
  • user.get — полный список (нужно право вебхука «Пользователи (user)»);
  • если такого права нет — поиск по имени через im.search.user.list (право «im»).
Фото и должности уже добавленных сотрудников — im.user.list.get (право «im»).
"""
import logging
import re
import secrets
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import (
    ALL_PERMISSIONS,
    DEFAULT_ROLES,
    LEGACY_TEMPLATES,
    OWNER_ROLE,
    set_role_cache,
    with_requirements,
)
from app.models.app_user import AccessRequest, AppRole, AppUser
from app.services import exchange_log

logger = logging.getLogger(__name__)

PROFILE_TTL = timedelta(hours=12)
DIRECTORY_TTL = 600          # секунд — полный список сотрудников портала
_directory: dict = {"at": 0.0, "users": None}

SCOPE_HINT = ("Чтобы видеть весь список сотрудников, добавьте входящему вебхуку Битрикс24 "
              "право «Пользователи (user)» (Разработчикам → Другое → Входящий вебхук). "
              "Пока работает поиск по имени.")


# ─── Роли ────────────────────────────────────────────────────────

async def load_roles(db: AsyncSession) -> list[AppRole]:
    rows = (await db.execute(select(AppRole).order_by(AppRole.position, AppRole.created_at))).scalars().all()
    return list(rows)


async def refresh_role_cache(db: AsyncSession) -> None:
    set_role_cache({r.id: list(r.permissions or []) for r in await load_roles(db)})


def new_role_id(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:20]
    return f"{base or 'role'}-{secrets.token_hex(3)}"


async def create_tables(engine) -> None:
    """
    Создать таблицу ролей и новые колонки, если их нет. При самом первом запуске —
    завести роли по умолчанию и перевести на них сотрудников: кому права не правили
    вручную, остаётся прежняя роль; у кого правили — для каждого набора создаётся
    своя роль «Особые права», чтобы ни у кого доступ не изменился.
    """
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: AppRole.__table__.create(c, checkfirst=True))
        for table in ("app_users", "access_requests"):
            for col in ("avatar_url", "position"):
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} VARCHAR"))
        await conn.execute(text(
            "ALTER TABLE app_users ADD COLUMN IF NOT EXISTS profile_synced_at TIMESTAMP WITH TIME ZONE"))

    from app.db.database import async_session_factory
    async with async_session_factory() as db:
        roles = await load_roles(db)
        if not roles:
            await _seed_and_migrate(db)
        else:
            owner = next((r for r in roles if r.id == OWNER_ROLE), None)
            if owner is None:
                d = DEFAULT_ROLES[0]
                db.add(AppRole(id=OWNER_ROLE, name=d["name"], description=d["description"],
                               permissions=sorted(ALL_PERMISSIONS), system=True, position=0))
            elif set(owner.permissions or []) != ALL_PERMISSIONS or not owner.system:
                owner.permissions, owner.system = sorted(ALL_PERMISSIONS), True
            await db.commit()
        await refresh_role_cache(db)


async def _seed_and_migrate(db: AsyncSession) -> None:
    for i, d in enumerate(DEFAULT_ROLES):
        db.add(AppRole(id=d["id"], name=d["name"], description=d["description"],
                       permissions=d["permissions"], system=d["system"], position=i * 10))
    known = {d["id"] for d in DEFAULT_ROLES}

    custom: dict[frozenset[str], AppRole] = {}
    users = (await db.execute(select(AppUser))).scalars().all()
    for u in users:
        if u.role == OWNER_ROLE:
            continue
        stored = frozenset(u.permissions or []) & ALL_PERMISSIONS
        template = LEGACY_TEMPLATES.get(u.role)
        if u.role in known and (not stored or stored == template):
            continue                                   # права не правили — остаётся роль
        perms = set(stored)
        if "view:appointments" in perms:
            perms.add("view:patients")                 # раньше «Пациенты» открывались правом «Записи»
        key = frozenset(with_requirements(perms))
        if key not in custom:
            n = len(custom) + 1
            role = AppRole(id=f"custom-{n}", name=f"Особые права {n}", permissions=sorted(key),
                           description="Создана при переходе на роли — права, которые раньше правили вручную",
                           system=False, position=100 + n)
            db.add(role)
            custom[key] = role
        u.role = custom[key].id
    await db.commit()
    logger.info("[access] роли созданы; особых наборов прав перенесено: %s", len(custom))


# ─── Битрикс24 ───────────────────────────────────────────────────

def _photo(value) -> str | None:
    return value if isinstance(value, str) and value.startswith("http") else None


def _from_im(u: dict) -> dict:
    name = (u.get("name") or f"{u.get('first_name', '')} {u.get('last_name', '')}").strip()
    return {
        "id": str(u.get("id")),
        "name": name,
        "position": (u.get("work_position") or "").strip() or None,
        "avatar": _photo(u.get("avatar")),
    }


def _from_user_get(u: dict) -> dict:
    return {
        "id": str(u.get("ID")),
        "name": f"{u.get('NAME') or ''} {u.get('LAST_NAME') or ''}".strip() or (u.get("EMAIL") or ""),
        "position": (u.get("WORK_POSITION") or "").strip() or None,
        "avatar": _photo(u.get("PERSONAL_PHOTO")),
    }


def _values(result) -> list[dict]:
    if isinstance(result, dict):
        return [v for v in result.values() if isinstance(v, dict)]
    if isinstance(result, list):
        return [v for v in result if isinstance(v, dict)]
    return []


async def _all_employees() -> list[dict]:
    """Все активные сотрудники портала (user.get). BitrixError — если у вебхука нет прав."""
    from app.services.digest import BitrixError

    now = time.monotonic()
    if _directory["users"] is not None and now - _directory["at"] < DIRECTORY_TTL:
        return _directory["users"]

    out: list[dict] = []
    start = 0
    async with exchange_log.make_client("bitrix", timeout=20) as client:
        for _ in range(100):                      # до 5000 сотрудников
            resp = await client.post(settings.BITRIX_WEBHOOK_URL + "user.get", json={
                "FILTER": {"ACTIVE": True, "USER_TYPE": "employee"},
                "SORT": "LAST_NAME", "ORDER": "ASC", "start": start,
            })
            data = resp.json()
            if "error" in data:
                raise BitrixError(str(data.get("error") or ""), str(data.get("error_description") or ""))
            out.extend(_from_user_get(u) for u in data.get("result") or [])
            if data.get("next") is None:
                break
            start = data["next"]
    out = [u for u in out if u["id"] and u["name"]]
    out.sort(key=lambda u: u["name"].lower())
    _directory.update(at=now, users=out)
    return out


async def search_employees(query: str) -> dict:
    """
    Сотрудники портала для выбора в настройках.
    mode = "full" — весь список (фильтр по строке на месте), "search" — только поиск по имени.
    """
    from app.services.digest import BitrixError, _call

    q = query.strip().lower()
    try:
        users = await _all_employees()
        if q:
            users = [u for u in users if q in u["name"].lower() or q in (u["position"] or "").lower()]
        return {"mode": "full", "users": users[:500], "hint": None}
    except BitrixError as e:
        if e.code not in ("insufficient_scope", "ACCESS_DENIED", "WRONG_AUTH_TYPE"):
            raise
    except Exception:  # noqa: BLE001 — сеть или формат ответа: пробуем поиск
        logger.warning("[access] user.get не сработал", exc_info=True)

    if len(q) < 3:
        return {"mode": "search", "users": [], "hint": SCOPE_HINT}
    result = await _call("im.search.user.list", {"FIND": query.strip()})
    users = [_from_im(u) for u in _values(result)
             if not u.get("bot") and not u.get("connector") and u.get("active", True) is not False]
    users = [u for u in users if u["id"] and u["name"]]
    users.sort(key=lambda u: u["name"].lower())
    return {"mode": "search", "users": users[:100], "hint": SCOPE_HINT}


async def fetch_profiles(ids: list[str]) -> dict[str, dict]:
    """Имя, фото и должность по ID (im.user.list.get, по 50 за раз)."""
    from app.services.digest import _call

    out: dict[str, dict] = {}
    for i in range(0, len(ids), 50):
        chunk = [int(x) for x in ids[i:i + 50] if x.isdigit()]
        if not chunk:
            continue
        result = await _call("im.user.list.get", {"ID": chunk})
        for u in _values(result):
            p = _from_im(u)
            out[p["id"]] = p
    return out


async def sync_profiles(db: AsyncSession, force: bool = False) -> None:
    """Обновить фото и должности сотрудников из списка доступа (не чаще раза в 12 часов)."""
    now = datetime.now(timezone.utc)
    users = (await db.execute(select(AppUser))).scalars().all()
    reqs = (await db.execute(select(AccessRequest))).scalars().all()
    stale = [u for u in users if force or not u.profile_synced_at or now - u.profile_synced_at > PROFILE_TTL]
    need_req = [r for r in reqs if not r.avatar_url and not r.position]
    if not stale and not need_req:
        return
    try:
        profiles = await fetch_profiles([u.bitrix_user_id for u in stale] + [r.bitrix_user_id for r in need_req])
    except Exception as e:  # noqa: BLE001 — без фото настройки всё равно работают
        logger.warning("[access] фото сотрудников не обновлены: %s", e)
        return
    for u in stale:
        p = profiles.get(u.bitrix_user_id)
        if p:
            u.avatar_url = p["avatar"]
            u.position = p["position"]
            if not u.name:
                u.name = p["name"]
        u.profile_synced_at = now
    for r in need_req:
        p = profiles.get(r.bitrix_user_id)
        if p:
            r.avatar_url, r.position = p["avatar"], p["position"]
    await db.commit()
