"""
Коллектор детальных платежей из МедОДС (/reports/payments_report).

Логика:
- Запрашивает все платежи за период (с пагинацией по 256)
- Upsert по medods_id: если платёж уже есть — обновляет суммы
- kind=7 (страховые) тоже сохраняются, но total_income=0 у них — это норма
"""
import asyncio
import logging
from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.medods import login
from app.models.payment_detail import PaymentDetail

logger = logging.getLogger(__name__)


async def fetch_payments_report(
    client,
    date_from: date,
    date_to: date,
    limit: int = 256,
) -> list[dict]:
    """Загружает все платежи за период с пагинацией."""
    from app.core.config import settings

    def _fmt(d: date) -> str:
        MONTHS = ["", "января", "февраля", "марта", "апреля", "мая", "июня",
                  "июля", "августа", "сентября", "октября", "ноября", "декабря"]
        return f"{d.day} {MONTHS[d.month]} {d.year}"

    period_str = f"{_fmt(date_from)} - {_fmt(date_to)}"
    all_records = []
    offset = 0

    while True:
        payload = {
            "offset": offset,
            "limit": limit,
            "report": {"period": period_str},
            "sorting": [],
            "clinicIds": [settings.MEDODS_CLINIC_ID],
            "paymentType": "",
            "paymentKinds": [],
            "payerType": "",
            "paymentSourceId": "",
            "doctorId": "",
            "chequePrinted": "",
            "ordersWithDifferentPeriod": False,
        }
        resp = await client.post(
            f"{settings.MEDODS_URL}/reports/payments_report",
            json=payload,
        )
        if resp.status_code != 200:
            raise Exception(f"payments_report: {resp.status_code} — {resp.text[:200]}")

        data = resp.json()
        batch = data.get("data", [])
        if not batch:
            break
        all_records.extend(batch)
        total = data.get("count", 0)
        offset += limit
        if offset >= total:
            break
        await asyncio.sleep(0.2)

    return all_records


def _parse_payment(item: dict) -> dict | None:
    """Разбирает одну запись из data[] в плоский словарь."""
    p = item.get("payment", {})
    if not p or not p.get("id"):
        return None

    payer_client  = p.get("payerClient") or {}
    payer_company = p.get("payerCompany") or {}
    order         = p.get("destinationOrder") or {}
    doctor        = p.get("doctorInfo") or {}

    # order_date может быть строкой "YYYY-MM-DD"
    order_date_raw = order.get("date")
    try:
        from datetime import date as _date
        order_date = _date.fromisoformat(order_date_raw) if order_date_raw else None
    except (ValueError, TypeError):
        order_date = None

    payment_date_raw = p.get("date")
    try:
        from datetime import date as _date
        payment_date = _date.fromisoformat(payment_date_raw) if payment_date_raw else None
    except (ValueError, TypeError):
        payment_date = None

    if not payment_date:
        return None

    doctor_id = str(doctor.get("id", "") or "").strip()
    # "Несколько исполнителей" — оставляем как есть
    doctor_name    = (doctor.get("name")    or "").strip() or None
    doctor_surname = (doctor.get("surname") or "").strip() or None

    return {
        "medods_id":      int(p["id"]),
        "payment_date":   payment_date,
        "kind":           int(p.get("kind", 6)),
        "by_cash":        int(p.get("byCash", 0) or 0),
        "by_cashless":    int(p.get("byCashless", 0) or 0),
        "by_card":        int(p.get("byCard", 0) or 0),
        "by_balance":     int(p.get("byBalance", 0) or 0),
        "by_credit":      int(p.get("byCredit", 0) or 0),
        "total_income":   int(p.get("totalIncome", 0) or 0),
        "total_paid":     int(p.get("totalPaid", 0) or 0),
        # client
        "client_id":      payer_client.get("id"),
        "client_name":    (payer_client.get("name") or "").strip() or None,
        "client_surname": (payer_client.get("surname") or "").strip() or None,
        # company
        "company_id":     payer_company.get("id"),
        "company_title":  (payer_company.get("title") or "").strip() or None,
        # order
        "order_id":       order.get("id"),
        "order_sum":      int(order.get("finalSum", 0) or 0),
        "order_date":     order_date,
        # doctor
        "doctor_id":      doctor_id or None,
        "doctor_name":    doctor_name,
        "doctor_surname": doctor_surname,
    }


async def collect_payment_details(
    db: AsyncSession,
    date_from: date,
    date_to: date,
) -> dict:
    """Загружает и сохраняет детальные платежи за период.

    Возвращает: {"fetched": N, "created": N, "updated": N}
    """
    client = await login()
    stats = {"fetched": 0, "created": 0, "updated": 0}

    try:
        raw = await fetch_payments_report(client, date_from, date_to)
        stats["fetched"] = len(raw)
        logger.info(f"[payment_details] Загрузили {len(raw)} платежей за {date_from}–{date_to}")

        for item in raw:
            parsed = _parse_payment(item)
            if not parsed:
                continue

            existing = await db.scalar(
                select(PaymentDetail).where(PaymentDetail.medods_id == parsed["medods_id"])
            )

            if existing:
                for k, v in parsed.items():
                    if k != "medods_id":
                        setattr(existing, k, v)
                stats["updated"] += 1
            else:
                db.add(PaymentDetail(**parsed))
                stats["created"] += 1

        await db.commit()
        logger.info(f"[payment_details] Создано: {stats['created']}, Обновлено: {stats['updated']}")

    finally:
        await client.aclose()

    return stats
