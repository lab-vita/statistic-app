from sqlalchemy import Date, String, Float
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date
from app.db.database import Base


class Plan(Base):
    """
    Плановые показатели по дням.

    Первичный ключ: (date, metric).
    Доступные метрики: calls_incoming, calls_outgoing, appt_count.
    """
    __tablename__ = "plans"

    date:   Mapped[date]  = mapped_column(Date,         primary_key=True)
    metric: Mapped[str]   = mapped_column(String,       primary_key=True)
    value:  Mapped[float] = mapped_column(Float,        nullable=False)
