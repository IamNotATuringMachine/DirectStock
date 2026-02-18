import hmac
import json
from hashlib import sha256
from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_shipping_create_label_tracking_cancel(client: AsyncClient, admin_token: str):
    shipment = await client.post(
        "/api/shipments",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "carrier": "dhl",
            "recipient_name": "Test Recipient",
            "shipping_address": "Musterstr. 1, 12345 Teststadt",
        },
    )
    assert shipment.status_code == 201
    shipment_id = shipment.json()["id"]

    label = await client.post(
        f"/api/shipments/{shipment_id}/create-label",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert label.status_code == 200
    label_payload = label.json()
    assert label_payload["tracking_number"] is not None
    assert label_payload["label_document_id"] is not None

    tracking = await client.get(
        f"/api/shipments/{shipment_id}/tracking",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert tracking.status_code == 200
    assert len(tracking.json()["events"]) >= 1

    download = await client.get(
        f"/api/documents/{label_payload['label_document_id']}/download",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert download.status_code == 200

    cancel = await client.post(
        f"/api/shipments/{shipment_id}/cancel",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert cancel.status_code == 200


@pytest.mark.asyncio
async def test_shipping_webhook_signature_and_status_update(client: AsyncClient, admin_token: str):
    shipment = await client.post(
        "/api/shipments",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "carrier": "dpd",
            "recipient_name": "Webhook Recipient",
            "shipping_address": "Webhook-Str. 2",
        },
    )
    assert shipment.status_code == 201
    shipment_id = shipment.json()["id"]

    label = await client.post(
        f"/api/shipments/{shipment_id}/create-label",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert label.status_code == 200
    tracking_number = label.json()["tracking_number"]

    payload = {
        "tracking_number": tracking_number,
        "event_type": "delivered",
        "status": "delivered",
        "description": f"delivered-{uuid4().hex[:6]}",
    }
    raw = json.dumps(payload).encode("utf-8")
    signature = hmac.new("dpd-webhook-secret".encode("utf-8"), raw, sha256).hexdigest()

    webhook = await client.post(
        "/api/carriers/dpd/webhook",
        headers={"X-Carrier-Signature": signature, "Content-Type": "application/json"},
        content=raw,
    )
    assert webhook.status_code == 200

    updated = await client.get(
        f"/api/shipments/{shipment_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "delivered"


@pytest.mark.asyncio
async def test_shipping_dhl_express_requires_payload(client: AsyncClient, admin_token: str):
    missing_payload = await client.post(
        "/api/shipments",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"carrier": "dhl_express"},
    )
    assert missing_payload.status_code == 422

    create_with_payload = await client.post(
        "/api/shipments",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "carrier": "dhl_express",
            "dhl_express": {
                "recipient_company_name": "Muster GmbH",
                "recipient_contact_name": "Max Mustermann",
                "recipient_phone": "+4926112345",
                "recipient_address_line1": "Musterstrasse 1",
                "recipient_postal_code": "56068",
                "recipient_city": "Koblenz",
                "recipient_country_code": "DE",
                "package_weight_kg": "1.0",
            },
        },
    )
    assert create_with_payload.status_code == 201
    payload = create_with_payload.json()
    assert payload["carrier"] == "dhl_express"
    assert payload["metadata_json"]["dhl_express"]["recipient_company_name"] == "Muster GmbH"
