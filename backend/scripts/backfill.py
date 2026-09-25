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
"""
import asyncio
import sys
import argparse
from datetime import date, timedelta

sys.path.insert(0, ".")

ALL_COLLECTORS = ["calls", "appointments", "revenue", "sales"]


async def run_backfill(collectors: list[str], date_from: date, date_to: date):
    from app.db.database import async_session_factory
    from app.services.collector import collect_calls
    from app.services.medods_collector import collect_appointments
    from app.services.revenue_collector import collect_revenue
    from app.services.sales_collector import collect_sales

    COLLECTOR_MAP = {
        "calls":        collect_calls,
        "appointments": collect_appointments,
        "revenue":      collect_revenue,
        "sales":        collect_sales,
    }

    span = (date_to - date_from).days + 1
    print(f"=== BACKFILL: {date_from} — {date_to} ({span} дней) ===")
    print(f"    Сущности: {', '.join(collectors)}")
    print()

    for name in collectors:
        fn = COLLECTOR_MAP[name]
        print(f"[→] {name} ...")
        # Сбор по одному месяцу за раз, чтобы не грузить API одним запросом
        current = date_from
        total = 0
        while current <= date_to:
            month_end = min(
                date(current.year, current.month, 1) + timedelta(days=32),
                date_to + timedelta(days=1)
            )
            month_end = date(month_end.year, month_end.month, 1) - timedelta(days=1)
            month_end = min(month_end, date_to)

            async with async_session_factory() as db:
                try:
                    result = await fn(db, current, month_end)
                    count = result if isinstance(result, int) else sum(result.values()) if isinstance(result, dict) else 0
                    total += count
                    print(f"    {current} — {month_end}: +{count}")
                except Exception as e:
                    print(f"    {current} — {month_end}: ОШИБКА — {e}")

            # Переходим на первое число следующего месяца
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)

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
