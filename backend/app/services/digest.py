"""
Утренняя сводка за вчерашний день — личным сообщением в Битрикс24.

Как устроено:
  • настройки (вкл/выкл, время, получатели, ссылка на приложение, бот) лежат
    в таблице app_settings под ключом "digest" и меняются из админки;
  • в заданное время планировщик дособирает вчерашний день целиком
    (последний плановый сбор — в 18:00) и вызывает send_digest;
  • цифры берутся теми же функциями, что отдают данные страницам приложения,
    поэтому в сводке ровно то, что человек увидит, открыв «Пульс»;
  • каждый получатель видит только разделы, на которые у него есть права;
  • сравнение — с тем же днём недели неделю назад (у клиники недельный ритм:
    понедельник с субботой сравнивать бессмысленно);
  • сообщение отправляет чат-бот «Пульс», которого сервер сам регистрирует
    через входящий вебхук (нужны права вебхука imbot и im). Если бота создать
    не удалось — сводка уходит системным уведомлением.
"""
from __future__ import annotations

import logging
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import effective_permissions
from app.core.utils import calc_delta, today_local
from app.models.app_setting import AppSetting
from app.models.app_user import AppUser

logger = logging.getLogger(__name__)

DIGEST_KEY = "digest"

DEFAULT_CONFIG: dict = {
    "enabled":    False,
    "time":       "08:30",     # по Кемерово
    "recipients": [],          # bitrix_user_id тех, кому слать
    "app_url":    "",          # ссылка на приложение в портале — для кнопки «Открыть»
    "bot_id":     None,        # ID чат-бота «Пульс» в портале
    "bot_error":  None,        # почему бота создать не удалось (для админки)
    "avatar_version": 0,       # какая версия аватарки уже стоит у бота в портале
    "last_sent_for": None,     # за какой день сводка уже ушла (защита от повторов)
    "last_result":   None,     # итог последней отправки (для админки)
}

BOT_CODE      = "pulse_digest"
# Аватарка бота: JPEG 256×256 в base64 (файл текстовый — так его проще хранить и обновлять).
# Поменяли картинку — увеличьте AVATAR_VERSION, и при следующем старте она обновится в портале.
AVATAR_FILE    = Path(__file__).resolve().parent.parent / "assets" / "bot_avatar.jpg.b64"
AVATAR_VERSION = 1
MISSED_LIMIT  = 6.0      # % пропущенных — тот же порог, что в разделе «Планы»
CONV_GOOD     = 30.0     # конверсия звонок → запись: хорошо от 30% (как на «Воронке»)
VISIT_GOOD    = 80.0     # явка: хорошо от 80%
REACTION_SLOW = 15 * 60  # перезвон дольше 15 минут — медленно


# ─── Настройки ──────────────────────────────────────────────

async def create_settings_table(engine) -> None:
    """Создать app_settings, если миграцию ещё не применили (вызывается при старте)."""
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: AppSetting.__table__.create(c, checkfirst=True))


async def get_config(db: AsyncSession) -> dict:
    row = await db.get(AppSetting, DIGEST_KEY)
    return {**DEFAULT_CONFIG, **(row.value if row else {})}


async def save_config(db: AsyncSession, cfg: dict) -> dict:
    clean = {k: cfg.get(k, v) for k, v in DEFAULT_CONFIG.items()}
    row = await db.get(AppSetting, DIGEST_KEY)
    if row is None:
        db.add(AppSetting(key=DIGEST_KEY, value=clean))
    else:
        row.value = clean          # новый dict — SQLAlchemy увидит изменение JSON
    await db.commit()
    return clean


async def update_config(db: AsyncSession, **changes) -> dict:
    cfg = await get_config(db)
    cfg.update(changes)
    return await save_config(db, cfg)


def parse_time(value: str) -> tuple[int, int]:
    """'08:30' → (8, 30). Бросает ValueError на мусор."""
    h, m = value.strip().split(":")
    hour, minute = int(h), int(m)
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(value)
    return hour, minute


# ─── Данные ─────────────────────────────────────────────────

