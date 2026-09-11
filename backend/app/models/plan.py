from sqlalchemy import Column, Date, String, Float
from app.db.database import Base


class Plan(Base):
    __tablename__ = "plans"

    date   = Column(Date,   primary_key=True, nullable=False)
    metric = Column(String, primary_key=True, nullable=False)
    # metric: calls_incoming | calls_outgoing | appt_count
    value  = Column(Float,  nullable=False, default=0.0)
