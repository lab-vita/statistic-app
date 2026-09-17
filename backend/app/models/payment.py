from sqlalchemy import Date, Float, Integer, String, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date
from app.db.database import Base


class Payment(Base):
    """
    Выручка по типам оплат за конкретный день из МедОДС.
    Один день × один тип оплаты = одна строка.

    Источник: POST /reports/create_payment_types
    Ключ уникальности: (payment_date, payment_type)
    """
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("payment_date", "payment_type", name="uq_payment_date_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Дата за которую собраны данные
    payment_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)

    # Тип оплаты: "Наличными", "Картой", "Кредитом", ...
    payment_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # Количество транзакций
    amount: Mapped[int] = mapped_column(Integer, default=0)

    # Сумма в рублях
    total_sum: Mapped[float] = mapped_column(Float, default=0.0)

    # Доля в % от дневной выручки (как считает МедОДС)
    percent: Mapped[float] = mapped_column(Float, default=0.0)

    collected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
