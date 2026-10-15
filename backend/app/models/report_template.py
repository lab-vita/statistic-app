from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class ReportTemplate(Base):
    """
    Сохранённый отчёт конструктора — общий для всех, у кого есть раздел «Отчёты».

    config — настройки конструктора как их хранит интерфейс: источник, показатели,
    группировки, фильтры и период (пресет вроде «прошлый месяц» или точные даты).
    Таблица создаётся миграцией 009 и при старте сервера, если её ещё нет.
    """
    __tablename__ = "report_templates"

    id:              Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    name:            Mapped[str]  = mapped_column(String(200), nullable=False)
    config:          Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_by_id:   Mapped[str | None] = mapped_column(String, nullable=True)
    created_by_name: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at:      Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at:      Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
