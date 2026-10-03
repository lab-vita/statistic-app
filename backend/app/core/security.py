"""
Подписанные токены доступа (без внешних зависимостей).

Формат: base64url(payload_json) + "." + base64url(HMAC-SHA256(secret, payload_part))
Подделать токен без SESSION_SECRET нельзя, а срок жизни (exp) зашит в подпись.
"""
import base64
import hashlib
import hmac
import json
import time

from app.core.config import settings


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload_part: str) -> str:
    key = settings.SESSION_SECRET.encode("utf-8")
    return _b64(hmac.new(key, payload_part.encode("ascii"), hashlib.sha256).digest())


def create_token(user_id: str, ttl_hours: int | None = None) -> str:
    """Создать токен. В нём только ID и срок: роль и имя берутся из БД при каждом запросе."""
    if not settings.SESSION_SECRET:
        raise RuntimeError("SESSION_SECRET не задан")
    ttl = (ttl_hours if ttl_hours is not None else settings.SESSION_TTL_HOURS) * 3600
    payload = {"uid": str(user_id), "exp": int(time.time()) + ttl}
    part = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{part}.{_sign(part)}"


def verify_token(token: str) -> str | None:
    """Вернуть user_id, если токен настоящий и не просрочен, иначе None."""
    if not token or not settings.SESSION_SECRET:
        return None
    try:
        part, sig = token.split(".", 1)
        if not hmac.compare_digest(sig, _sign(part)):
            return None
        payload = json.loads(_unb64(part))
        if int(payload["exp"]) < time.time():
            return None
        return str(payload["uid"])
    except Exception:
        return None
