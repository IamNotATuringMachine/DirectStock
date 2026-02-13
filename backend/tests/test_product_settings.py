from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


@pytest.mark.asyncio
async def test_product_warehouse_setting_upsert_and_low_stock(client: AsyncClient, admin_token: str):
    suffix = _suffix()

    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"PWS-GRP-{suffix}", "description": "Settings Group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"PWS-ART-{suffix}",
            "name": "Settings Product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]

    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"PWS-WH-{suffix}", "name": "Settings Warehouse", "address": "Test", "is_active": True},
    )
    assert warehouse.status_code == 201
    warehouse_id = warehouse.json()["id"]

    upsert = await client.put(
        f"/api/products/{product_id}/warehouse-settings/{warehouse_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "ean": f"{4000000000100 + int(suffix[:2], 16):013d}",
            "min_stock": "8",
            "reorder_point": "10",
            "max_stock": "20",
            "safety_stock": "2",
            "lead_time_days": 3,
        },
    )
    assert upsert.status_code == 200

    listed = await client.get(
        f"/api/products/{product_id}/warehouse-settings",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listed.status_code == 200
    assert listed.json()[0]["warehouse_id"] == warehouse_id

    low_stock = await client.get(
        "/api/inventory/low-stock",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert low_stock.status_code == 200
    assert any(
        item["product_id"] == product_id and Decimal(item["threshold"]) == Decimal("10")
        for item in low_stock.json()
    )
