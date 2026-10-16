from datetime import date, datetime

from sqlalchemy import JSON, BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class SyncRun(Base):
    """
    Сеанс обмена: один запуск сборщика (звонки за день, записи, платежи…),
    рассылка сводки или другое действие, во время которого сервер ходил
    в МедОДС или Битрикс24. Запросы сеанса — в sync_requests.
    """
    __tablename__ = "sync_runs"

    id:          Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job:         Mapped[str] = mapped_column(String, nullable=False, index=True)    # calls, appointments…
    title:       Mapped[str] = mapped_column(String, nullable=False, default="")
    source:      Mapped[str] = mapped_column(String, nullable=False, default="")    # medods / bitrix
    trigger:     Mapped[str] = mapped_column(String, nullable=False, default="")    # schedule / manual / digest / resync
    user_id:     Mapped[str | None] = mapped_column(String, nullable=True)          # кто запустил вручную
    user_name:   Mapped[str | None] = mapped_column(String, nullable=True)
    period_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_to:   Mapped[date | None] = mapped_column(Date, nullable=True)
    status:      Mapped[str] = mapped_column(String, nullable=False, default="running", index=True)  # running / ok / warning / error
    summary:     Mapped[str] = mapped_column(Text, nullable=False, default="")
    result:      Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    error:       Mapped[str | None] = mapped_column(Text, nullable=True)
    requests:    Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed:      Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records:     Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bytes:       Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    events:      Mapped[list] = mapped_column(JSON, nullable=False, default=list)   # сообщения сборщика по ходу
    started_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                  server_default=func.now(), index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SyncRequest(Base):
    """
    Один HTTP-запрос к МедОДС или Битрикс24: что спросили, что пришло в ответ
    (полностью, до MAX_BODY символов), сколько записей и их понятное описание.
    Секреты (пароль, адрес вебхука, токены) в журнал не попадают.
    """
    __tablename__ = "sync_requests"

    id:             Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    run_id:         Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sync_runs.id", ondelete="CASCADE"), nullable=True, index=True)
    at:             Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False,
                                                     server_default=func.now(), index=True)
    source:         Mapped[str] = mapped_column(String, nullable=False, index=True)
    method:         Mapped[str] = mapped_column(String, nullable=False, default="")   # GET / POST / WS
    endpoint:       Mapped[str] = mapped_column(String, nullable=False, default="")   # метод API или путь
    url:            Mapped[str] = mapped_column(Text, nullable=False, default="")     # без секретов
    title:          Mapped[str] = mapped_column(Text, nullable=False, default="")     # что запрашивали
    params:         Mapped[dict | list | str | None] = mapped_column(JSON, nullable=True)
    status_code:    Mapped[int | None] = mapped_column(Integer, nullable=True)
    ok:             Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    duration_ms:    Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    response_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content_type:   Mapped[str] = mapped_column(String, nullable=False, default="")
    records:        Mapped[int | None] = mapped_column(Integer, nullable=True)
    summary:        Mapped[str] = mapped_column(Text, nullable=False, default="")     # что пришло, словами
    fields:         Mapped[list | None] = mapped_column(JSON, nullable=True)          # поля одной записи
    body:           Mapped[str | None] = mapped_column(Text, nullable=True)
    body_truncated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error:          Mapped[str | None] = mapped_column(Text, nullable=True)
