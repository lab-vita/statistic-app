#!/usr/bin/env python3
"""
Заполнение БД данными за предыдущие периоды.

Запуск:
    cd backend

    # Всё за период
    python scripts/backfill.py --from 2026-01-01 --to 2026-09-01

    # Только звонки и записи
    python scripts/backfill.py --from 2026-01-01 --to 2026-09-01 --only calls,appointments

    # Доступные сущности: calls, appointments, revenue, sales

Примечание по sales:
    МедОДС возвращает агрегат за весь переданный период.
    Для подневной разбивки запускаем один запрос на каждый день отдельно.
    Это медленнее чем для остальных сущностей, зато данные будут подневные.
"""
import asyncio
import sys
import argparse
from datetime import date, timedelta

sys.path.insert(0, ".")

ALL_COLLECTORS = ["calls", "appointments", "revenue", "sales"]


def _month_end(d: date) -> date:
    """Last day of the month for a given date."""
    if d.month == 12:
        return date(d.year, 12, 31)
    return date(d.year, d.month + 1, 1) - timedelta(days=1)


def _next_month(d: date) -> date:
    """First day of the next month."""
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


async def _run_by_month(name: str, fn, date_from: date, date_to: date):
    """Сбор по месяцам (звонки, записи, revenue)."""
    from app.db.database import async_session_factory
    current = date(date_from.year, date_from.month, 1)
    total = 0
    while current <= date_to:
        chunk_from = max(current, date_from)
        chunk_to   = min(_month_end(current), date_to)
        async with async_session_factory() as db:
            try:
                result = await fn(db, chunk_from, chunk_to)
                count = result if isinstance(result, int) else sum(result.values()) if isinstance(result, dict) else 0
                total += count
                print(f"    {chunk_from} — {chunk_to}: +{count}")
            except Exception as e:
                print(f"    {chunk_from} — {chunk_to}: ОШИБКА — {e}")
        current = _next_month(current)
    return total


async def _run_by_day(name: str, fn, date_from: date, date_to: date):
    """Сбор по дням (sales — каждый день отдельно)."""
    from app.db.database import async_session_factory
    current = date_from
    total = 0
    while current <= date_to:
        async with async_session_factory() as db:
            try:
                result = await fn(db, current, current)
                count = result if isinstance(result, int) else sum(result.values()) if isinstance(result, dict) else 0
                total += count
                print(f"    {current}: +{count}")
            except Exception as e:
                print(f"    {current}: ОШИБКА — {e}")
        current += timedelta(days=1)
    return total


async def run_backfill(collectors: list[str], date_from: date, date_to: date):
    from app.services.collector import collect_calls
    from app.services.medods_collector import collect_appointments
    from app.services.revenue_collector import collect_revenue
    from app.services.sales_collector import collect_sales

    span = (date_to - date_from).days + 1
    print(f"=== BACKFILL: {date_from} — {date_to} ({span} дней) ===")
    print(f"    Сущности: {', '.join(collectors)}")
    print()

    for name in collectors:
        print(f"[→] {name} ...")
        if name == "sales":
            # Sales: подневно, т.к. МедОДС агрегирует за период
            total = await _run_by_day(name, collect_sales, date_from, date_to)
        elif name == "calls":
            total = await _run_by_month(name, collect_calls, date_from, date_to)
        elif name == "appointments":
            total = await _run_by_month(name, collect_appointments, date_from, date_to)
        elif name == "revenue":
            total = await _run_by_month(name, collect_revenue, date_from, date_to)
        print(f"[✓] {name}: итого +{total}\n")

    print("✅ Бэкфилл завершён!")


def main():
    parser = argparse.ArgumentParser(description="Бэкфилл данных за период")
    parser.add_argument("--from", dest="date_from", required=True,
                        help="Начало периода YYYY-MM-DD")
    parser.add_argument("--to", dest="date_to", required=True,
                        help="Конец периода YYYY-MM-DD")
    parser.add_argument("--only", dest="only", default=None,
                        help=f"Через запятую: {','.join(ALL_COLLECTORS)}")
    args = parser.parse_args()

    date_from = date.fromisoformat(args.date_from)
    date_to   = date.fromisoformat(args.date_to)

    if date_from > date_to:
        print("Ошибка: --from должна быть <= --to")
        sys.exit(1)

    if args.only:
        collectors = [c.strip() for c in args.only.split(",")]
        unknown = [c for c in collectors if c not in ALL_COLLECTORS]
        if unknown:
            print(f"Неизвестные сущности: {', '.join(unknown)}")
            print(f"Доступные: {', '.join(ALL_COLLECTORS)}")
            sys.exit(1)
    else:
        collectors = ALL_COLLECTORS

    asyncio.run(run_backfill(collectors, date_from, date_to))


if __name__ == "__main__":
    main()