async def build_digest(db: AsyncSession, day: date) -> dict:
    """
    Все цифры за день `day` и за тот же день неделю назад.
    Здесь вызываются те же обработчики, что отвечают страницам приложения.
    """
    from app.api import appointments as appt_api, calls as calls_api, payments as pay_api, plans as plans_api

    week_ago = day - timedelta(days=7)
    month_start = day.replace(day=1)

    async def calls_total(d_from: date, d_to: date) -> dict:
        r = await calls_api.get_stats(date_from=d_from, date_to=d_to, operator_id=None, db=db)
        return r["operators"]

    async def appts(d_from: date, d_to: date) -> dict:
        return await appt_api.get_stats(date_from=d_from, date_to=d_to, admin_surname=None, db=db)

    async def pays(d: date) -> dict:
        return await pay_api.stats(date_from=d, date_to=d, kind=None, db=db)

    ops_day  = await calls_total(day, day)
    ops_prev = await calls_total(week_ago, week_ago)
    conv_day  = await calls_api.get_conversion(date_from=day, date_to=day, db=db)
    conv_prev = await calls_api.get_conversion(date_from=week_ago, date_to=week_ago, db=db)
    appt_day  = await appts(day, day)
    appt_prev = await appts(week_ago, week_ago)
    pay_day   = await pays(day)
    pay_prev  = await pays(week_ago)

    plan = await plans_api.get_range(date_from=month_start, date_to=day, db=db)
    mtd_calls = (await calls_total(month_start, day))["total"] if day != month_start else ops_day["total"]
    mtd_appts = (await appts(month_start, day))["total"] if day != month_start else appt_day["total"]

    return {
        "day":       day,
        "week_ago":  week_ago,
        "calls":     ops_day["total"],
        "calls_prev": ops_prev["total"],
        "operators": {k: v for k, v in ops_day.items() if k != "total"},
        "conversion":      conv_day,
        "conversion_prev": conv_prev,
        "appts":      appt_day["total"],
        "appts_prev": appt_prev["total"],
        "appt_groups": appt_day.get("by_group", {}),
        "pay":      pay_day,
        "pay_prev": pay_prev,
        "plan": {
            "month_start": month_start,
            "calls_plan":  plan["totals"].get("calls_incoming", 0),
            "calls_fact":  mtd_calls.get("incoming", 0),
            "appts_plan":  plan["totals"].get("appt_count", 0),
            "appts_fact":  mtd_appts.get("total", 0),
        },
    }


def is_empty(data: dict) -> bool:
    """В этот день клиника не работала (или данные не собрались)."""
    return (
        not data["calls"].get("total")
        and not data["appts"].get("total")
        and not data["pay"].get("count")
    )


# ─── Текст ──────────────────────────────────────────────────

_WEEKDAYS_ACC = ["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"]
_WEEKDAYS_INS = ["прошлым понедельником", "прошлым вторником", "прошлой средой", "прошлым четвергом",
                 "прошлой пятницей", "прошлой субботой", "прошлым воскресеньем"]
_MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля",
               "августа", "сентября", "октября", "ноября", "декабря"]
_MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль",
           "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]


def _num(n: float) -> str:
    return f"{round(n):,}".replace(",", " ")


def _pct(x: float) -> str:
    return f"{x:.1f}".replace(".", ",").replace(",0", "") + "%"


def _rub(n: float) -> str:
    return f"{_num(n)} ₽"


def _dur(sec: float) -> str:
    sec = int(sec or 0)
    if sec < 60:
        return f"{sec} с"
    m, s = divmod(sec, 60)
    if m < 60:
        return f"{m} мин" + (f" {s} с" if s and m < 10 else "")
    h, m = divmod(m, 60)
    return f"{h} ч {m} мин"


def _plural(n: int, one: str, few: str, many: str) -> str:
    n = abs(n) % 100
    if 11 <= n <= 14:
        return many
    n %= 10
    return one if n == 1 else few if 2 <= n <= 4 else many


def _delta(curr: float, prev: float) -> str:
    """' (▲ 12%)' к тому же дню прошлой недели; пусто, если сравнивать не с чем."""
    d = calc_delta(curr, prev)
    if d["delta_dir"] is None:
        return ""
    if d["delta_dir"] == "flat" or d["delta_pct"] == 0:
        return " (=)"
    return f" ({'▲' if d['delta_dir'] == 'up' else '▼'} {d['delta_pct']}%)"


