from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class AppUser(Base):
    """
    Кому разрешено открывать приложение (белый список).

    Если сотрудника портала Битрикс24 нет в этой таблице (или is_active = false),
    приложение для него не открывается.

    role — шаблон прав (owner / admin / viewer); действуют сохранённые permissions.
    """
    __tablename__ = "app_users"

    bitrix_user_id: Mapped[str] = mapped_column(String, primary_key=True)
    name:           Mapped[str] = mapped_column(String, nullable=False, default="")
    role:           Mapped[str] = mapped_column(String, nullable=False, default="viewer")
    is_active:      Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Список прав (см. app/core/permissions.py). У роли owner игнорируется — права всегда полные.
    permissions:    Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
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
    first_requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_requested_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
