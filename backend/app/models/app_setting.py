from datetime import datetime

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class AppSetting(Base):
    """
    Настройки приложения, которые меняются из интерфейса (а не через .env).

    Одна строка — один раздел настроек: key = "digest" → настройки утренней сводки.
    Таблица создаётся и миграцией 008, и при старте сервера (create_settings_table),
    поэтому сводка работает, даже если миграцию на сервере ещё не применили.
    """
    __tablename__ = "app_settings"

    key:        Mapped[str]  = mapped_column(String, primary_key=True)
    value:      Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