def _pp(curr: float, prev: float, has_prev: bool) -> str:
    """Разница долей в процентных пунктах: ' (▼ 3 п.п.)'."""
    if not has_prev:
        return ""
    diff = round(curr - prev)
    if diff == 0:
        return " (=)"
    return f" ({'▲' if diff > 0 else '▼'} {abs(diff)} п.п.)"


def _day_title(d: date) -> str:
    return f"{_WEEKDAYS_ACC[d.weekday()]}, {d.day} {_MONTHS_GEN[d.month - 1]}"


def render_digest(data: dict, perms: frozenset[str] | set[str]) -> str:
    """Текст сводки (BB-коды Битрикс24) с разделами, доступными по правам."""
    day: date = data["day"]
    see_calls = "view:calls" in perms
    see_appts = "view:appointments" in perms
    see_money = "view:revenue" in perms
    see_plans = "view:plans" in perms

    out: list[str] = [
        f"[b]Сводка за {_day_title(day)}[/b]",
        f"В скобках — сравнение с {_WEEKDAYS_INS[day.weekday()]}, {data['week_ago'].day} {_MONTHS_GEN[data['week_ago'].month - 1]}",
    ]
    alerts: list[str] = []

    # ── Звонки
    if see_calls:
        c, p = data["calls"], data["calls_prev"]
        conv = data["conversion"]["total"]
        conv_prev = data["conversion_prev"]["total"]
        out += ["", "[b]Звонки[/b]"]
        out.append(
            f"Принято {_num(c['incoming'])}{_delta(c['incoming'], p.get('incoming', 0))}"
            f" · исходящих {_num(c['outgoing'])}{_delta(c['outgoing'], p.get('outgoing', 0))}"
        )
        if c["received"]:
            out.append(
                f"Пропущено {_num(c['missed'])} — {_pct(c['missed_pct'])} от поступивших"
                f"{_pp(c['missed_pct'], p.get('missed_pct', 0), bool(p.get('received')))}"
            )
        if c["missed_total"]:
            line = f"Перезвонили {c['callback_count']} из {c['missed_total']} пропущенных"
            if c.get("avg_reaction_sec"):
                line += f", в среднем через {_dur(c['avg_reaction_sec'])}"
            out.append(line)
        lost = c.get("lost", 0)
        out.append(
            f"Потеряно клиентов: {_num(lost)}" + _delta(lost, p.get("lost", 0)) if lost
            else "Потерянных клиентов нет"
        )
        if conv["incoming"]:
            out.append(
                f"Конверсия колл-центра в запись {_pct(conv['conversion_pct'])}"
                f" — записали {_num(conv['appointments'])} из {_num(conv['incoming'])}"
                f"{_pp(conv['conversion_pct'], conv_prev.get('conversion_pct', 0), bool(conv_prev.get('incoming')))}"
            )

        if c["received"] and c["missed_pct"] > MISSED_LIMIT:
            alerts.append(f"Пропущено {_pct(c['missed_pct'])} звонков — выше порога {_pct(MISSED_LIMIT)}")
        if lost:
            alerts.append(
                f"{_num(lost)} {_plural(lost, 'клиент так и не дождался', 'клиента так и не дождались', 'клиентов так и не дождались')}"
                " ответа: не перезвонили или не дозвонились"
            )
        if c.get("avg_reaction_sec", 0) > REACTION_SLOW:
            alerts.append(f"Перезванивали медленно: в среднем через {_dur(c['avg_reaction_sec'])}")
        if conv["incoming"] >= 10 and conv["conversion_pct"] < CONV_GOOD:
            alerts.append(f"Конверсия в запись {_pct(conv['conversion_pct'])} — ниже нормы {_pct(CONV_GOOD)}")

        # Операторы: лучший и отстающий по конверсии, у кого потери
        ops = [o for o in data["conversion"]["operators"] if o["incoming"] >= 5]
        if len(ops) >= 2:
            ops.sort(key=lambda o: o["conversion_pct"], reverse=True)
            best, worst = ops[0], ops[-1]
            out.append(
                f"Лучшая конверсия — {best['surname']} ({_pct(best['conversion_pct'])}),"
                f" ниже всех — {worst['surname']} ({_pct(worst['conversion_pct'])})"
            )
        for uid, o in data["operators"].items():
            if settings.OPERATOR_ROLES.get(uid) != "callcenter":
                continue  # профосмотры — другая работа, потери там не про колл-центр
            if o.get("lost", 0) >= 3:
                surname = (o.get("name") or "").split(" ")[0]
                alerts.append(f"{surname}: потеряно {o['lost']} {_plural(o['lost'], 'клиент', 'клиента', 'клиентов')}")

    # ── Записи (по дню приёма)
    if see_appts:
        a, ap = data["appts"], data["appts_prev"]
        out += ["", "[b]Приёмы[/b]"]
        if a["total"]:
            resolved = a["visits"] + a["noshow"] + a.get("cancels", 0)
            visit_pct = a["visits"] / resolved * 100 if resolved else 0
            out.append(
                f"Пришли {_num(a['visits'])} из {_num(a['total'])} записанных{_delta(a['visits'], ap.get('visits', 0))}"
            )
            parts = [f"не пришли {_num(a['noshow'])}"]
            if a.get("cancels"):
                parts.append(f"отменили {_num(a['cancels'])}")
            if a.get("pending"):
                parts.append(f"без отметки {_num(a['pending'])}")
            out.append(", ".join(parts).capitalize())
            out.append(f"Новых пациентов {_num(a['new_patients'])}{_delta(a['new_patients'], ap.get('new_patients', 0))}")
            groups = data.get("appt_groups") or {}
            if groups:
                src = [f"{g['label'].lower()} {_num(g['count'])}" for g in
                       sorted(groups.values(), key=lambda g: g["count"], reverse=True)]
                out.append("Записали: " + ", ".join(src))
            if resolved >= 10 and visit_pct < VISIT_GOOD:
                alerts.append(f"Явка {_pct(visit_pct)} — ниже нормы {_pct(VISIT_GOOD)}")
        else:
            out.append("Приёмов не было")

    # ── Выручка
    if see_money:
        m, mp = data["pay"], data["pay_prev"]
        out += ["", "[b]Выручка[/b]"]
        if m["count"]:
            avg, avg_prev = m["total_paid"] / m["count"], (mp["total_paid"] / mp["count"] if mp["count"] else 0)
            out.append(f"{_rub(m['total_paid'])}{_delta(m['total_paid'], mp['total_paid'])}")
            out.append(
                f"{_num(m['count'])} {_plural(m['count'], 'оплата', 'оплаты', 'оплат')}"
                f" · средний чек {_rub(avg)}{_delta(avg, avg_prev)}"
            )
        else:
            out.append("Оплат не было")

    # ── План с начала месяца
    pl = data["plan"]
    if see_plans and (pl["calls_plan"] or pl["appts_plan"]):
        days_in_month = monthrange(day.year, day.month)[1]
        out += ["", f"[b]План на {_MONTHS[day.month - 1]}[/b] (с 1 по {day.day} число из {days_in_month})"]
        if see_calls and pl["calls_plan"]:
            pct = pl["calls_fact"] / pl["calls_plan"] * 100
            out.append(f"Принятые звонки: {_num(pl['calls_fact'])} из {_num(pl['calls_plan'])} — {_pct(pct)}")
            if pct < 90:
                alerts.append(f"Звонков принято {_pct(pct)} от плана с начала месяца")
        if see_appts and pl["appts_plan"]:
            pct = pl["appts_fact"] / pl["appts_plan"] * 100
            out.append(f"Записи: {_num(pl['appts_fact'])} из {_num(pl['appts_plan'])} — {_pct(pct)}")
            if pct < 90:
                alerts.append(f"Записей {_pct(pct)} от плана с начала месяца")

    # ── Обратить внимание
    if see_calls or see_appts or see_plans:
        out += ["", "[b]Обратить внимание[/b]"]
        out += [f"• {a}" for a in alerts] if alerts else ["Всё в норме"]

    if not (see_calls or see_appts or see_money):
        out += ["", "Разделов со статистикой вам не открыто — сводка пустая."]

    return "\n".join(out)


