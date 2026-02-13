from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


@pytest.mark.asyncio
async def test_dashboard_endpoints(client: AsyncClient, admin_token: str):
    suffix = _suffix()

    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"DB-{suffix}-GROUP", "description": "Dashboard"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"DB-{suffix}-ART",
            "name": "Dashboard Product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201

    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"DB-{suffix}-WH", "name": "Dashboard Warehouse", "address": "Test", "is_active": True},
    )
    assert warehouse.status_code == 201

    zone = await client.post(
        f"/api/warehouses/{warehouse.json()['id']}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "D", "name": "Dash", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201

    bin_location = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"DB-{suffix}-BIN", "bin_type": "storage", "is_active": True},
    )
    assert bin_location.status_code == 201

    receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert receipt.status_code == 201

    receipt_item = await client.post(
        f"/api/goods-receipts/{receipt.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product.json()["id"],
            "received_quantity": "2",
            "unit": "piece",
            "target_bin_id": bin_location.json()["id"],
        },
    )
    assert receipt_item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt.json()['id']}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200

    summary = await client.get(
        "/api/dashboard/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert summary.status_code == 200
    summary_payload = summary.json()
    assert summary_payload["total_products"] >= 1
    assert summary_payload["total_warehouses"] >= 1
    assert summary_payload["total_bins"] >= 1

    recent = await client.get(
        "/api/dashboard/recent-movements?limit=5",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert recent.status_code == 200
    assert isinstance(recent.json()["items"], list)

    low_stock = await client.get(
        "/api/dashboard/low-stock",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert low_stock.status_code == 200
    assert "items" in low_stock.json()

    activity = await client.get(
        "/api/dashboard/activity-today",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert activity.status_code == 200
    assert activity.json()["movements_today"] >= 1
