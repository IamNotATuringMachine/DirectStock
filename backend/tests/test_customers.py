from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


@pytest.mark.asyncio
async def test_customer_crud_and_goods_issue_link(client: AsyncClient, admin_token: str):
    suffix = _suffix()

    customer = await client.post(
        "/api/customers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "customer_number": f"CUS-{suffix}",
            "company_name": "Customer Test AG",
            "contact_name": "Erika Muster",
            "email": "customer@example.com",
            "phone": "+49223344",
            "billing_address": "Billing Address",
            "shipping_address": "Shipping Address",
            "payment_terms": "14 Tage",
            "delivery_terms": "DAP",
            "credit_limit": "5000",
            "is_active": True,
        },
    )
    assert customer.status_code == 201
    customer_id = customer.json()["id"]

    listed = await client.get(
        f"/api/customers?search={suffix}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1

    issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"customer_id": customer_id, "customer_reference": f"ORDER-{suffix}"},
    )
    assert issue.status_code == 201
    assert issue.json()["customer_id"] == customer_id


@pytest.mark.asyncio
async def test_non_admin_cannot_mutate_customers(client: AsyncClient, admin_token: str):
    user_suffix = _suffix().lower()

    create_worker = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": f"cusworker-{user_suffix}",
            "email": f"cusworker-{user_suffix}@example.com",
            "full_name": "Customer Worker",
            "password": "WorkerPass123!",
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert create_worker.status_code == 201

    worker_login = await client.post(
        "/api/auth/login",
        json={"username": f"cusworker-{user_suffix}", "password": "WorkerPass123!"},
    )
    assert worker_login.status_code == 200

    forbidden = await client.post(
        "/api/customers",
        headers={"Authorization": f"Bearer {worker_login.json()['access_token']}"},
        json={"customer_number": f"CUS-{_suffix()}", "company_name": "Forbidden"},
    )
    assert forbidden.status_code == 403
