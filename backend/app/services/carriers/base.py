from dataclasses import dataclass
from typing import Any
from typing import Protocol


class CarrierAdapterError(RuntimeError):
    pass


@dataclass(slots=True)
class CarrierCreateLabelResult:
    tracking_number: str
    label_bytes: bytes
    mime_type: str
    metadata: dict[str, Any] | None = None


@dataclass(slots=True)
class CarrierTrackingEvent:
    event_type: str
    status: str
    description: str
    event_at_iso: str


class CarrierAdapter(Protocol):
    carrier_code: str

    def create_label(
        self,
        *,
        shipment_number: str,
        recipient_name: str | None,
        shipping_address: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> CarrierCreateLabelResult:
        ...

    def track(self, *, tracking_number: str) -> list[CarrierTrackingEvent]:
        ...

    def cancel(self, *, tracking_number: str, metadata: dict[str, Any] | None = None) -> bool:
        ...
