from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_customer(client: AsyncClient, admin_token: str, marker: str) -> int:
    response = await client.post(
        "/api/customers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "customer_number": f"CUS-{marker}",
            "company_name": f"Customer {marker}",
            "is_active": True,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.mark.asyncio
async def test_customer_location_and_contact_crud(client: AsyncClient, admin_token: str):
    marker = _suffix()
    customer_id = await _create_customer(client, admin_token, marker)

    location = await client.post(
        f"/api/customers/{customer_id}/locations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "location_code": f"LOC-{marker}",
            "name": "Koblenz",
            "phone": "+49-261-123",
            "street": "Musterstrasse",
            "house_number": "1",
            "postal_code": "56068",
            "city": "Koblenz",
            "country_code": "DE",
            "is_primary": True,
            "is_active": True,
        },
    )
    assert location.status_code == 201
    location_id = location.json()["id"]

    listed_locations = await client.get(
        f"/api/customers/{customer_id}/locations",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listed_locations.status_code == 200
    assert any(item["id"] == location_id for item in listed_locations.json()["items"])

    contact = await client.post(
        f"/api/customers/{customer_id}/contacts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "customer_location_id": location_id,
            "job_title": "Kassenleitung",
            "salutation": "Frau",
            "first_name": "Erika",
            "last_name": "Mueller",
            "phone": "+49-261-456",
            "email": "erika.mueller@example.com",
            "is_primary": True,
            "is_active": True,
        },
    )
    assert contact.status_code == 201
    contact_id = contact.json()["id"]

    listed_contacts = await client.get(
        f"/api/customers/{customer_id}/contacts?location_id={location_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listed_contacts.status_code == 200
    assert len(listed_contacts.json()["items"]) == 1

    updated_contact = await client.put(
        f"/api/customers/{customer_id}/contacts/{contact_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"job_title": "Filialleitung"},
    )
    assert updated_contact.status_code == 200
    assert updated_contact.json()["job_title"] == "Filialleitung"

    delete_contact = await client.delete(
        f"/api/customers/{customer_id}/contacts/{contact_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert delete_contact.status_code == 204


@pytest.mark.asyncio
async def test_customer_location_scope_validation_for_wa_so_shipping(client: AsyncClient, admin_token: str):
    marker = _suffix()
    customer_a = await _create_customer(client, admin_token, f"{marker}A")
    customer_b = await _create_customer(client, admin_token, f"{marker}B")

    location = await client.post(
        f"/api/customers/{customer_a}/locations",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "location_code": f"LOC-{marker}",
            "name": "Standort A",
            "country_code": "DE",
            "is_active": True,
        },
    )
    assert location.status_code == 201
    location_id = location.json()["id"]

    goods_issue_auto_customer = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"customer_location_id": location_id},
    )
    assert goods_issue_auto_customer.status_code == 201
    assert goods_issue_auto_customer.json()["customer_id"] == customer_a
    assert goods_issue_auto_customer.json()["customer_location_id"] == location_id

    goods_issue_conflict = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"customer_id": customer_b, "customer_location_id": location_id},
    )
    assert goods_issue_conflict.status_code == 409

    sales_order_auto_customer = await client.post(
        "/api/sales-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"customer_location_id": location_id, "items": []},
    )
    assert sales_order_auto_customer.status_code == 201
    assert sales_order_auto_customer.json()["order"]["customer_id"] == customer_a
    assert sales_order_auto_customer.json()["order"]["customer_location_id"] == location_id

    sales_order_conflict = await client.post(
        "/api/sales-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"customer_id": customer_b, "customer_location_id": location_id, "items": []},
    )
    assert sales_order_conflict.status_code == 409

    shipment_auto_customer = await client.post(
        "/api/shipments",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"carrier": "dhl", "customer_location_id": location_id},
    )
    assert shipment_auto_customer.status_code == 201
    assert shipment_auto_customer.json()["customer_id"] == customer_a
    assert shipment_auto_customer.json()["customer_location_id"] == location_id

    shipment_conflict = await client.post(
        "/api/shipments",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"carrier": "dpd", "customer_id": customer_b, "customer_location_id": location_id},
    )
    assert shipment_conflict.status_code == 409
