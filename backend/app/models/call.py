from sqlalchemy import String, Integer, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.database import Base

class Call(Base):
    __tablename__ = "calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bitrix_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    call_type: Mapped[str] = mapped_column(String)
    call_failed_code: Mapped[str] = mapped_column(String)
    call_start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    call_duration: Mapped[int] = mapped_column(Integer, default=0)
    portal_number: Mapped[str] = mapped_column(String)
    portal_user_id: Mapped[str] = mapped_column(String, index=True)
    phone_number: Mapped[str] = mapped_column(String)
    crm_entity_type: Mapped[str | None] = mapped_column(String, nullable=True)
    crm_entity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    call_record_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_incoming: Mapped[bool] = mapped_column(Boolean, default=False)
    is_outgoing: Mapped[bool] = mapped_column(Boolean, default=False)
    is_missed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)