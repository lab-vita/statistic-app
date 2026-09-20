from sqlalchemy import Date, Integer, String, Float, DateTime, UniqueConstraint, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date
from app.db.database import Base


class Sale(Base):
    """
    Продажи по номенклатуре из МедОДС.
    Один день × одна услуга = одна строка.

    service_id — FK на services.id (заполняется через матчинг по названию).
    exclude_from_analytics — True если услуга из исключённой категории
    или не найдена в справочнике.
    """
    __tablename__ = "sales"
    __table_args__ = (
        UniqueConstraint("sale_date", "service_title", name="uq_sale_date_service"),
    )

    id:            Mapped[int]        = mapped_column(Integer, primary_key=True, autoincrement=True)
    sale_date:     Mapped[date]       = mapped_column(Date, index=True, nullable=False)
    service_title: Mapped[str]        = mapped_column(String(500), nullable=False)
    unit:          Mapped[str | None] = mapped_column(String(50), nullable=True)
    amount:        Mapped[int]        = mapped_column(Integer, default=0)
    total_sum:     Mapped[float]      = mapped_column(Float, default=0.0)
    final_sum:     Mapped[float]      = mapped_column(Float, default=0.0)
    sum_percent:   Mapped[float]      = mapped_column(Float, default=0.0)

    # Связь со справочником (заполняется через POST /api/services/match-sales)
    service_id:              Mapped[int | None]  = mapped_column(Integer, nullable=True, index=True)
    exclude_from_analytics:  Mapped[bool]        = mapped_column(Boolean, default=False)

    collected_at:  Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow)