# ─── Битрикс24 ──────────────────────────────────────────────

class BitrixError(Exception):
    def __init__(self, code: str, text: str):
        super().__init__(f"{code}: {text}" if code else text)
        self.code = code


async def _call(method: str, payload: dict) -> object:
    """Вызов REST-метода через входящий вебхук."""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(settings.BITRIX_WEBHOOK_URL + method, json=payload)
    try:
        data = resp.json()
    except ValueError:
        raise BitrixError("HTTP_" + str(resp.status_code), resp.text[:200]) from None
    if "error" in data:
        raise BitrixError(str(data.get("error") or ""), str(data.get("error_description") or ""))
    return data.get("result")


def _client_id() -> str:
    return settings.DIGEST_BOT_CLIENT_ID


def public_url() -> str:
    """Адрес, на котором портал достучится до сервера (для событий бота)."""
    if settings.PUBLIC_URL:
        return settings.PUBLIC_URL.rstrip("/")
    for origin in settings.ALLOWED_ORIGINS:
        if origin.startswith("https://"):
            return origin.rstrip("/")
    return ""


def explain_error(e: Exception) -> str:
    """Понятное объяснение для админки."""
    code = getattr(e, "code", "")
    if code in ("insufficient_scope", "ACCESS_DENIED", "WRONG_AUTH_TYPE"):
        return ("У входящего вебхука Битрикс24 нет прав на чат-ботов. Откройте вебхук в портале "
                "(Разработчикам → Другое → Входящий вебхук) и добавьте права «Чат-боты (imbot)» "
                "и «Чат и уведомления (im)».")
    if code == "MAX_COUNT_ERROR":
        return "В портале уже создано максимальное число ботов для этого вебхука."
    return str(e) or "Неизвестная ошибка Битрикс24"


