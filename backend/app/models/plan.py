from datetime import date

from sqlalchemy import JSON, Date, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Plan(Base):
    """
    Плановые показатели по дням — их читают карточки, виджеты главной и утренняя сводка.

    Первичный ключ: (date, metric).
    Метрики-суммы: calls_incoming, calls_outgoing, appt_count, revenue.
    Строки пересобираются из настроек месяца (PlanMonth) при каждом сохранении плана.
    """
    __tablename__ = "plans"

    date:   Mapped[date]  = mapped_column(Date,         primary_key=True)
    metric: Mapped[str]   = mapped_column(String,       primary_key=True)
    value:  Mapped[float] = mapped_column(Float,        nullable=False)


class PlanMonth(Base):
    """
    Настройки плана на месяц — то, что вводит человек на странице «Планы».

    config = {
      "workdays": [0, 1, 2, 3, 4, 5],                 # рабочие дни недели (0 = пн)
      "days_off": ["2026-11-04"],                     # праздники и выходные внутри месяца
      "targets":  {"calls_incoming": 1800, "conversion_pct": 35, ...},
      "overrides": {"calls_incoming": {"2026-11-07": 40}},  # дни, поправленные вручную
    }
    """
    __tablename__ = "plan_months"

    year:   Mapped[int]  = mapped_column(Integer, primary_key=True)
    month:  Mapped[int]  = mapped_column(Integer, primary_key=True)
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
