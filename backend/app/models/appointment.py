from sqlalchemy import String, Integer, DateTime, Boolean, Text, Date
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date
from app.db.database import Base
from app.core.constants import (
    MEDODS_VISIT_STATUSES,
    MEDODS_NOSHOW_STATUSES,
    MEDODS_CANCEL_STATUSES,
    MEDODS_PENDING_STATUSES,
)


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Идентификатор в МедОДС
    medods_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)

    # Данные приёма
    appointment_date:  Mapped[date]          = mapped_column(Date, index=True)
    appointment_time:  Mapped[str]           = mapped_column(String(20))
    status:            Mapped[int]           = mapped_column(Integer, index=True)
    note:              Mapped[str | None]    = mapped_column(Text, nullable=True)
    new_patient:       Mapped[bool]          = mapped_column(Boolean, default=False)
    created_at_medods: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Клиент
    client_id:      Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    client_name:    Mapped[str | None] = mapped_column(String, nullable=True)
    client_surname: Mapped[str | None] = mapped_column(String, nullable=True)
    client_phone:   Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    # Врач — без FK на staff (врач может быть уволен, но запись сохраняется)
    doctor_id:   Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    doctor_name: Mapped[str | None] = mapped_column(String, nullable=True)

    # Администратор (кто записал)
    administrator_id:      Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    administrator_name:    Mapped[str | None] = mapped_column(String, nullable=True)
    administrator_surname: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    # Источник привлечения
    attraction_source_id:    Mapped[int | None] = mapped_column(Integer, nullable=True)
    attraction_source_title: Mapped[str | None] = mapped_column(String, nullable=True)

    # Услуги — JSON строка
    services_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Предвычисленное поле: заполняется коллектором при сохранении
    is_callcenter: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Служебные
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    @property
    def is_visit(self) -> bool:
        return self.status in MEDODS_VISIT_STATUSES

    @property
    def is_noshow(self) -> bool:
        return self.status in MEDODS_NOSHOW_STATUSES

    @property
    def is_cancelled(self) -> bool:
        return self.status in MEDODS_CANCEL_STATUSES

    @property
    def is_pending(self) -> bool:
        return self.status in MEDODS_PENDING_STATUSES
