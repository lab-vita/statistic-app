from sqlalchemy import Date, Integer, String, DateTime, BigInteger
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date
from app.db.database import Base


class PaymentDetail(Base):
    """
    Детальный платёж из МедОДС (/reports/payments_report).
    Одна строка = один платёж (payment.id из МедОДС).

    Источник: POST /reports/payments_report
    Ключ уникальности: medods_id (payment.id)
    """
    __tablename__ = "payment_details"

    id:          Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    medods_id:   Mapped[int]  = mapped_column(BigInteger, unique=True, nullable=False, index=True)

    # Дата платежа
    payment_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)

    # kind: 6 = обычный платёж, 7 = страховой/кредит
    kind: Mapped[int] = mapped_column(Integer, default=6)

    # Суммы по методам оплаты (в рублях)
    by_cash:     Mapped[int] = mapped_column(Integer, default=0)
    by_cashless: Mapped[int] = mapped_column(Integer, default=0)
    by_card:     Mapped[int] = mapped_column(Integer, default=0)
    by_balance:  Mapped[int] = mapped_column(Integer, default=0)
    by_credit:   Mapped[int] = mapped_column(Integer, default=0)
    total_income: Mapped[int] = mapped_column(Integer, default=0)
    total_paid:   Mapped[int] = mapped_column(Integer, default=0)

    # Плательщик (физлицо)
    client_id:      Mapped[int | None]  = mapped_column(Integer, nullable=True)
    client_name:    Mapped[str | None]  = mapped_column(String(200), nullable=True)
    client_surname: Mapped[str | None]  = mapped_column(String(200), nullable=True)

    # Плательщик (юрлицо / страховая)
    company_id:    Mapped[int | None]  = mapped_column(Integer, nullable=True)
    company_title: Mapped[str | None]  = mapped_column(String(300), nullable=True)

    # Заказ
    order_id:   Mapped[int | None]  = mapped_column(Integer, nullable=True)
    order_sum:  Mapped[int | None]  = mapped_column(Integer, nullable=True)
    order_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Врач
    doctor_id:      Mapped[str | None] = mapped_column(String(100), nullable=True)
    doctor_name:    Mapped[str | None] = mapped_column(String(200), nullable=True)
    doctor_surname: Mapped[str | None] = mapped_column(String(200), nullable=True)

    collected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
