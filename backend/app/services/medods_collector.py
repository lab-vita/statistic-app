import json
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.medods import login, fetch_appointments
from app.models.appointment import Appointment


def _parse_appointment(raw: dict) -> dict:
    """Парсит одну запись из ответа МедОДС."""
    a       = raw.get("appointment", raw)  # поддержка обоих форматов
    client  = a.get("client")  or {}
    doctor  = a.get("doctor")  or {}
    admin   = a.get("administrator") or {}
    source  = a.get("attractionSource") or {}
    services = [et["title"] for et in (a.get("entryTypes") or [])]

    # Парсим дату приёма
    appt_date = None
    if a.get("date"):
        try:
            appt_date = datetime.strptime(a["date"], "%Y-%m-%d").date()
        except Exception:
            pass

    # Парсим дату создания
    created_at = None
    if a.get("createdAt"):
        try:
            created_at = datetime.fromisoformat(a["createdAt"].split(".")[0])
        except Exception:
            pass

    return {
        "medods_id":               a.get("id"),
        "appointment_date":        appt_date,
        "appointment_time":        a.get("time", ""),
        "status":                  a.get("status", 0),
        "note":                    a.get("note"),
        "new_patient":             bool(a.get("newPatient", False)),
        "created_at_medods":       created_at,
        "client_id":               client.get("id"),
        "client_name":             client.get("name"),
        "client_surname":          client.get("surname"),
        "client_phone":            client.get("phone"),
        "doctor_id":               doctor.get("id"),
        "doctor_name":             f"{doctor.get('surname','')} {doctor.get('name','')}".strip(),
        "administrator_id":        admin.get("id"),
        "administrator_name":      admin.get("name"),
        "administrator_surname":   admin.get("surname"),
        "attraction_source_id":    source.get("id"),
        "attraction_source_title": source.get("title"),
        "services_json":           json.dumps(services, ensure_ascii=False) if services else None,
    }


async def collect_appointments(
    db: AsyncSession,
    date_from: date,
    date_to: date,
) -> int:
    """Авторизуется, собирает записи из МедОДС и сохраняет в БД."""
    client = await login()
    try:
        raw_records = await fetch_appointments(client, date_from, date_to)
    finally:
        await client.aclose()

    new_count = 0
    for raw in raw_records:
        parsed    = _parse_appointment(raw)
        medods_id = parsed.get("medods_id")

        if not medods_id:
            continue

        # Проверяем — уже есть в БД?
        exists = await db.scalar(
            select(Appointment).where(Appointment.medods_id == medods_id)
        )
        if exists:
            # Обновляем статус (он может измениться)
            exists.status = parsed["status"]
            continue

        db.add(Appointment(**parsed))
        new_count += 1

    await db.commit()
    return new_count