#!/usr/bin/env python3
"""
Матчинг звонков и записей: заполняет appointments.call_id.

Логика:
    Для каждой записи с client_phone берём первый входящий звонок
    с тем же нормализованным номером, который произошёл за 3 дня
    ДО даты записи (окно: [date - 3 дня, date]).

    Это ключевая метрика конверсии:
        «Клиент позвонил → записался на приём».

Запуск:
    cd backend

    # Смотрим сколько записей сматчится (dry-run)
    python scripts/match_calls.py --dry-run

    # Применяем
    python scripts/match_calls.py

    # Только за конкретный период (по дате записи)
    python scripts/match_calls.py --from 2026-01-01 --to 2026-09-30

    # Перезаписать уже заполненные call_id (пересчёт)
    python scripts/match_calls.py --overwrite
"""
import asyncio
import argparse
import sys
from datetime import date, timedelta

sys.path.insert(0, ".")

# Временное окно: звонок должен быть за N дней до записи (включительно)
MATCH_WINDOW_DAYS = 3


async def run_matching(
    date_from: date | None,
    date_to: date | None,
    dry_run: bool,
    overwrite: bool,
) -> None:
    from sqlalchemy import select, text
    from app.db.database import async_session_factory

    async with async_session_factory() as db:
        # Строим фильтр по периоду
        period_filter = ""
        params: dict = {}
        if date_from:
            period_filter += " AND a.appointment_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            period_filter += " AND a.appointment_date <= :date_to"
            params["date_to"] = date_to

        overwrite_filter = "" if overwrite else " AND a.call_id IS NULL"

        # Считаем кандидатов
        count_sql = text(f"""
            SELECT COUNT(*)
            FROM appointments a
            WHERE a.client_phone IS NOT NULL
              AND a.client_phone != ''
              {period_filter}
              {overwrite_filter}
        """)
        total = (await db.execute(count_sql, params)).scalar_one()
        print(f"Записей для матчинга: {total}")
        if total == 0:
            print("Нечего обрабатывать.")
            return

        # Основной запрос: для каждой записи находим первый подходящий звонок
        # Используем коррелированный подзапрос — работает на любом объёме
        match_sql = text(f"""
            SELECT
                a.id        AS appointment_id,
                a.appointment_date,
                a.client_phone,
                (
                    SELECT c.id
                    FROM calls c
                    WHERE c.phone_number = a.client_phone
                      AND c.is_incoming = TRUE
                      AND c.call_start_date::date
                            BETWEEN a.appointment_date - INTERVAL '{MATCH_WINDOW_DAYS} days'
                                AND a.appointment_date
                    ORDER BY c.call_start_date ASC
                    LIMIT 1
                ) AS matched_call_id
            FROM appointments a
            WHERE a.client_phone IS NOT NULL
              AND a.client_phone != ''
              {period_filter}
              {overwrite_filter}
        """)

        rows = (await db.execute(match_sql, params)).fetchall()

        matched = [r for r in rows if r.matched_call_id is not None]
        unmatched = [r for r in rows if r.matched_call_id is None]

        print(f"Найдено совпадений:  {len(matched)} / {total} "
              f"({len(matched)/total*100:.1f}%)")
        print(f"Без совпадения:      {len(unmatched)}")

        if dry_run:
            print("\n[dry-run] Изменения не применены.")
            # Показываем примеры совпадений
            if matched:
                print("\nПримеры совпадений (первые 5):")
                for r in matched[:5]:
                    print(f"  appointment {r.appointment_id} "
                          f"({r.appointment_date}, {r.client_phone}) "
                          f"→ call {r.matched_call_id}")
            return

        # Обновляем батчами по 500
        batch_size = 500
        updated = 0
        for i in range(0, len(matched), batch_size):
            batch = matched[i : i + batch_size]
            # Строим VALUES для bulk update
            values = ", ".join(
                f"({r.appointment_id}, {r.matched_call_id})" for r in batch
            )
            await db.execute(text(f"""
                UPDATE appointments AS a
                SET call_id = v.call_id
                FROM (VALUES {values}) AS v(id, call_id)
                WHERE a.id = v.id
            """))
            updated += len(batch)
            print(f"  Обновлено {updated}/{len(matched)}...")

        await db.commit()
        print(f"\n✅ Готово: {updated} записей получили call_id.")


def main():
    parser = argparse.ArgumentParser(
        description="Матчинг звонков → записей на приём по телефону + временному окну"
    )
    parser.add_argument("--from", dest="date_from", default=None,
                        help="Фильтр по дате записи (начало) YYYY-MM-DD")
    parser.add_argument("--to", dest="date_to", default=None,
                        help="Фильтр по дате записи (конец) YYYY-MM-DD")
    parser.add_argument("--dry-run", action="store_true",
                        help="Только подсчёт, без записи в БД")
    parser.add_argument("--overwrite", action="store_true",
                        help="Перезаписать уже заполненные call_id (пересчёт)")
    args = parser.parse_args()

    date_from = date.fromisoformat(args.date_from) if args.date_from else None
    date_to   = date.fromisoformat(args.date_to)   if args.date_to   else None

    asyncio.run(run_matching(
        date_from=date_from,
        date_to=date_to,
        dry_run=args.dry_run,
        overwrite=args.overwrite,
    ))


if __name__ == "__main__":
    main()
