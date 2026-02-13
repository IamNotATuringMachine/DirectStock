from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


@pytest.mark.asyncio
async def test_supplier_crud_and_product_assignment(client: AsyncClient, admin_token: str):
    suffix = _suffix()

    supplier = await client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_number": f"SUP-{suffix}",
            "company_name": "Supplier Test GmbH",
            "contact_name": "Max Mustermann",
            "email": "supplier@example.com",
            "phone": "+4912345",
            "is_active": True,
        },
    )
    assert supplier.status_code == 201
    supplier_id = supplier.json()["id"]

    listed = await client.get(
        f"/api/suppliers?search={suffix}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1

    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"SUP-GRP-{suffix}", "description": "Supplier Group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"SUP-ART-{suffix}",
            "name": "Supplier Product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]

    relation = await client.post(
        f"/api/products/{product_id}/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_id": supplier_id,
            "supplier_product_number": "SUP-PN-1",
            "price": "12.50",
            "lead_time_days": 4,
            "min_order_quantity": "2",
            "is_preferred": True,
        },
    )
    assert relation.status_code == 201

    relations = await client.get(
        f"/api/products/{product_id}/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert relations.status_code == 200
    assert relations.json()[0]["supplier_id"] == supplier_id


@pytest.mark.asyncio
async def test_non_admin_cannot_mutate_suppliers(client: AsyncClient, admin_token: str):
    create_worker = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": f"supworker-{_suffix().lower()}",
            "email": f"supworker-{_suffix().lower()}@example.com",
            "full_name": "Supplier Worker",
            "password": "WorkerPass123!",
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert create_worker.status_code == 201

    worker_login = await client.post(
        "/api/auth/login", json={"username": create_worker.json()["username"], "password": "WorkerPass123!"}
    )
    assert worker_login.status_code == 200
    worker_token = worker_login.json()["access_token"]

    forbidden = await client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={"supplier_number": f"SUP-{_suffix()}", "company_name": "Forbidden"},
    )
    assert forbidden.status_code == 403
