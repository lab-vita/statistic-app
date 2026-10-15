"""
Импорт всех моделей — нужен Alembic для autogenerate.
"""
from app.models.appointment import Appointment       # noqa
from app.models.call import Call                     # noqa
from app.models.staff import Staff                   # noqa
from app.models.revenue import Revenue               # noqa
from app.models.sale import Sale                     # noqa
from app.models.service import Service               # noqa
from app.models.payment_detail import PaymentDetail  # noqa
from app.models.plan import Plan                     # noqa
from app.models.app_user import AppUser, AccessRequest              # noqa
from app.models.app_setting import AppSetting                       # noqa
from app.models.report_template import ReportTemplate             # noqa
