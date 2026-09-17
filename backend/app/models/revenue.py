from sqlalchemy import String, Integer, Float, Date, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date
from app.db.database import Base

class Revenue(Base):
    __tablename__ = "revenue"
    __table_args__ = (
        UniqueConstraint("revenue_date", "payment_type", name="uq_revenue_date_type"),
    )
    id:           Mapped[int]   = mapped_column(Integer, primary_key=True, autoincrement=True)
    revenue_date: Mapped[date]  = mapped_column(Date, index=True, nullable=False)
    payment_type: Mapped[str]   = mapped_column(String(100), nullable=False)
    amount:       Mapped[int]   = mapped_column(Integer, default=0)
    total:        Mapped[float] = mapped_column(Float, default=0.0)
    percent:      Mapped[float] = mapped_column(Float, default=0.0)
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
