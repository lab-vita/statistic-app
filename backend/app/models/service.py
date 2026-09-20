from sqlalchemy import Integer, String, Float, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.database import Base


# Категории исключённые из аналитики (вместе со всеми подкатегориями)
# Профосмотры, ДМС, товары, доставка
EXCLUDED_CATEGORY_IDS = {
    483,  # Жданова Комиссии
    487,  #   └ Предварительный и периодический медосмотр
    484,  #   └ Справка водительская (А,В)
    486,  #   └ Справка водительская (С,D)
    364,  # Предрейсовые, послерейсовые осмотры
    402,  # ДМС Альфа-Страхование
    406,  #   └ Гинекология (ДМС)
    405,  #   └ Дневной стационар (ДМС)
    404,  #   └ Массаж (ДМС)
    407,  #   └ Оториноларингология (ДМС)
    408,  #   └ УЗИ (ДМС)
    471,  # Служба доставки клиентов
    371,  # Сопутствующие товары
}


class ServiceCategory(Base):
    """
    Категория услуг из МедОДС.
    Двухуровневая структура: корень (id=373) → категории.
    exclude_from_analytics=True — не учитывать в отчётах по продажам.
    """
    __tablename__ = "service_categories"

    id:                   Mapped[int]  = mapped_column(Integer, primary_key=True)
    title:                Mapped[str]  = mapped_column(String(300), nullable=False)
    parent_id:            Mapped[int | None] = mapped_column(Integer, nullable=True)
    deleted:              Mapped[bool] = mapped_column(Boolean, default=False)
    exclude_from_analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    synced_at:            Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Service(Base):
    """
    Справочник услуг из МедОДС.
    id — medods id услуги (первичный ключ).
    exclude_from_analytics наследуется из категории при матчинге.
    """
    __tablename__ = "services"

    id:                   Mapped[int]        = mapped_column(Integer, primary_key=True)
    title:                Mapped[str]        = mapped_column(String(500), nullable=False)
    category_id:          Mapped[int | None] = mapped_column(Integer, nullable=True)
    price:                Mapped[float]      = mapped_column(Float, default=0.0)
    cost_price:           Mapped[float]      = mapped_column(Float, default=0.0)
    kind:                 Mapped[int]        = mapped_column(Integer, default=4)
    unit:                 Mapped[str | None] = mapped_column(String(50), nullable=True)
    deleted:              Mapped[bool]       = mapped_column(Boolean, default=False)
    exclude_from_analytics: Mapped[bool]     = mapped_column(Boolean, default=False)
    synced_at:            Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow)
