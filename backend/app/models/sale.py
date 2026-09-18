from sqlalchemy import Date, Integer, String, Float, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date
from app.db.database import Base


class Sale(Base):
    """
    Продажи по номенклатуре (услуги) из МедОДС.
    Один день × одна услуга = одна строка.

    Источник: POST /api/internal/analytics/reports/sales
    Транспорт: ActionCable WebSocket (ReportChannel / UserChannel)
    Ключ уникальности: (sale_date, service_title)
    """
    __tablename__ = "sales"
    __table_args__ = (
        UniqueConstraint("sale_date", "service_title", name="uq_sale_date_service"),
    )

    id:            Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    sale_date:     Mapped[date] = mapped_column(Date, index=True, nullable=False)

    # Название услуги / номенклатуры
    service_title: Mapped[str]  = mapped_column(String(500), nullable=False)
    unit:          Mapped[str | None] = mapped_column(String(50), nullable=True)  # "шт."

    # Количество оказанных услуг
    amount:        Mapped[int]   = mapped_column(Integer, default=0)

    # Сумма без скидок
    total_sum:     Mapped[float] = mapped_column(Float, default=0.0)

    # Сумма с учётом скидок (finalSum)
    final_sum:     Mapped[float] = mapped_column(Float, default=0.0)

    # Доля от общей выручки (%)
    sum_percent:   Mapped[float] = mapped_column(Float, default=0.0)

    collected_at:  Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
