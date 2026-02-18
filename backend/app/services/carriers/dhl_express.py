from __future__ import annotations

import base64
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid4

import httpx

from app.config import Settings, get_settings
from app.services.carriers.base import CarrierAdapter, CarrierAdapterError, CarrierCreateLabelResult, CarrierTrackingEvent


class DhlExpressCarrierAdapter(CarrierAdapter):
    carrier_code = "dhl_express"

    _DELIVERED_EVENT_CODES = {"ok", "dl", "pod"}
    _IN_TRANSIT_EVENT_CODES = {"pu", "af", "pl", "df", "ar", "wc", "cr", "rr"}
    _EXCEPTION_EVENT_CODES = {"ca", "rt", "ud", "oh", "no"}

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
        payload = self._build_create_payload(
            shipment_number=shipment_number,
            recipient_name=recipient_name,
            shipping_address=shipping_address,
            metadata=metadata,
        )
        response_payload = self._request("POST", "shipments", payload=payload)
        tracking_number = self._extract_tracking_number(response_payload)
        label_document = self._extract_label_document(response_payload)
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
            type_code = str(raw_event.get("typeCode") or "tracking_event").strip()
            if not type_code:
                type_code = "tracking_event"
            events.append(
                CarrierTrackingEvent(
                    event_type=type_code.lower(),
                    status=self._status_from_event_code(type_code),
                    description=str(raw_event.get("description") or type_code),
                    event_at_iso=self._event_iso(raw_event),
                )
            )
        return events

    def cancel(self, *, tracking_number: str, metadata: dict[str, Any] | None = None) -> bool:
        runtime_data = self._runtime_data(metadata)
        dispatch_confirmation_number = runtime_data.get("dispatch_confirmation_number")
        if not dispatch_confirmation_number:
            return True

        self._request(
            "DELETE",
            f"pickups/{dispatch_confirmation_number}",
            params={
                "requestorName": self._required_setting(
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
        self._validate_credentials()
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
                    headers=self._headers(),
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                detail = self._error_detail(exc.response)
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

    def _build_create_payload(
        self,
        *,
        shipment_number: str,
        recipient_name: str | None,
        shipping_address: str | None,
        metadata: dict[str, Any] | None,
    ) -> dict[str, Any]:
        dhl_data = self._dhl_data(metadata)
        receiver_name = recipient_name or str(dhl_data.get("recipient_contact_name") or "").strip()
        if not receiver_name:
            raise CarrierAdapterError("DHL Express recipient contact name is required")

        receiver_address_line1 = str(dhl_data.get("recipient_address_line1") or "").strip()
        receiver_postal_code = str(dhl_data.get("recipient_postal_code") or "").strip()
        receiver_city = str(dhl_data.get("recipient_city") or "").strip()
        receiver_country_code = str(dhl_data.get("recipient_country_code") or "").strip().upper()
        receiver_phone = str(dhl_data.get("recipient_phone") or "").strip()
        receiver_company = str(dhl_data.get("recipient_company_name") or "").strip()
        receiver_email = str(dhl_data.get("recipient_email") or "").strip()
        if not receiver_company or not receiver_phone:
            raise CarrierAdapterError("DHL Express recipient company and phone are required")
        if not receiver_address_line1 or not receiver_postal_code or not receiver_city or len(receiver_country_code) != 2:
            raise CarrierAdapterError("DHL Express recipient address is incomplete")

        package_weight = self._to_decimal(dhl_data.get("package_weight_kg"), field="package_weight_kg")
        package_payload: dict[str, Any] = {
            "weight": float(package_weight),
            "description": self._trim(shipping_address or f"DirectStock shipment {shipment_number}", 70),
        }

        dimensions = self._package_dimensions(dhl_data)
        if dimensions is not None:
            package_payload["dimensions"] = dimensions

        shipper_address = {
            "postalCode": self._required_setting("dhl_express_shipper_postal_code", self._settings.dhl_express_shipper_postal_code),
            "cityName": self._required_setting("dhl_express_shipper_city", self._settings.dhl_express_shipper_city),
            "countryCode": self._required_setting(
                "dhl_express_shipper_country_code", self._settings.dhl_express_shipper_country_code
            ).upper(),
            "addressLine1": self._required_setting(
                "dhl_express_shipper_address_line1", self._settings.dhl_express_shipper_address_line1
            ),
        }
        if self._settings.dhl_express_shipper_address_line2.strip():
            shipper_address["addressLine2"] = self._settings.dhl_express_shipper_address_line2.strip()
        if self._settings.dhl_express_shipper_state_code.strip():
            shipper_address["provinceCode"] = self._settings.dhl_express_shipper_state_code.strip()

        receiver_address = {
            "postalCode": receiver_postal_code,
            "cityName": receiver_city,
            "countryCode": receiver_country_code,
            "addressLine1": receiver_address_line1,
        }
        receiver_line2 = str(dhl_data.get("recipient_address_line2") or "").strip()
        receiver_state_code = str(dhl_data.get("recipient_state_code") or "").strip()
        if receiver_line2:
            receiver_address["addressLine2"] = receiver_line2
        if receiver_state_code:
            receiver_address["provinceCode"] = receiver_state_code

        planned_dt = datetime.now(UTC) + timedelta(minutes=30)
        planned_shipping = planned_dt.strftime("%Y-%m-%dT%H:%M:%S GMT+00:00")

        payload: dict[str, Any] = {
            "plannedShippingDateAndTime": planned_shipping,
            "pickup": {"isRequested": False},
            "productCode": self._settings.dhl_express_product_code,
            "accounts": [{"typeCode": "shipper", "number": self._settings.dhl_express_account_number}],
            "outputImageProperties": {
                "printerDPI": 300,
                "encodingFormat": "pdf",
                "imageOptions": [
                    {
                        "typeCode": "label",
                        "templateName": self._settings.dhl_express_label_template_name,
                    }
                ],
            },
            "customerDetails": {
                "shipperDetails": {
                    "postalAddress": shipper_address,
                    "contactInformation": {
                        "companyName": self._required_setting(
                            "dhl_express_shipper_company_name",
                            self._settings.dhl_express_shipper_company_name,
                        ),
                        "fullName": self._required_setting(
                            "dhl_express_shipper_contact_name",
                            self._settings.dhl_express_shipper_contact_name,
                        ),
                        "phone": self._required_setting(
                            "dhl_express_shipper_phone",
                            self._settings.dhl_express_shipper_phone,
                        ),
                    },
                },
                "receiverDetails": {
                    "postalAddress": receiver_address,
                    "contactInformation": {
                        "companyName": receiver_company,
                        "fullName": receiver_name,
                        "phone": receiver_phone,
                    },
                },
            },
            "content": {
                "packages": [package_payload],
                "isCustomsDeclarable": False,
                "description": self._trim(shipping_address or "DirectStock shipment", 70),
                "incoterm": self._settings.dhl_express_incoterm,
                "unitOfMeasurement": "metric",
            },
        }

        shipper_email = self._settings.dhl_express_shipper_email.strip()
        if shipper_email:
            payload["customerDetails"]["shipperDetails"]["contactInformation"]["email"] = shipper_email
        if receiver_email:
            payload["customerDetails"]["receiverDetails"]["contactInformation"]["email"] = receiver_email
        return payload

    def _headers(self) -> dict[str, str]:
        return {
            "x-version": self._settings.dhl_express_api_version,
            "Message-Reference": str(uuid4()),
            "Message-Reference-Date": datetime.now(UTC).strftime("%a, %d %b %Y %H:%M:%S GMT"),
            "Accept": "application/json",
        }

    def _validate_credentials(self) -> None:
        missing: list[str] = []
        if not self._settings.dhl_express_api_username.strip():
            missing.append("DHL_EXPRESS_API_USERNAME")
        if not self._settings.dhl_express_api_password.strip():
            missing.append("DHL_EXPRESS_API_PASSWORD")
        if not self._settings.dhl_express_account_number.strip():
            missing.append("DHL_EXPRESS_ACCOUNT_NUMBER")
        if missing:
            joined = ", ".join(missing)
            raise CarrierAdapterError(f"DHL Express integration not configured: missing {joined}")

    def _dhl_data(self, metadata: dict[str, Any] | None) -> dict[str, Any]:
        if not isinstance(metadata, dict):
            raise CarrierAdapterError("DHL Express metadata missing for shipment")
        raw = metadata.get("dhl_express")
        if not isinstance(raw, dict):
            raise CarrierAdapterError("DHL Express payload missing in shipment metadata")
        return raw

    def _runtime_data(self, metadata: dict[str, Any] | None) -> dict[str, Any]:
        if not isinstance(metadata, dict):
            return {}
        carrier_runtime = metadata.get("carrier_runtime")
        if not isinstance(carrier_runtime, dict):
            return {}
        runtime = carrier_runtime.get(self.carrier_code)
        if not isinstance(runtime, dict):
            return {}
        return runtime

    def _package_dimensions(self, dhl_data: dict[str, Any]) -> dict[str, float] | None:
        length = dhl_data.get("package_length_cm")
        width = dhl_data.get("package_width_cm")
        height = dhl_data.get("package_height_cm")
        if length is None and width is None and height is None:
            return None
        if length is None or width is None or height is None:
            raise CarrierAdapterError("DHL Express package dimensions must include length, width and height")
        return {
            "length": float(self._to_decimal(length, field="package_length_cm")),
            "width": float(self._to_decimal(width, field="package_width_cm")),
            "height": float(self._to_decimal(height, field="package_height_cm")),
        }

    def _extract_tracking_number(self, response_payload: dict[str, Any]) -> str:
        tracking_number = str(response_payload.get("shipmentTrackingNumber") or "").strip()
        if tracking_number:
            return tracking_number
        packages = response_payload.get("packages")
        if isinstance(packages, list):
            for package in packages:
                if not isinstance(package, dict):
                    continue
                package_tracking = str(package.get("trackingNumber") or "").strip()
                if package_tracking:
                    return package_tracking
        raise CarrierAdapterError("DHL Express API did not provide a tracking number")

    def _extract_label_document(self, response_payload: dict[str, Any]) -> dict[str, Any]:
        documents = response_payload.get("documents")
        if not isinstance(documents, list) or not documents:
            raise CarrierAdapterError("DHL Express API did not return shipment documents")

        preferred: dict[str, Any] | None = None
        fallback: dict[str, Any] | None = None
        for document in documents:
            if not isinstance(document, dict):
                continue
            content = document.get("content")
            if not isinstance(content, str) or not content.strip():
                continue
            if fallback is None:
                fallback = document
            if str(document.get("typeCode") or "").lower() == "label":
                preferred = document
                break

        selected = preferred or fallback
        if selected is None:
            raise CarrierAdapterError("DHL Express API did not include a label document")

        try:
            decoded = base64.b64decode(str(selected["content"]), validate=True)
        except Exception as exc:
            raise CarrierAdapterError("DHL Express label document is not valid base64 content") from exc

        image_format = str(selected.get("imageFormat") or "PDF").lower()
        mime_type = "application/pdf" if image_format == "pdf" else f"application/{image_format}"
        return {"content": decoded, "mime_type": mime_type}

    def _error_detail(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            text = response.text.strip()
            return text[:300] if text else "unknown error"
        if isinstance(payload, dict):
            detail = payload.get("detail") or payload.get("message") or payload.get("title")
            if detail:
                return str(detail)
        return "unknown error"

    def _status_from_event_code(self, type_code: str) -> str:
        normalized = type_code.strip().lower()
        if normalized in self._DELIVERED_EVENT_CODES:
            return "delivered"
        if normalized in self._IN_TRANSIT_EVENT_CODES:
            return "in_transit"
        if normalized in self._EXCEPTION_EVENT_CODES:
            return "exception"
        return normalized or "in_transit"

    def _event_iso(self, raw_event: dict[str, Any]) -> str:
        raw_date = str(raw_event.get("date") or "").strip()
        raw_time = str(raw_event.get("time") or "").strip()
        raw_offset = str(raw_event.get("GMTOffset") or "").strip()
        if raw_date and raw_time and raw_offset:
            return f"{raw_date}T{raw_time}{raw_offset}"
        if raw_date and raw_time:
            return f"{raw_date}T{raw_time}+00:00"
        return datetime.now(UTC).isoformat()

    def _required_setting(self, env_name: str, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise CarrierAdapterError(f"DHL Express integration not configured: missing {env_name}")
        return normalized

    def _to_decimal(self, value: Any, *, field: str) -> Decimal:
        try:
            result = Decimal(str(value))
        except Exception as exc:
            raise CarrierAdapterError(f"DHL Express value '{field}' is invalid") from exc
        if result <= 0:
            raise CarrierAdapterError(f"DHL Express value '{field}' must be greater than zero")
        return result

    def _trim(self, value: str, max_length: int) -> str:
        compact = " ".join(value.split())
        if not compact:
            compact = "DirectStock shipment"
        return compact[:max_length]
