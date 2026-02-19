from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings, get_settings
from app.services.carriers.base import (
    CarrierAdapter,
    CarrierAdapterError,
    CarrierCreateLabelResult,
    CarrierTrackingEvent,
)
from app.services.carriers.dhl_express_utils import (
    build_create_payload,
    error_detail,
    event_iso,
    extract_label_document,
    extract_tracking_number,
    headers,
    required_setting,
    runtime_data,
    status_from_event_code,
    validate_credentials,
)


class DhlExpressCarrierAdapter(CarrierAdapter):
    carrier_code = "dhl_express"

    def __init__(self, settings: Settings | None = None):
        self._settings = settings or get_settings()

    def create_label(
        self,
        *,
        shipment_number: str,
        recipient_name: str | None,
        shipping_address: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> CarrierCreateLabelResult:
        payload = build_create_payload(
            settings=self._settings,
            shipment_number=shipment_number,
            recipient_name=recipient_name,
            shipping_address=shipping_address,
            metadata=metadata,
        )
        response_payload = self._request("POST", "shipments", payload=payload)
        tracking_number = extract_tracking_number(response_payload)
        label_document = extract_label_document(response_payload)
        runtime_metadata = {
            "dispatch_confirmation_number": response_payload.get("dispatchConfirmationNumber"),
            "tracking_url": response_payload.get("trackingUrl"),
            "shipment_tracking_number": tracking_number,
        }
        return CarrierCreateLabelResult(
            tracking_number=tracking_number,
            label_bytes=label_document["content"],
            mime_type=label_document["mime_type"],
            metadata=runtime_metadata,
        )

    def track(self, *, tracking_number: str) -> list[CarrierTrackingEvent]:
        response_payload = self._request(
            "GET",
            f"shipments/{tracking_number}/tracking",
            params={
                "trackingView": "shipment-details",
                "levelOfDetail": "shipment",
            },
        )
        shipments = response_payload.get("shipments")
        if not isinstance(shipments, list) or not shipments:
            return []

        shipment = shipments[0] if isinstance(shipments[0], dict) else {}
        raw_events = shipment.get("events")
        if not isinstance(raw_events, list):
            return []

        events: list[CarrierTrackingEvent] = []
        for raw_event in raw_events:
            if not isinstance(raw_event, dict):
                continue

            type_code = str(raw_event.get("typeCode") or "tracking_event").strip() or "tracking_event"
            events.append(
                CarrierTrackingEvent(
                    event_type=type_code.lower(),
                    status=status_from_event_code(type_code),
                    description=str(raw_event.get("description") or type_code),
                    event_at_iso=event_iso(raw_event),
                )
            )
        return events

    def cancel(self, *, tracking_number: str, metadata: dict[str, Any] | None = None) -> bool:
        _ = tracking_number
        runtime = runtime_data(metadata, self.carrier_code)
        dispatch_confirmation_number = runtime.get("dispatch_confirmation_number")
        if not dispatch_confirmation_number:
            return True

        self._request(
            "DELETE",
            f"pickups/{dispatch_confirmation_number}",
            params={
                "requestorName": required_setting(
                    "dhl_express_shipper_contact_name", self._settings.dhl_express_shipper_contact_name
                ),
                "reason": "shipment_cancelled",
            },
        )
        return True

    def _request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        # @agent-invariant: all external carrier calls pass through this function for deterministic error mapping.
        validate_credentials(self._settings)
        base_url = self._settings.dhl_express_api_base_url.rstrip("/") + "/"
        auth = (self._settings.dhl_express_api_username, self._settings.dhl_express_api_password)
        timeout = max(1, self._settings.dhl_express_timeout_seconds)

        with httpx.Client(base_url=base_url, auth=auth, timeout=timeout) as client:
            try:
                response = client.request(
                    method,
                    path.lstrip("/"),
                    json=payload,
                    params=params,
                    headers=headers(self._settings),
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                detail = error_detail(exc.response)
                raise CarrierAdapterError(f"DHL Express API error ({exc.response.status_code}): {detail}") from exc
            except httpx.HTTPError as exc:
                raise CarrierAdapterError(f"DHL Express API unavailable: {exc}") from exc

        try:
            body = response.json()
        except ValueError as exc:
            raise CarrierAdapterError("DHL Express API returned invalid JSON") from exc

        if not isinstance(body, dict):
            raise CarrierAdapterError("DHL Express API returned unexpected response payload")
        return body
