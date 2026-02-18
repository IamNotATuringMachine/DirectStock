from __future__ import annotations

import base64
from typing import Any

from app.config import Settings
from app.services.carriers.dhl_express import DhlExpressCarrierAdapter


class _FakeResponse:
    def __init__(self, payload: dict[str, Any], status_code: int = 200):
        self._payload = payload
        self.status_code = status_code
        self.text = str(payload)

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return self._payload


class _FakeClient:
    def __init__(self, *, responses: list[_FakeResponse], calls: list[dict[str, Any]], **kwargs: Any):
        self._responses = responses
        self._calls = calls
        self._kwargs = kwargs

    def __enter__(self) -> "_FakeClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> _FakeResponse:
        self._calls.append(
            {
                "method": method,
                "path": path,
                "json": json,
                "params": params,
                "headers": headers,
                "client_kwargs": self._kwargs,
            }
        )
        return self._responses.pop(0)


def _settings() -> Settings:
    return Settings(
        environment="development",
        dhl_express_api_base_url="https://express.api.dhl.com/mydhlapi/test",
        dhl_express_api_username="api-user",
        dhl_express_api_password="api-pass",
        dhl_express_account_number="123456789",
        dhl_express_shipper_company_name="DirectStock GmbH",
        dhl_express_shipper_contact_name="Versand Team",
        dhl_express_shipper_phone="+4926112345",
        dhl_express_shipper_address_line1="Musterstrasse 1",
        dhl_express_shipper_postal_code="56068",
        dhl_express_shipper_city="Koblenz",
        dhl_express_shipper_country_code="DE",
    )


def test_dhl_express_create_label_builds_mydhl_request(monkeypatch):
    calls: list[dict[str, Any]] = []
    encoded_pdf = base64.b64encode(b"%PDF-test").decode("ascii")
    responses = [
        _FakeResponse(
            {
                "shipmentTrackingNumber": "00340434161094000001",
                "dispatchConfirmationNumber": "PRG200227000256",
                "documents": [
                    {
                        "typeCode": "label",
                        "imageFormat": "PDF",
                        "content": encoded_pdf,
                    }
                ],
            }
        )
    ]

    monkeypatch.setattr(
        "app.services.carriers.dhl_express.httpx.Client",
        lambda *args, **kwargs: _FakeClient(responses=responses, calls=calls, **kwargs),
    )

    adapter = DhlExpressCarrierAdapter(settings=_settings())
    result = adapter.create_label(
        shipment_number="SHP-20260218-0001",
        recipient_name="Max Mustermann",
        shipping_address="Musterstrasse 9, 10115 Berlin",
        metadata={
            "dhl_express": {
                "recipient_company_name": "Kunde GmbH",
                "recipient_contact_name": "Max Mustermann",
                "recipient_phone": "+493012345",
                "recipient_address_line1": "Musterstrasse 9",
                "recipient_postal_code": "10115",
                "recipient_city": "Berlin",
                "recipient_country_code": "DE",
                "package_weight_kg": "1.250",
            }
        },
    )

    assert result.tracking_number == "00340434161094000001"
    assert result.label_bytes == b"%PDF-test"
    assert result.mime_type == "application/pdf"
    assert result.metadata is not None
    assert result.metadata["dispatch_confirmation_number"] == "PRG200227000256"

    assert len(calls) == 1
    request = calls[0]
    assert request["method"] == "POST"
    assert request["path"] == "shipments"
    assert request["headers"]["x-version"] == "3.2.0"
    assert request["json"]["productCode"] == "P"
    assert request["json"]["accounts"][0]["number"] == "123456789"
    assert request["json"]["customerDetails"]["receiverDetails"]["postalAddress"]["cityName"] == "Berlin"


def test_dhl_express_tracking_maps_event_statuses(monkeypatch):
    calls: list[dict[str, Any]] = []
    responses = [
        _FakeResponse(
            {
                "shipments": [
                    {
                        "events": [
                            {"date": "2026-02-18", "time": "10:00:00", "GMTOffset": "+01:00", "typeCode": "PU", "description": "Picked up"},
                            {"date": "2026-02-18", "time": "14:20:00", "GMTOffset": "+01:00", "typeCode": "OK", "description": "Delivered"},
                        ]
                    }
                ]
            }
        )
    ]
    monkeypatch.setattr(
        "app.services.carriers.dhl_express.httpx.Client",
        lambda *args, **kwargs: _FakeClient(responses=responses, calls=calls, **kwargs),
    )

    adapter = DhlExpressCarrierAdapter(settings=_settings())
    events = adapter.track(tracking_number="00340434161094000001")

    assert len(events) == 2
    assert events[0].event_type == "pu"
    assert events[0].status == "in_transit"
    assert events[0].event_at_iso.endswith("+01:00")
    assert events[1].event_type == "ok"
    assert events[1].status == "delivered"

    assert len(calls) == 1
    assert calls[0]["method"] == "GET"
    assert calls[0]["path"] == "shipments/00340434161094000001/tracking"


def test_dhl_express_cancel_calls_pickup_cancel_when_dispatch_known(monkeypatch):
    calls: list[dict[str, Any]] = []
    responses = [_FakeResponse({})]
    monkeypatch.setattr(
        "app.services.carriers.dhl_express.httpx.Client",
        lambda *args, **kwargs: _FakeClient(responses=responses, calls=calls, **kwargs),
    )

    adapter = DhlExpressCarrierAdapter(settings=_settings())
    cancelled = adapter.cancel(
        tracking_number="00340434161094000001",
        metadata={"carrier_runtime": {"dhl_express": {"dispatch_confirmation_number": "PRG200227000256"}}},
    )

    assert cancelled is True
    assert len(calls) == 1
    assert calls[0]["method"] == "DELETE"
    assert calls[0]["path"] == "pickups/PRG200227000256"
    assert calls[0]["params"]["reason"] == "shipment_cancelled"
