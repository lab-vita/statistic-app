"""
Аналитика записей (приёмов): статистика, дельты, разбивка по группам.
Вынесено из api/appointments.py.
"""
from app.core.utils import add_deltas
from app.core.config import settings

GROUP_LABELS: dict[str, str] = {
    "callcenter": "Колл-центр",
    "admin":      "Администраторы",
    "other":      "Прочие",
    "unknown":    "Не указан",
}

STATS_KEYS = (
    "total", "visits", "noshow", "new_patients", "callcenter_total",
    "visit_pct", "noshow_pct", "cancel_pct",
)


def stats_from_appts(appts: list) -> dict:
    """Агрегат по списку записей."""
    total   = len(appts)
    visits  = sum(1 for a in appts if a.is_visit)
    noshow  = sum(1 for a in appts if a.is_noshow)
    cancels = sum(1 for a in appts if a.is_cancelled)
    pending = sum(1 for a in appts if a.is_pending)
    new_pts = sum(1 for a in appts if a.new_patient)
    cc      = sum(1 for a in appts if a.is_callcenter)
    return {
        "total":            total,
        "visits":           visits,
        "noshow":           noshow,
        "cancels":          cancels,
        "pending":          pending,
        "new_patients":     new_pts,
        "callcenter_total": cc,
        "visit_pct":        round(visits  / total * 100, 1) if total else 0,
        "noshow_pct":       round(noshow  / total * 100, 1) if total else 0,
        "new_pct":          round(new_pts / total * 100, 1) if total else 0,
        "cancel_pct":       round(cancels / total * 100, 1) if total else 0,
    }


def group_breakdown(appts: list, total: int) -> dict:
    """Разбивка записей по группам сотрудников."""
    groups: dict[str, int] = {"callcenter": 0, "admin": 0, "other": 0, "unknown": 0}
    for a in appts:
        surname    = a.administrator_surname
        group_info = settings.ADMIN_GROUPS.get(surname) if surname else None
        group      = group_info["group"] if group_info else "unknown"
        groups[group] = groups.get(group, 0) + 1

    return {
        g: {
            "count": cnt,
            "pct":   round(cnt / total * 100, 1) if total else 0,
            "label": GROUP_LABELS.get(g, g),
        }
        for g, cnt in groups.items()
        if cnt > 0
    }


def by_admin_stats(curr_appts: list, prev_appts: list) -> dict:
    """Статистика по каждому администратору с дельтами."""
    all_surnames = {a.administrator_surname for a in curr_appts if a.administrator_surname}
    result: dict = {}
    for surname in sorted(all_surnames):
        curr_sub = [a for a in curr_appts if a.administrator_surname == surname]
        prev_sub = [a for a in prev_appts if a.administrator_surname == surname]
        group_info = settings.ADMIN_GROUPS.get(surname, {"group": "other", "label": "Прочие"})
        curr_s = stats_from_appts(curr_sub)
        prev_s = stats_from_appts(prev_sub)
        result[surname] = {
            "name":          surname,
            "group":         group_info["group"],
            "group_label":   group_info["label"],
            "is_callcenter": group_info["group"] == "callcenter",
            **add_deltas(curr_s, prev_s, list(STATS_KEYS)),
        }
    return result
