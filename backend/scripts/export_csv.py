#!/usr/bin/env python3
"""
Выгрузка всех таблиц в CSV для анализа.

Запуск:
    cd backend && python scripts/export_csv.py

Файлы появятся в папке backend/exports/
"""
import asyncio
import csv
import sys
from datetime import datetime
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
    from sqlalchemy import select, text
    from app.db.database import engine, Base, async_session_factory

    print(f"=== ЭКСПОРТ CSV: {datetime.now():%Y-%m-%d %H:%M} ===\n")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app.models.call import Call
    from app.models.appointment import Appointment
    from app.models.payment import Payment
    from app.models.revenue import Revenue
    from app.models.payment_detail import PaymentDetail
    from app.models.sale import Sale

    # 1. Звонки
    await export_table(
        async_session_factory,
        "calls.csv",
        select(
            Call.id, Call.bitrix_id, Call.call_type, Call.call_failed_code,
            Call.call_start_date, Call.call_duration, Call.portal_number,
            Call.portal_user_id, Call.phone_number, Call.crm_entity_type,
            Call.crm_entity_id, Call.is_incoming, Call.is_outgoing, Call.is_missed,
        ).order_by(Call.call_start_date),
        ["id", "bitrix_id", "call_type", "call_failed_code", "call_start_date",
         "call_duration", "portal_number", "portal_user_id", "phone_number",
         "crm_entity_type", "crm_entity_id", "is_incoming", "is_outgoing", "is_missed"],
    )

    # 2. Записи на приём
    await export_table(
        async_session_factory,
        "appointments.csv",
        select(
            Appointment.id, Appointment.medods_id, Appointment.appointment_date,
            Appointment.appointment_time, Appointment.status, Appointment.new_patient,
            Appointment.client_id, Appointment.client_name, Appointment.client_surname,
            Appointment.client_phone, Appointment.doctor_id, Appointment.doctor_name,
            Appointment.administrator_id, Appointment.administrator_name,
            Appointment.administrator_surname, Appointment.attraction_source_id,
            Appointment.attraction_source_title, Appointment.services_json,
            Appointment.created_at_medods,
        ).order_by(Appointment.appointment_date),
        ["id", "medods_id", "appointment_date", "appointment_time", "status",
         "new_patient", "client_id", "client_name", "client_surname", "client_phone",
         "doctor_id", "doctor_name", "administrator_id", "administrator_name",
         "administrator_surname", "attraction_source_id", "attraction_source_title",
         "services_json", "created_at_medods"],
    )

    # 3. Payments (агрегат по типам оплат)
    await export_table(
        async_session_factory,
        "payments.csv",
        select(
            Payment.id, Payment.payment_date, Payment.payment_type,
            Payment.amount, Payment.total_sum, Payment.percent,
        ).order_by(Payment.payment_date, Payment.payment_type),
        ["id", "payment_date", "payment_type", "amount", "total_sum", "percent"],
    )

    # 4. Revenue (агрегат по типам оплат из create_payment_types)
    await export_table(
        async_session_factory,
        "revenue.csv",
        select(
            Revenue.id, Revenue.revenue_date, Revenue.payment_type,
            Revenue.amount, Revenue.total, Revenue.percent,
        ).order_by(Revenue.revenue_date, Revenue.payment_type),
        ["id", "revenue_date", "payment_type", "amount", "total", "percent"],
    )

    # 5. Payment details (детальные платежи)
    await export_table(
        async_session_factory,
        "payment_details.csv",
        select(
            PaymentDetail.id, PaymentDetail.medods_id, PaymentDetail.payment_date,
            PaymentDetail.kind, PaymentDetail.by_cash, PaymentDetail.by_cashless,
            PaymentDetail.by_card, PaymentDetail.by_balance, PaymentDetail.by_credit,
            PaymentDetail.total_income, PaymentDetail.total_paid,
            PaymentDetail.client_id, PaymentDetail.client_name, PaymentDetail.client_surname,
            PaymentDetail.company_id, PaymentDetail.company_title,
            PaymentDetail.order_id, PaymentDetail.order_sum, PaymentDetail.order_date,
            PaymentDetail.doctor_id, PaymentDetail.doctor_name, PaymentDetail.doctor_surname,
        ).order_by(PaymentDetail.payment_date, PaymentDetail.medods_id),
        ["id", "medods_id", "payment_date", "kind", "by_cash", "by_cashless",
         "by_card", "by_balance", "by_credit", "total_income", "total_paid",
         "client_id", "client_name", "client_surname", "company_id", "company_title",
         "order_id", "order_sum", "order_date", "doctor_id", "doctor_name", "doctor_surname"],
    )

    # 6. Sales (продажи по номенклатуре)
    await export_table(
        async_session_factory,
        "sales.csv",
        select(
            Sale.id, Sale.sale_date, Sale.service_title, Sale.unit,
            Sale.amount, Sale.total_sum, Sale.final_sum, Sale.sum_percent,
        ).order_by(Sale.sale_date, Sale.service_title),
        ["id", "sale_date", "service_title", "unit", "amount",
         "total_sum", "final_sum", "sum_percent"],
    )

    print(f"\n✅ Готово! Файлы в папке: {EXPORT_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
