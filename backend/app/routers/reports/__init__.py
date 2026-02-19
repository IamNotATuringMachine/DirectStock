from .common import router

# Route registration side effects
from . import stock_reports  # noqa: F401
from . import movement_reports  # noqa: F401
from . import analytics_reports  # noqa: F401
from . import analytics_kpis_report  # noqa: F401
from . import forecast_reports  # noqa: F401
