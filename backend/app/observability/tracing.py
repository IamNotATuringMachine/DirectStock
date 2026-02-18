from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from sqlalchemy.engine import Engine

from app.config import Settings
from app.observability.metrics import request_id_from_scope

logger = logging.getLogger(__name__)

_SQLA_INSTRUMENTED = False
_FASTAPI_INSTRUMENTED = False
_TRACER_PROVIDER: TracerProvider | None = None


def _extract_response_request_id(message: dict[str, Any]) -> str | None:
    for raw_key, raw_value in message.get("headers", []):
        if raw_key.decode("latin1").lower() == "x-request-id":
            return raw_value.decode("latin1")
    return None


def setup_tracing(*, app: FastAPI, sync_engine: Engine, settings: Settings) -> None:
    global _FASTAPI_INSTRUMENTED, _SQLA_INSTRUMENTED, _TRACER_PROVIDER

    if not settings.observability_enabled:
        return

    if _TRACER_PROVIDER is None:
        resource = Resource.create({"service.name": settings.otel_service_name})
        provider = TracerProvider(resource=resource)

        if settings.otel_exporter_otlp_endpoint:
            exporter = OTLPSpanExporter(
                endpoint=settings.otel_exporter_otlp_endpoint,
                insecure=settings.otel_exporter_otlp_insecure,
            )
            provider.add_span_processor(BatchSpanProcessor(exporter))
            logger.info("OTel tracing enabled with OTLP endpoint %s", settings.otel_exporter_otlp_endpoint)
        else:
            logger.info("OTel tracing initialized without exporter endpoint")

        trace.set_tracer_provider(provider)
        _TRACER_PROVIDER = provider

    if not _FASTAPI_INSTRUMENTED:

        def server_request_hook(span, scope):
            if span is None or not span.is_recording():
                return
            request_id = request_id_from_scope(scope)
            if request_id:
                span.set_attribute("http.request_id", request_id)

        def client_response_hook(span, scope, message):
            if span is None or not span.is_recording():
                return
            request_id = _extract_response_request_id(message)
            if request_id:
                span.set_attribute("http.response.request_id", request_id)

        FastAPIInstrumentor.instrument_app(
            app,
            tracer_provider=_TRACER_PROVIDER,
            server_request_hook=server_request_hook,
            client_response_hook=client_response_hook,
        )
        _FASTAPI_INSTRUMENTED = True

    if not _SQLA_INSTRUMENTED:
        SQLAlchemyInstrumentor().instrument(engine=sync_engine, tracer_provider=_TRACER_PROVIDER)
        _SQLA_INSTRUMENTED = True


def shutdown_tracing() -> None:
    # Keep tracer provider alive for process lifetime.
    return
