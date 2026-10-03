from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class AppUser(Base):
    """
    Кому разрешено открывать приложение (белый список).

    Если сотрудника портала Битрикс24 нет в этой таблице (или is_active = false),
    приложение для него не открывается.

    role — задел под ролевую модель: owner / admin / viewer.
    Сейчас роль только записывается; права по ролям появятся позже.
    """
    __tablename__ = "app_users"

    bitrix_user_id: Mapped[str] = mapped_column(String, primary_key=True)
    name:           Mapped[str] = mapped_column(String, nullable=False, default="")
    role:           Mapped[str] = mapped_column(String, nullable=False, default="viewer")
    is_active:      Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at:     Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_login_at:  Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
