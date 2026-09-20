from sqlalchemy import Integer, String, Float, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.database import Base


# Категории которые не учитываются в аналитике продаж:
#   483 - Жданова Комиссии (профосмотры)
#   487 - Предварительный и периодический медосмотр (подкат. 483)
#   484 - Справка водительская (А,В) (подкат. 483)
#   486 - Справка водительская (С,D) (подкат. 483)
#   364 - Предрейсовые, послерейсовые осмотры
#   402 - ДМС Альфа-Страхование
#   406 - Гинекология (подкат. 402)
#   405 - Дневной стационар (подкат. 402)
#   404 - Массаж (подкат. 402)
#   407 - Оториноларингология (подкат. 402)
#   408 - УЗИ (подкат. 402)
#   471 - Служба доставки клиентов
#   371 - Сопутствующие товары
EXCLUDED_CATEGORY_IDS: set[int] = {
    483, 487, 484, 486,  # Жданова Комиссии + подкатегории
    364,                 # Предрейсовые/послерейсовые осмотры
    402, 406, 405, 404, 407, 408,  # ДМС + подкатегории
    471,                 # Служба доставки
    371,                 # Сопутствующие товары
}


class ServiceCategory(Base):
    """
    Категория услуг из МедОДС (/categories/entry_types).
    Двухуровневая структура: корень (id=373 Лабвита) → категории.
    """
    __tablename__ = "service_categories"

    id:        Mapped[int]        = mapped_column(Integer, primary_key=True)
    title:     Mapped[str]        = mapped_column(String(300), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deleted:   Mapped[bool]       = mapped_column(Boolean, default=False)
    exclude_from_analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    synced_at: Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow)


class Service(Base):
    """
    Справочник услуг из МедОДС.
    id — medods id услуги (первичный ключ, не autoincrement).
    """
    __tablename__ = "services"

    id:           Mapped[int]        = mapped_column(Integer, primary_key=True)
    title:        Mapped[str]        = mapped_column(String(500), nullable=False)
    category_id:  Mapped[int | None] = mapped_column(Integer, nullable=True)
    price:        Mapped[float]      = mapped_column(Float, default=0.0)
    cost_price:   Mapped[float]      = mapped_column(Float, default=0.0)
    kind:         Mapped[int]        = mapped_column(Integer, default=4)
    unit:         Mapped[str | None] = mapped_column(String(50), nullable=True)
    deleted:      Mapped[bool]       = mapped_column(Boolean, default=False)
    exclude_from_analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    synced_at:    Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow)
