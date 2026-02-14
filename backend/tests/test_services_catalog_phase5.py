from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.phase5_utils import auth_headers, suffix


@pytest.mark.asyncio
async def test_services_catalog_crud(client: AsyncClient, admin_token: str):
    headers = auth_headers(admin_token)
    service_number = f"P5SRV-{suffix()}"

    created = await client.post(
        "/api/services",
        headers=headers,
        json={
            "service_number": service_number,
            "name": "Phase5 Service",
            "description": "service test",
            "net_price": "25.00",
            "vat_rate": "19",
            "currency": "EUR",
            "status": "active",
        },
    )
    assert created.status_code == 201
    service_id = created.json()["id"]

    listed = await client.get("/api/services", headers=headers, params={"status": "active"})
    assert listed.status_code == 200
    assert any(item["id"] == service_id for item in listed.json()["items"])

    updated = await client.put(
        f"/api/services/{service_id}",
        headers=headers,
        json={"status": "blocked", "vat_rate": "7"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "blocked"
    assert updated.json()["gross_price"] == "26.75"

    deleted = await client.delete(f"/api/services/{service_id}", headers=headers)
    assert deleted.status_code == 200


@pytest.mark.asyncio
async def test_services_vat_validation(client: AsyncClient, admin_token: str):
    invalid = await client.post(
        "/api/services",
        headers=auth_headers(admin_token),
        json={
            "service_number": f"P5INV-{suffix()}",
            "name": "Invalid VAT Service",
            "description": "invalid",
            "net_price": "10.00",
            "vat_rate": "5",
            "currency": "EUR",
            "status": "active",
        },
    )
    assert invalid.status_code == 422

