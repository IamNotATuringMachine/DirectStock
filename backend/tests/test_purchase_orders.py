from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


@pytest.mark.asyncio
async def test_purchase_order_lifecycle(client: AsyncClient, admin_token: str):
    suffix = _suffix()

    supplier = await client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_number": f"PO-SUP-{suffix}",
            "company_name": "PO Supplier",
            "is_active": True,
        },
    )
    assert supplier.status_code == 201

    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"PO-GRP-{suffix}", "description": "PO Group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"PO-ART-{suffix}",
            "name": "PO Product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201

    order = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": supplier.json()["id"], "notes": "PO test"},
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    item = await client.post(
        f"/api/purchase-orders/{order_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product.json()["id"],
            "ordered_quantity": "5",
            "unit": "piece",
            "unit_price": "11.00",
        },
    )
    assert item.status_code == 201

    approved = await client.post(
        f"/api/purchase-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "approved"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    ordered = await client.post(
        f"/api/purchase-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "ordered"},
    )
    assert ordered.status_code == 200
    assert ordered.json()["status"] == "ordered"

    invalid = await client.post(
        f"/api/purchase-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "draft"},
    )
    assert invalid.status_code == 409
