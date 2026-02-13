from dataclasses import dataclass
from typing import Protocol


@dataclass(slots=True)
class CarrierCreateLabelResult:
    tracking_number: str
    label_bytes: bytes
    mime_type: str


@dataclass(slots=True)
class CarrierTrackingEvent:
    event_type: str
    status: str
    description: str
    event_at_iso: str


class CarrierAdapter(Protocol):
    carrier_code: str

    def create_label(self, *, shipment_number: str, recipient_name: str | None, shipping_address: str | None) -> CarrierCreateLabelResult:
        ...

    def track(self, *, tracking_number: str) -> list[CarrierTrackingEvent]:
        ...

    def cancel(self, *, tracking_number: str) -> bool:
        ...
