from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    BITRIX_WEBHOOK_URL: str

    LABVITA_NUMBERS: list[str] = [
        "+79049919191",
        "+79511620204",
        "+79234766196",
        "+79511660509",
        "+79234657174",
    ]

    LABVITA_OPERATORS: dict[str, str] = {
        "168": "Белобородова Евгения",
        "520": "Пирожкова Виктория",
        "544": "Жданова Елена",
        "696": "Часовских Наталья",
    }

    OPERATOR_NUMBERS: dict[str, list[str]] = {
        "168": ["+79234657174"],
        "520": ["+79234766196"],
        "544": ["+79511620204"],
        "696": ["+79511660509"],
    }

    # МедОДС
    MEDODS_URL: str = "https://labvita.medods.ru"
    MEDODS_USERNAME: str = ""
    MEDODS_PASSWORD: str = ""
    MEDODS_CLINIC_ID: int = 1

    # Группы администраторов МедОДС
    # callcenter  — делают записи по звонкам
    # admin       — встречают пациентов вживую
    # other       — все остальные роли
    ADMIN_GROUPS: dict[str, dict] = {
        "Пирожкова":    {"group": "callcenter", "label": "Колл-центр"},
        "Часовских":    {"group": "callcenter", "label": "Колл-центр"},
        "Белобородова": {"group": "callcenter", "label": "Колл-центр"},
        "Колотова":     {"group": "admin",       "label": "Администратор"},
        "Шипелова":     {"group": "admin",       "label": "Администратор"},
        "Осокина":      {"group": "admin",       "label": "Администратор"},
        "Книга":        {"group": "admin",       "label": "Администратор"},
        "Жданова":      {"group": "other",       "label": "Профосмотры"},
        "Волкова":      {"group": "other",       "label": "PR"},
        "Admin":        {"group": "other",       "label": "Директор"},
        "Варанкина":    {"group": "other",       "label": "Врач"},
        "Поспелов":     {"group": "other",       "label": "Врач"},
        "Чеснокова":    {"group": "other",       "label": "Врач"},
        "Малеева":      {"group": "other",       "label": "Врач"},
        "Иванова":      {"group": "other",       "label": "Прочие"},
    }

    CALLCENTER_SURNAMES: set[str] = {
        "Пирожкова", "Часовских", "Белобородова", "Жданова"
    }

    # Оператор Жданова — профосмотры, не показываем красные метрики
    OPERATOR_ROLES: dict[str, str] = {
        "168": "callcenter",
        "520": "callcenter",
        "544": "profosmotr",  # Жданова
        "696": "callcenter",
    }

    MEDODS_VISIT_STATUSES: set[int] = {6, 7, 8}
    MEDODS_NOSHOW_STATUSES: set[int] = {5}
    MEDODS_CANCEL_STATUSES: set[int] = {4}
    MEDODS_PENDING_STATUSES: set[int] = {2, 9}
    MEDODS_STATUS_NAMES: dict[int, str] = {
        2: "Не подтверждён",
        3: "Счёт выставлен",
        4: "Отменён пациентом",
        5: "Неявка",
        6: "Пришёл",
        7: "Приём завершён",
        8: "Счёт оплачен",
        9: "Одобрен",
    }

    class Config:
        env_file = ".env"

settings = Settings()
