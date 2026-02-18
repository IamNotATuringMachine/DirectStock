from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from fastapi import FastAPI
from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

_DB_QUERY_DURATION_SECONDS = Histogram(
    "directstock_db_query_duration_seconds",
    "Database query duration in seconds",
    labelnames=("operation",),
)
_DB_SLOW_QUERY_TOTAL = Counter(
    "directstock_db_slow_query_total",
    "Total number of slow SQL queries",
    labelnames=("operation",),
)

_METRICS_MOUNTED = False
_INSTRUMENTATOR: Instrumentator | None = None


def _sql_operation(statement: str) -> str:
    normalized = " ".join(statement.strip().split())
    if not normalized:
        return "unknown"
    return normalized.split(" ", 1)[0].upper()


def record_db_query(statement: str, *, duration_ms: float, slow_query_threshold_ms: int) -> None:
    operation = _sql_operation(statement)
    duration_seconds = max(duration_ms, 0.0) / 1000.0
    _DB_QUERY_DURATION_SECONDS.labels(operation=operation).observe(duration_seconds)

    if duration_ms >= float(slow_query_threshold_ms):
        _DB_SLOW_QUERY_TOTAL.labels(operation=operation).inc()


def mount_metrics_endpoint(app: FastAPI, *, path: str = "/api/metrics") -> None:
    global _INSTRUMENTATOR, _METRICS_MOUNTED
    if _METRICS_MOUNTED:
        return

    _INSTRUMENTATOR = Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        excluded_handlers=[r"^/api/metrics$"],
    )
    _INSTRUMENTATOR.instrument(app)
    _INSTRUMENTATOR.expose(app, endpoint=path, include_in_schema=False)

    _METRICS_MOUNTED = True


def request_id_from_scope(scope: Mapping[str, Any]) -> str | None:
    for raw_key, raw_value in scope.get("headers", []):
        if raw_key.decode("latin1").lower() == "x-request-id":
            return raw_value.decode("latin1")
    return None