def _avatar_b64() -> str | None:
    try:
        return "".join(AVATAR_FILE.read_text().split()) or None
    except OSError:
        logger.warning("[digest] нет файла аватарки бота: %s", AVATAR_FILE)
        return None


async def sync_avatar(db: AsyncSession) -> None:
    """Поставить боту текущую аватарку, если в портале стоит старая. Ошибки не мешают сводке."""
    cfg = await get_config(db)
    if not cfg.get("bot_id") or (cfg.get("avatar_version") or 0) >= AVATAR_VERSION:
        return
    photo = _avatar_b64()
    if not photo:
        return
    try:
        await _call("imbot.update", {
            "BOT_ID": int(cfg["bot_id"]),
            "CLIENT_ID": _client_id(),
            "FIELDS": {"PROPERTIES": {"PERSONAL_PHOTO": photo}},
        })
    except Exception as e:  # noqa: BLE001 — аватарка не критична
        logger.warning("[digest] не удалось обновить аватарку бота: %s", e)
        return
    await update_config(db, avatar_version=AVATAR_VERSION)
    logger.info("[digest] аватарка бота обновлена (версия %s)", AVATAR_VERSION)


async def ensure_bot(db: AsyncSession) -> int:
    """ID бота «Пульс»: из настроек, найденный в портале или только что созданный."""
    cfg = await get_config(db)
    if cfg.get("bot_id"):
        await sync_avatar(db)
        return int(cfg["bot_id"])

    try:
        bots = await _call("imbot.bot.list", {"CLIENT_ID": _client_id()})
        for b in (bots or {}).values() if isinstance(bots, dict) else (bots or []):
            if b.get("CODE") == BOT_CODE:
                await update_config(db, bot_id=int(b["ID"]), bot_error=None)
                await sync_avatar(db)
                return int(b["ID"])
    except BitrixError:
        pass  # список недоступен — пробуем создать

    base = public_url()
    if not base:
        err = "Не задан PUBLIC_URL — адрес сервера, на который портал шлёт события бота."
        await update_config(db, bot_error=err)
        raise BitrixError("NO_PUBLIC_URL", err)

    props = {
        "NAME": "Пульс",
        "WORK_POSITION": "Утренняя сводка по клинике",
        "COLOR": "AZURE",
    }
    photo = _avatar_b64()
    if photo:
        props["PERSONAL_PHOTO"] = photo
    try:
        bot_id = await _call("imbot.register", {
            "CODE": BOT_CODE,
            "TYPE": "B",
            "CLIENT_ID": _client_id(),
            "EVENT_HANDLER": f"{base}/bitrix/bot-event",
            "OPENLINE": "N",
            "PROPERTIES": props,
        })
    except BitrixError as e:
        await update_config(db, bot_error=explain_error(e))
        raise
    await update_config(db, bot_id=int(bot_id), bot_error=None,
                        avatar_version=AVATAR_VERSION if photo else 0)
    logger.info("[digest] зарегистрирован бот «Пульс», id=%s", bot_id)
    return int(bot_id)


