"""Shared report aggregation helpers."""

from decimal import Decimal, ROUND_HALF_UP


def quantize(value: Decimal, digits: str = "0.01") -> Decimal:
    return value.quantize(Decimal(digits), rounding=ROUND_HALF_UP)
