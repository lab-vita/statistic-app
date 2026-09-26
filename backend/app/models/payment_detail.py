from sqlalchemy import BigInteger, Integer, String, Date, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date, datetime
from app.db.database import Base


class PaymentDetail(Base):
    __tablename__ = "payment_details"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Идентификатор в МедОДС
    medods_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)

    # Дата и вид платежа
    payment_date: Mapped[date]    = mapped_column(Date, index=True)
    kind:         Mapped[int]     = mapped_column(Integer)  # 6=обычный, 7=страховой, 2=возврат

    # Суммы по способам оплаты
    by_cash:      Mapped[int] = mapped_column(Integer, default=0)
    by_cashless:  Mapped[int] = mapped_column(Integer, default=0)
    by_card:      Mapped[int] = mapped_column(Integer, default=0)
    by_balance:   Mapped[int] = mapped_column(Integer, default=0)
    by_credit:    Mapped[int] = mapped_column(Integer, default=0)
    total_income: Mapped[int] = mapped_column(Integer, default=0)
    total_paid:   Mapped[int] = mapped_column(Integer, default=0)

    # Плательщик — клиент
    client_id:      Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    client_name:    Mapped[str | None] = mapped_column(String(200), nullable=True)
    client_surname: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Плательщик — компания (ДМС)
    company_id:    Mapped[int | None] = mapped_column(Integer, nullable=True)
    company_title: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Заказ
    order_id:   Mapped[int | None]  = mapped_column(Integer, nullable=True)
    order_sum:  Mapped[int | None]  = mapped_column(Integer, nullable=True)
    order_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Врач
    doctor_id:      Mapped[str | None] = mapped_column(String(100), nullable=True)
    doctor_name:    Mapped[str | None] = mapped_column(String(200), nullable=True)
    doctor_surname: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Служебное
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    @property
    def is_insurance(self) -> bool:
        return self.kind == 7

    @property
    def is_refund(self) -> bool:
        return self.kind == 2

    @property
    def is_regular(self) -> bool:
        return self.kind == 6