def _keyboard(app_url: str) -> list | None:
    if not app_url:
        return None
    return [{
        "TEXT": "Открыть «Пульс»", "LINK": app_url,
        "BG_COLOR": "#328FCD", "TEXT_COLOR": "#FFFFFF", "DISPLAY": "LINE",
    }]


async def send_message(db: AsyncSession, user_id: str, text: str) -> str:
    """Отправить одному человеку. Возвращает способ: 'bot' или 'notify'."""
    cfg = await get_config(db)
    try:
        bot_id = await ensure_bot(db)
    except BitrixError:
        bot_id = None

    if bot_id:
        payload = {
            "BOT_ID": bot_id, "CLIENT_ID": _client_id(), "DIALOG_ID": str(user_id),
            "MESSAGE": text, "URL_PREVIEW": "N",
        }
        kb = _keyboard(cfg.get("app_url", ""))
        if kb:
            payload["KEYBOARD"] = kb
        try:
            await _call("imbot.message.add", payload)
            return "bot"
        except BitrixError as e:
            if e.code in ("BOT_ID_ERROR", "APP_ID_ERROR"):
                # бота удалили в портале — создадим заново и повторим один раз
                await update_config(db, bot_id=None)
                bot_id = await ensure_bot(db)
                payload["BOT_ID"] = bot_id
                await _call("imbot.message.add", payload)
                return "bot"
            raise

    link = f"\n\n[url={cfg['app_url']}]Открыть «Пульс»[/url]" if cfg.get("app_url") else ""
    await _call("im.notify.system.add", {"USER_ID": int(user_id), "MESSAGE": text + link})
    return "notify"


# ─── Отправка ───────────────────────────────────────────────

async def send_digest(db: AsyncSession, day: date | None = None,
                      only_user: str | None = None) -> dict:
    """
    Собрать и разослать сводку за `day` (по умолчанию — вчера).
    only_user — отправить одному человеку (кнопка «Отправить мне» в админке),
    без проверки «уже отправляли» и без записи итога.
    """
    day = day or today_local() - timedelta(days=1)
    cfg = await get_config(db)

    ids = [only_user] if only_user else [str(i) for i in cfg.get("recipients", [])]
    users = list((await db.execute(
        select(AppUser).where(AppUser.bitrix_user_id.in_(ids), AppUser.is_active.is_(True))
    )).scalars().all()) if ids else []

    result: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "for_day": day.isoformat(),
        "sent": [], "failed": [], "skipped": None,
    }
    if not users:
        result["skipped"] = "Нет получателей" if not only_user else "Вас нет среди активных пользователей"
        return result

    data = await build_digest(db, day)
    if is_empty(data) and not only_user:
        result["skipped"] = "За день нет данных — выходной или сбор не прошёл"
        return result

    for u in users:
        perms = effective_permissions(u.role, u.permissions)
        try:
            how = await send_message(db, u.bitrix_user_id, render_digest(data, perms))
            result["sent"].append({"id": u.bitrix_user_id, "name": u.name, "via": how})
        except Exception as e:  # noqa: BLE001 — один сбой не должен останавливать рассылку
            logger.warning("[digest] не отправлено %s: %s", u.bitrix_user_id, e)
            result["failed"].append({"id": u.bitrix_user_id, "name": u.name, "error": explain_error(e)})
    return result


async def preview(db: AsyncSession, perms: frozenset[str], day: date | None = None) -> dict:
    day = day or today_local() - timedelta(days=1)
    data = await build_digest(db, day)
    return {"for_day": day.isoformat(), "empty": is_empty(data), "text": render_digest(data, perms)}
