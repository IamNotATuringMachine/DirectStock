"""Goods receipt domain helpers."""

from datetime import UTC, datetime
from secrets import token_hex


def now_utc() -> datetime:
    return datetime.now(UTC)


def generate_document_number(prefix: str) -> str:
    return f"{prefix}-{now_utc().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"
