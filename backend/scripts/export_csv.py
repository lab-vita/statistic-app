#!/usr/bin/env python3
"""
Выгрузка всех таблиц в CSV для анализа.

Запуск:
    cd backend
    python scripts/export_csv.py
    python scripts/export_csv.py --tables calls,appointments
    python scripts/export_csv.py --from 2026-01-01 --to 2026-09-01

Файлы появятся в backend/exports/
"""
import asyncio
import csv
import sys
import argparse
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, ".")

EXPORT_DIR = Path("exports")


async def export_table(session_factory, filename: str, query, columns: list[str]):
    EXPORT_DIR.mkdir(exist_ok=True)
    path = EXPORT_DIR / filename
    async with session_factory() as db:
        result = await db.execute(query)
        rows = result.fetchall()
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        writer.writerows(rows)
    print(f"  {filename}: {len(rows)} строк → {path}")


async def main():
    parser = argparse.ArgumentParser(description="Экспорт таблиц в CSV")
    parser.add_argument("--tables", default="all",
                        help="Какие таблицы экспортировать: all или через запятую (calls,appointments,revenue,sales,services)")
    parser.add_argument("--from", dest="date_from", default=None,
                        help="Фильтр от даты YYYY-MM-DD (для таблиц с датами)")
    parser.add_argument("--to", dest="date_to", default=None,
                        help="Фильтр до даты YYYY-MM-DD")
    args = parser.parse_args()

    date_from = date.fromisoformat(args.date_from) if args.date_from else None
    date_to   = date.fromisoformat(args.date_to)   if args.date_to   else None

    tables = set(args.tables.split(",")) if args.tables != "all" else None

    from sqlalchemy import select, and_
    from app.db.database import async_session_factory
    from app.models.call import Call
    from app.models.appointment import Appointment
    from app.models.revenue import Revenue
    from app.models.sale import Sale
    from app.models.service import Service, ServiceCategory

    print(f"=== ЭКСПОРТ CSV: {datetime.now():%Y-%m-%d %H:%M} ===")
    if date_from or date_to:
        print(f"    Период: {date_from or '...'} — {date_to or '...'}")
    print()

    def date_filter(col):
        filters = []
        if date_from:
            filters.append(col >= date_from)
        if date_to:
            filters.append(col <= date_to)
        return and_(*filters) if filters else True

    # 1. Звонки
    if tables is None or "calls" in tables:
        await export_table(
            async_session_factory,
            "calls.csv",
            select(
                Call.id, Call.bitrix_id, Call.call_type, Call.call_failed_code,
                Call.call_start_date, Call.call_duration, Call.portal_number,
                Call.portal_user_id, Call.phone_number,
                Call.is_incoming, Call.is_outgoing, Call.is_missed,
            ).where(date_filter(Call.call_start_date)).order_by(Call.call_start_date),
            ["id", "bitrix_id", "call_type", "call_failed_code", "call_start_date",
             "call_duration", "portal_number", "portal_user_id", "phone_number",
             "is_incoming", "is_outgoing", "is_missed"],
        )

    # 2. Записи на приём
    if tables is None or "appointments" in tables:
        await export_table(
            async_session_factory,
            "appointments.csv",
            select(
                Appointment.id, Appointment.medods_id, Appointment.appointment_date,
                Appointment.appointment_time, Appointment.status, Appointment.new_patient,
                Appointment.is_callcenter,
                Appointment.client_id, Appointment.client_name, Appointment.client_surname,
                Appointment.client_phone, Appointment.doctor_id, Appointment.doctor_name,
                Appointment.administrator_id, Appointment.administrator_name,
                Appointment.administrator_surname, Appointment.attraction_source_id,
                Appointment.attraction_source_title, Appointment.services_json,
                Appointment.created_at_medods,
            ).where(date_filter(Appointment.appointment_date)).order_by(Appointment.appointment_date),
            ["id", "medods_id", "appointment_date", "appointment_time", "status",
             "new_patient", "is_callcenter", "client_id", "client_name", "client_surname",
             "client_phone", "doctor_id", "doctor_name", "administrator_id",
             "administrator_name", "administrator_surname", "attraction_source_id",
             "attraction_source_title", "services_json", "created_at_medods"],
        )

    # 3. Revenue
    if tables is None or "revenue" in tables:
        await export_table(
            async_session_factory,
            "revenue.csv",
            select(
                Revenue.id, Revenue.revenue_date, Revenue.payment_type,
                Revenue.amount, Revenue.total, Revenue.percent,
            ).where(date_filter(Revenue.revenue_date)).order_by(Revenue.revenue_date, Revenue.payment_type),
            ["id", "revenue_date", "payment_type", "amount", "total", "percent"],
        )

    # 4. Sales
    if tables is None or "sales" in tables:
        await export_table(
            async_session_factory,
            "sales.csv",
            select(
                Sale.id, Sale.sale_date, Sale.service_title, Sale.unit,
                Sale.amount, Sale.total_sum, Sale.final_sum, Sale.sum_percent,
                Sale.service_id, Sale.exclude_from_analytics,
            ).where(date_filter(Sale.sale_date)).order_by(Sale.sale_date, Sale.service_title),
            ["id", "sale_date", "service_title", "unit", "amount",
             "total_sum", "final_sum", "sum_percent", "service_id", "exclude_from_analytics"],
        )

    # 5. Справочник услуг
    if tables is None or "services" in tables:
        await export_table(
            async_session_factory,
            "services.csv",
            select(
                Service.id, Service.title, Service.category_id,
                Service.price, Service.kind, Service.unit, Service.deleted,
                Service.exclude_from_analytics,
            ).order_by(Service.category_id, Service.title),
            ["id", "title", "category_id", "price", "kind", "unit", "deleted", "exclude_from_analytics"],
        )

        await export_table(
            async_session_factory,
            "service_categories.csv",
            select(
                ServiceCategory.id, ServiceCategory.title, ServiceCategory.parent_id,
            ).order_by(ServiceCategory.title),
            ["id", "title", "parent_id"],
        )

    print(f"\n✅ Готово! Файлы в папке: {EXPORT_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
