from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class AppRole(Base):
    """
    Роль — набор прав с названием. Создаётся и редактируется в «Настройки → Роли».
    Роль owner встроенная (system): у неё всегда все права, менять её нельзя.
    """
    __tablename__ = "app_roles"

    id:          Mapped[str]  = mapped_column(String, primary_key=True)
    name:        Mapped[str]  = mapped_column(String, nullable=False)
    description: Mapped[str]  = mapped_column(String, nullable=False, default="", server_default="")
    permissions: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    system:      Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    position:    Mapped[int]  = mapped_column(Integer, nullable=False, default=100, server_default="100")
    created_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AppUser(Base):
    """
    Кому разрешено открывать приложение (белый список).

    Если сотрудника портала Битрикс24 нет в этой таблице (или is_active = false),
    приложение для него не открывается.

    role — id роли из app_roles; действуют права роли.
    """
    __tablename__ = "app_users"

    bitrix_user_id: Mapped[str] = mapped_column(String, primary_key=True)
    name:           Mapped[str] = mapped_column(String, nullable=False, default="")
    role:           Mapped[str] = mapped_column(String, nullable=False, default="viewer")
    is_active:      Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Права до перехода на роли. Больше не используются, остаются для истории.
    permissions:    Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    # Из профиля Битрикс24: фото и должность (обновляются при входе и в настройках)
    avatar_url:     Mapped[str | None] = mapped_column(String, nullable=True)
    position:       Mapped[str | None] = mapped_column(String, nullable=True)
    profile_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Какую версию обучающего тура сотрудник уже прошёл (или закрыл). NULL — ещё не видел:
    # при первом входе тур запускается сам.
    tour_version:   Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Раскладка виджетов главной (список {id, type, x, y, w, h, config}). NULL — ещё не
    # настраивал: показывается раскладка по умолчанию со всеми виджетами.
    home_layout:    Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at:     Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_login_at:  Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class AccessRequest(Base):
    """
    Кто открывал приложение, но не был в списке доступа.
    Появляется только после проверки личности самим порталом Битрикс24.
    Владелец видит запрос в админ-панели и разрешает или отклоняет.
    """
    __tablename__ = "access_requests"

    bitrix_user_id:     Mapped[str] = mapped_column(String, primary_key=True)
    name:               Mapped[str] = mapped_column(String, nullable=False, default="")
    avatar_url:         Mapped[str | None] = mapped_column(String, nullable=True)
    position:           Mapped[str | None] = mapped_column(String, nullable=True)
    first_requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_requested_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
