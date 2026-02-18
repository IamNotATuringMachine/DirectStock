"""Goods issue domain helpers."""

from decimal import Decimal


def serial_tracked_quantity_is_integer(quantity: Decimal) -> bool:
    return quantity > 0 and quantity == quantity.to_integral_value()
