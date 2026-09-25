"""
Настройки приложения — всё через .env.

Константы домена (статусы МедОДС, коды Bitrix и т.д.) — в app/core/constants.py.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # БД
    DATABASE_URL: str

    # Внешние API
    BITRIX_WEBHOOK_URL: str
    MEDODS_URL: str = "https://labvita.medods.ru"
    MEDODS_USERNAME: str = ""
    MEDODS_PASSWORD: str = ""
    MEDODS_CLINIC_ID: int = 1

    # CORS — через запятую, например: http://localhost:3000,https://stats.labvita.ru
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # Номера клиники
    LABVITA_NUMBERS: list[str] = [
        "+79049919191",
        "+79511620204",
        "+79234766196",
        "+79511660509",
        "+79234657174",
    ]

    # Операторы колл-центра: portal_user_id → полное имя
    LABVITA_OPERATORS: dict[str, str] = {
        "168": "Белобородова Евгения",
        "520": "Пирожкова Виктория",
        "544": "Жданова Елена",
        "696": "Часовских Наталья",
    }

    # Сопоставление portal_user_id → номер телефона оператора
    OPERATOR_NUMBERS: dict[str, list[str]] = {
        "168": ["+79234657174"],
        "520": ["+79234766196"],
        "544": ["+79511620204"],
        "696": ["+79511660509"],
    }

    # Роль оператора (callcenter / profosmotr)
    OPERATOR_ROLES: dict[str, str] = {
        "168": "callcenter",
        "520": "callcenter",
        "544": "profosmotr",  # Жданова — профосмотры
        "696": "callcenter",
    }

    # Фамилии администраторов-коллцентра в МедОДС
    # (совпадают с ключами ADMIN_GROUPS, group="callcenter")
    CALLCENTER_SURNAMES: set[str] = {
        "Пирожкова", "Часовских", "Белобородова", "Жданова",
    }

    # Группы администраторов МедОДС
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

    model_config = {"env_file": ".env"}


settings = Settings()
