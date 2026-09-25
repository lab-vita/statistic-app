"""
Аналитика звонков: обратные звонки, статистика по операторам, дельты.
Вынесено из api/calls.py, чтобы роутеры оставались только HTTP-слоем.
"""
from app.core.utils import calc_delta, add_deltas
from app.core.config import settings

MAX_CALLBACK_HOURS = 24

# Операторы колл-центра — только те, у кого считается конверсия звонок → запись
# Жданова (544) — профосмотры, конверсию не считаем
CONVERSION_OPERATOR_IDS: list[str] = ["168", "520", "696"]


def _operator_surname(uid: str) -> str | None:
    """Возвращает фамилию оператора (первое слово из полного имени)."""
    full = settings.LABVITA_OPERATORS.get(uid, "")
    return full.split()[0] if full else None


def calc_callbacks(calls: list) -> list:
    """Для каждого пропущенного звонка определяет, был ли сделан обратный звонок."""
    missed = [c for c in calls if c.is_missed]
    outgoing = [c for c in calls if c.is_outgoing]

    out_by_phone: dict[str, list] = {}
    for c in outgoing:
        out_by_phone.setdefault(c.phone_number, []).append(c)

    results = []
    for m in missed:
        callback = None
        candidates = [
            c for c in out_by_phone.get(m.phone_number, [])
            if c.call_start_date > m.call_start_date
            and (c.call_start_date - m.call_start_date).total_seconds() <= MAX_CALLBACK_HOURS * 3600
        ]
        if candidates:
            callback = min(candidates, key=lambda c: c.call_start_date)

        results.append({
            "missed":           m,
            "called_back":      callback is not None,
            "reaction_seconds": int((callback.call_start_date - m.call_start_date).total_seconds()) if callback else None,
        })
    return results


def callback_stats(callback_results: list) -> dict:
    """Агрегат по обратным звонкам."""
    total = len(callback_results)
    called = [r for r in callback_results if r["called_back"]]
    times = [r["reaction_seconds"] for r in called if r["reaction_seconds"] is not None]
    return {
        "missed_total":     total,
        "callback_count":   len(called),
        "callback_pct":     round(len(called) / total * 100) if total else 0,
        "avg_reaction_sec": sum(times) // len(times) if times else 0,
    }


def operator_stats(calls: list) -> dict:
    """Статистика по каждому оператору + ИТОГО."""
    all_callbacks = calc_callbacks(calls)
    result: dict = {}

    for uid, name in settings.LABVITA_OPERATORS.items():
        op = [c for c in calls if c.portal_user_id == uid]
        durations  = [c.call_duration for c in op if c.call_duration > 0]
        wait_times = [c.call_duration for c in op if c.is_missed and c.call_duration > 0]
        op_cb = [r for r in all_callbacks if r["missed"].portal_user_id == uid]
        cb = callback_stats(op_cb)

        result[uid] = {
            "name":          name,
            "incoming":      sum(1 for c in op if c.is_incoming),
            "outgoing":      sum(1 for c in op if c.is_outgoing),
            "missed":        sum(1 for c in op if c.is_missed),
            "total":         len(op),
            "avg_duration":  sum(durations)  // len(durations)  if durations  else 0,
            "avg_wait_time": sum(wait_times) // len(wait_times) if wait_times else 0,
            **cb,
        }

    all_dur   = [c.call_duration for c in calls if c.call_duration > 0]
    all_waits = [c.call_duration for c in calls if c.is_missed and c.call_duration > 0]
    cb_total  = callback_stats(all_callbacks)
    result["total"] = {
        "name":          "ИТОГО",
        "incoming":      sum(1 for c in calls if c.is_incoming),
        "outgoing":      sum(1 for c in calls if c.is_outgoing),
        "missed":        sum(1 for c in calls if c.is_missed),
        "total":         len(calls),
        "avg_duration":  sum(all_dur)   // len(all_dur)   if all_dur   else 0,
        "avg_wait_time": sum(all_waits) // len(all_waits) if all_waits else 0,
        **cb_total,
    }
    return result


STATS_DELTA_KEYS = ("incoming", "outgoing", "missed", "total", "avg_duration", "callback_pct")


def operator_stats_with_deltas(curr_calls: list, prev_calls: list) -> dict:
    """Статистика по операторам с дельтами относительно предыдущего периода."""
    curr_ops = operator_stats(curr_calls)
    prev_ops = operator_stats(prev_calls)
    return {
        key: add_deltas(stats, prev_ops.get(key, {}), list(STATS_DELTA_KEYS))
        for key, stats in curr_ops.items()
    }


def conversion_stats(
    calls: list,
    appts_by_surname: dict[str, int],
) -> tuple[list, int, int]:
    """
    Конверсия звонок → запись для операторов колл-центра.

    Возвращает: (rows, total_incoming, total_appts)
    """
    result = []
    total_incoming = 0
    total_appts = 0

    for uid in CONVERSION_OPERATOR_IDS:
        surname = _operator_surname(uid)
        if not surname:
            continue
        op_calls = [c for c in calls if c.portal_user_id == uid]
        incoming = sum(1 for c in op_calls if c.is_incoming)
        op_appts = appts_by_surname.get(surname, 0)
        conversion = round(op_appts / incoming * 100, 1) if incoming else 0
        full_name = settings.LABVITA_OPERATORS.get(uid, surname)

        result.append({
            "operator_id":    uid,
            "name":           full_name,
            "surname":        surname,
            "incoming":       incoming,
            "appointments":   op_appts,
            "conversion_pct": conversion,
        })
        total_incoming += incoming
        total_appts    += op_appts

    return result, total_incoming, total_appts
