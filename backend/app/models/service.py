from sqlalchemy import Integer, String, Float, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.database import Base


class ServiceCategory(Base):
    """
    Категория услуг из МедОДС (/categories/entry_types).
    Двухуровневая структура: корень (id=373 Лабвита) → категории.
    """
    __tablename__ = "service_categories"

    id:          Mapped[int]       = mapped_column(Integer, primary_key=True)  # medods id
    title:       Mapped[str]       = mapped_column(String(300), nullable=False)
    parent_id:   Mapped[int | None] = mapped_column(Integer, nullable=True)   # 0 или id родителя
    deleted:     Mapped[bool]      = mapped_column(Boolean, default=False)
    synced_at:   Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)


class Service(Base):
    """
    Справочник услуг из МедОДС.
    id — medods id услуги (первичный ключ, не autoincrement).
    Решает проблему дублей в sales: матчинг по id вместо названия.
    """
    __tablename__ = "services"

    id:           Mapped[int]        = mapped_column(Integer, primary_key=True)  # medods id
    title:        Mapped[str]        = mapped_column(String(500), nullable=False)
    category_id:  Mapped[int | None] = mapped_column(Integer, nullable=True)     # FK → service_categories.id
    price:        Mapped[float]      = mapped_column(Float, default=0.0)
    cost_price:   Mapped[float]      = mapped_column(Float, default=0.0)
    kind:         Mapped[int]        = mapped_column(Integer, default=4)          # 4=услуга, 5=товар
    unit:         Mapped[str | None] = mapped_column(String(50), nullable=True)   # шт.
    deleted:      Mapped[bool]       = mapped_column(Boolean, default=False)
    synced_at:    Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow)
