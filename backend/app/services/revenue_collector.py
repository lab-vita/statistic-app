import asyncio
import logging
from datetime import date, timedelta
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.medods import login, fetch_payment_types
from app.models.revenue import Revenue

logger = logging.getLogger(__name__)

async def collect_revenue(db: AsyncSession, date_from: date, date_to: date) -> dict:
    client = await login()
    results = {}
    try:
        current = date_from
        while current <= date_to:
            try:
                rows = await fetch_payment_types(client, current)
                count = await _upsert_day(db, current, rows)
                results[str(current)] = count
                logger.info(f"[revenue] {current}: {count} типов оплат")
            except Exception as e:
                logger.error(f"[revenue] Ошибка за {current}: {e}")
                results[str(current)] = 0
            current += timedelta(days=1)
            if current <= date_to:
                await asyncio.sleep(0.3)
    finally:
        await client.aclose()
    await db.commit()
    return results

async def _upsert_day(db: AsyncSession, day: date, rows: list[dict]) -> int:
    count = 0
    for row in rows:
        title   = row.get("title", "").strip()
        amount  = int(row.get("amount", 0) or 0)
        total   = float(row.get("sum", 0.0) or 0.0)
        percent = float(row.get("percent", 0.0) or 0.0)
        if not title:
            continue
        existing = await db.scalar(
            select(Revenue).where(and_(Revenue.revenue_date == day, Revenue.payment_type == title))
        )
        if existing:
            existing.amount  = amount
            existing.total   = total
            existing.percent = percent
        else:
            db.add(Revenue(revenue_date=day, payment_type=title, amount=amount, total=total, percent=percent))
        count += 1
    return count
