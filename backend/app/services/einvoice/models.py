from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class EinvoiceValidationError(Exception):
    message: str
    report: dict


REQUIRED_BILLING_FIELDS = [
    "legal_name",
    "seller_street",
    "seller_postal_code",
    "seller_city",
    "seller_country_code",
]
