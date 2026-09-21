from sqlalchemy import Date, Integer, String, Float, DateTime, Boolean, UniqueConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date
from app.db.database import Base


class Sale(Base):
    """
    Продажи по номенклатуре из МедОДС.
    Один день/период × одна услуга = одна строка.

    service_id — FK на services.id (опциональный).
    exclude_from_analytics — наследуется из services или проставляется True
    если service_id не найден.
    """
    __tablename__ = "sales"
    __table_args__ = (
        UniqueConstraint("sale_date", "service_title", name="uq_sale_date_service"),
    )

    id:                     Mapped[int]        = mapped_column(Integer, primary_key=True, autoincrement=True)
    sale_date:              Mapped[date]       = mapped_column(Date, index=True, nullable=False)
    service_title:          Mapped[str]        = mapped_column(String(500), nullable=False)
    service_id:             Mapped[int | None] = mapped_column(Integer, ForeignKey("services.id", ondelete="SET NULL"), nullable=True, index=True)
    unit:                   Mapped[str | None] = mapped_column(String(50), nullable=True)
    amount:                 Mapped[int]        = mapped_column(Integer, default=0)
    total_sum:              Mapped[float]      = mapped_column(Float, default=0.0)
    final_sum:              Mapped[float]      = mapped_column(Float, default=0.0)
    sum_percent:            Mapped[float]      = mapped_column(Float, default=0.0)
    exclude_from_analytics: Mapped[bool]       = mapped_column(Boolean, default=False)
    collected_at:           Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow)
