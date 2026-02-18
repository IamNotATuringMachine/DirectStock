import logging
from collections.abc import AsyncGenerator
from time import perf_counter

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.observability.metrics import record_db_query

settings = get_settings()
logger = logging.getLogger(__name__)

engine = create_async_engine(settings.async_database_url, future=True, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

_QUERY_START_TIME_KEY = "_directstock_query_start_time"


@event.listens_for(engine.sync_engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):  # noqa: ANN001
    del cursor, statement, parameters, context, executemany
    conn.info[_QUERY_START_TIME_KEY] = perf_counter()


@event.listens_for(engine.sync_engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):  # noqa: ANN001
    del cursor, parameters, context, executemany
    start = conn.info.pop(_QUERY_START_TIME_KEY, None)
    if start is None:
        return

    duration_ms = (perf_counter() - start) * 1000.0
    record_db_query(
        statement,
        duration_ms=duration_ms,
        slow_query_threshold_ms=settings.slow_query_threshold_ms,
    )

    if duration_ms >= float(settings.slow_query_threshold_ms):
        normalized = " ".join(statement.strip().split())
        logger.warning(
            "Slow SQL query detected (%.2fms): %s",
            duration_ms,
            normalized[:500],
        )


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
