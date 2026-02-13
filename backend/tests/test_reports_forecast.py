from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"{prefix}-GROUP", "description": "Forecast group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-001",
            "name": f"{prefix} Product",
            "description": "Forecast test product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201

    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-WH", "name": f"Warehouse {prefix}", "address": "Test", "is_active": True},
    )
    assert warehouse.status_code == 201

    zone = await client.post(
        f"/api/warehouses/{warehouse.json()['id']}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-Z", "name": "Zone", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201

    bin_row = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-BIN", "bin_type": "storage", "is_active": True},
    )
    assert bin_row.status_code == 201

    return {
        "product_id": product.json()["id"],
        "warehouse_id": warehouse.json()["id"],
        "bin_id": bin_row.json()["id"],
    }


async def _receive_stock(client: AsyncClient, admin_token: str, *, product_id: int, bin_id: int, quantity: str):
    receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert receipt.status_code == 201

    item = await client.post(
        f"/api/goods-receipts/{receipt.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"product_id": product_id, "received_quantity": quantity, "unit": "piece", "target_bin_id": bin_id},
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt.json()['id']}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200


async def _issue_stock(client: AsyncClient, admin_token: str, *, product_id: int, bin_id: int, quantity: str):
    issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert issue.status_code == 201

    item = await client.post(
        f"/api/goods-issues/{issue.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"product_id": product_id, "requested_quantity": quantity, "unit": "piece", "source_bin_id": bin_id},
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-issues/{issue.json()['id']}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200


@pytest.mark.asyncio
async def test_reports_trends_and_demand_forecast(client: AsyncClient, admin_token: str):
    prefix = f"RFC-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    await _receive_stock(client, admin_token, product_id=data["product_id"], bin_id=data["bin_id"], quantity="12")
    await _issue_stock(client, admin_token, product_id=data["product_id"], bin_id=data["bin_id"], quantity="3")

    recompute = await client.post(
        "/api/reports/demand-forecast/recompute",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"warehouse_id": data["warehouse_id"]},
    )
    assert recompute.status_code == 200
    assert "run_id" in recompute.json()["message"]

    trends = await client.get(
        "/api/reports/trends",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"warehouse_id": data["warehouse_id"]},
    )
    assert trends.status_code == 200
    assert len(trends.json()["items"]) >= 1

    forecast = await client.get(
        "/api/reports/demand-forecast",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"warehouse_id": data["warehouse_id"]},
    )
    assert forecast.status_code == 200
    assert forecast.json()["total"] >= 1
