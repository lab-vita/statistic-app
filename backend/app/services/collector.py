from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.bitrix import fetch_all_calls, classify_call
from app.models.call import Call
from app.core.config import settings

async def collect_calls(db: AsyncSession, date_from: date, date_to: date) -> int:
    raw_calls = await fetch_all_calls(date_from, date_to)
    labvita_calls = [
        c for c in raw_calls
        if str(c.get("PORTAL_USER_ID", "")) in settings.LABVITA_OPERATORS
    ]

    new_count = 0
    for raw in labvita_calls:
        bitrix_id = str(raw.get("ID"))
        if await db.scalar(select(Call).where(Call.bitrix_id == bitrix_id)):
            continue
        try:
            call_date = datetime.fromisoformat(raw.get("CALL_START_DATE", ""))
        except Exception:
            continue

        db.add(Call(
            bitrix_id        = bitrix_id,
            call_type        = str(raw.get("CALL_TYPE", "")),
            call_failed_code = str(raw.get("CALL_FAILED_CODE", "")),
            call_start_date  = call_date,
            call_duration    = int(raw.get("CALL_DURATION", 0) or 0),
            portal_number    = str(raw.get("PORTAL_NUMBER", "")),
            portal_user_id   = str(raw.get("PORTAL_USER_ID", "")),
            phone_number     = str(raw.get("PHONE_NUMBER", "")),
            crm_entity_type  = raw.get("CRM_ENTITY_TYPE"),
            crm_entity_id    = raw.get("CRM_ENTITY_ID"),
            call_record_url  = raw.get("CALL_RECORD_URL"),
            **classify_call(raw),
        ))
        new_count += 1

    await db.commit()
    return new_count