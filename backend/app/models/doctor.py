from sqlalchemy import String, Integer, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.database import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # medods user id

    surname:     Mapped[str | None] = mapped_column(String, nullable=True)
    name:        Mapped[str | None] = mapped_column(String, nullable=True)
    second_name: Mapped[str | None] = mapped_column(String, nullable=True)
    specialty:   Mapped[str | None] = mapped_column(String, nullable=True)  # specialties_titles
    deleted:     Mapped[bool]       = mapped_column(Boolean, default=False)
    synced_at:   Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow)

    @property
    def full_name(self) -> str:
        parts = [self.surname, self.name, self.second_name]
        return " ".join(p for p in parts if p)

    @property
    def short_name(self) -> str:
        parts = [self.surname]
        if self.name:
            parts.append(self.name[0] + ".")
        if self.second_name:
            parts.append(self.second_name[0] + ".")
        return " ".join(parts)
