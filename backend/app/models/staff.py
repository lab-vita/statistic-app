from sqlalchemy import String, Integer, DateTime, Boolean, Date, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date as date_type
from app.db.database import Base


class Staff(Base):
    __tablename__ = "staff"

    # ID берём напрямую из МедОДС
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Логин
    username: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ФИО
    surname:     Mapped[str | None] = mapped_column(String(200), nullable=True)
    name:        Mapped[str | None] = mapped_column(String(200), nullable=True)
    second_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    full_name:   Mapped[str | None] = mapped_column(String(500), nullable=True)
    short_name:  Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Контакты
    phone: Mapped[str | None] = mapped_column(String(50),  nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Статус в МедОДС: 1=Активен, 2=Уволен
    user_status_id: Mapped[int]          = mapped_column(Integer)
    status_title:   Mapped[str | None]   = mapped_column(String(50), nullable=True)
    deleted_at:     Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Характеристики
    sex:      Mapped[bool | None] = mapped_column(Boolean, nullable=True)  # True=мужской
    birthdate: Mapped[date_type | None] = mapped_column(Date, nullable=True)

    # Ведёт ли приём — ключевой признак врача
    has_appointment: Mapped[bool] = mapped_column(Boolean, default=False)
    availability_for_online_recording: Mapped[str | None] = mapped_column(String(100), nullable=True)
    appointment_duration_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Специальности (массив хранится как JSON)
    specialty_ids:    Mapped[list | None] = mapped_column(JSON, nullable=True)  # [38, 56]
    specialties_titles: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Клиники (массив хранится как JSON)
    clinic_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [1, 2]

    # Роль — вычисляется при синхронизации
    # doctor      — has_appointment=True, нет роли администратора
    # admin       — has_appointment=False, специальность "Администратор"
    # callcenter  — администратор из LABVITA_OPERATORS
    # management  — Директор, Заместитель директора
    # tech        — Разработчик, Бухгалтер
    role: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)

    # Прочее
    referral_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Служебное
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
