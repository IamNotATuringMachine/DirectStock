from datetime import UTC, datetime
from hashlib import sha1

from app.services.carriers.base import CarrierAdapter, CarrierCreateLabelResult, CarrierTrackingEvent


def _tracking_from(seed: str) -> str:
    digest = sha1(seed.encode("utf-8")).hexdigest().upper()
    return digest[:18]


class SandboxCarrierAdapter(CarrierAdapter):
    carrier_code = "sandbox"

    def __init__(self, carrier_code: str):
        self.carrier_code = carrier_code

    def create_label(self, *, shipment_number: str, recipient_name: str | None, shipping_address: str | None) -> CarrierCreateLabelResult:
        tracking_number = f"{self.carrier_code.upper()}-{_tracking_from(shipment_number)}"
        now = datetime.now(UTC).isoformat()
        content = (
            "%PDF-1.4\n"
            f"% DirectStock Sandbox Label\n% carrier={self.carrier_code}\n"
            f"% shipment={shipment_number}\n% tracking={tracking_number}\n"
            f"% recipient={recipient_name or '-'}\n% address={shipping_address or '-'}\n% created_at={now}\n"
        ).encode("utf-8")
        return CarrierCreateLabelResult(tracking_number=tracking_number, label_bytes=content, mime_type="application/pdf")

    def track(self, *, tracking_number: str) -> list[CarrierTrackingEvent]:
        now = datetime.now(UTC).isoformat()
        return [
            CarrierTrackingEvent(
                event_type="tracking_snapshot",
                status="in_transit",
                description="Sandbox tracking snapshot",
                event_at_iso=now,
            )
        ]

    def cancel(self, *, tracking_number: str) -> bool:
        return True
