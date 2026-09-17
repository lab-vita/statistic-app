"""Коллектор выручки: авторизация → запрос по дням → upsert в БД."""
import logging
from datetime import date, timedelta

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.services.medods import login
from app.services.medods_payments import fetch_payment_types

logger = logging.getLogger(__name__)


async def collect_payments(
    db: AsyncSession,
    date_from: date,
    date_to: date,
) -> int:
    """Собирает выручку по типам оплат из МедОДС за период [date_from, date_to].

    Авторизуется один раз, затем итерируется по дням.
    Строки с нулевой суммой пропускаются — нет смысла хранить пустые типы.
    Возвращает количество созданных/обновлённых строк.
    """
    client = await login()
    total_upserted = 0

    try:
        current = date_from
        while current <= date_to:
            try:
                rows = await fetch_payment_types(client, current)
            except Exception as e:
                logger.error(f"[payments] Ошибка за {current}: {e}")
                current += timedelta(days=1)
                continue

            day_count = 0
            for row in rows:
                payment_type = (row.get("title") or "").strip()
                amount       = int(row.get("amount") or 0)
                total_sum    = float(row.get("sum") or 0.0)
                percent      = float(row.get("percent") or 0.0)

                # Пропускаем пустые типы оплат
                if not payment_type or (amount == 0 and total_sum == 0.0):
                    continue

                existing = await db.scalar(
                    select(Payment).where(
                        and_(
                            Payment.payment_date == current,
                            Payment.payment_type == payment_type,
                        )
                    )
                )

                if existing:
                    existing.amount    = amount
                    existing.total_sum = total_sum
                    existing.percent   = percent
                else:
                    db.add(Payment(
                        payment_date=current,
                        payment_type=payment_type,
                        amount=amount,
                        total_sum=total_sum,
                        percent=percent,
                    ))

                day_count      += 1
                total_upserted += 1

            await db.commit()
            logger.info(f"[payments] {current}: {day_count} типов оплат")
            current += timedelta(days=1)

    finally:
        await client.aclose()

    return total_upserted
