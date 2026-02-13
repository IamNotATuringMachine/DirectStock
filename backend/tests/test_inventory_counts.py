from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"{prefix}-GROUP", "description": "Inventory count test group"},
    )
    assert group.status_code == 201
    group_id = group.json()["id"]

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-001",
            "name": f"{prefix} Product",
            "description": "Inventory count test product",
            "product_group_id": group_id,
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]

    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-WH", "name": f"Warehouse {prefix}", "address": "Test", "is_active": True},
    )
    assert warehouse.status_code == 201
    warehouse_id = warehouse.json()["id"]

    zone = await client.post(
        f"/api/warehouses/{warehouse_id}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-Z", "name": "Zone", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201
    zone_id = zone.json()["id"]

    bin_a = await client.post(
        f"/api/zones/{zone_id}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-BIN-A", "bin_type": "storage", "is_active": True},
    )
    assert bin_a.status_code == 201

    return {
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "bin_a_id": bin_a.json()["id"],
    }


async def _receive_stock(
    client: AsyncClient,
    admin_token: str,
    *,
    product_id: int,
    bin_id: int,
    quantity: str,
) -> None:
    receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["id"]

    item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product_id,
            "received_quantity": quantity,
            "unit": "piece",
            "target_bin_id": bin_id,
        },
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200


@pytest.mark.asyncio
async def test_inventory_count_session_complete_adjusts_inventory(client: AsyncClient, admin_token: str):
    prefix = f"IC-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    await _receive_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        quantity="10",
    )

    create_session = await client.post(
        "/api/inventory-counts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "session_type": "snapshot",
            "warehouse_id": data["warehouse_id"],
            "tolerance_quantity": "2",
        },
    )
    assert create_session.status_code == 201
    session = create_session.json()

    generate = await client.post(
        f"/api/inventory-counts/{session['id']}/generate-items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"refresh_existing": False},
    )
    assert generate.status_code == 200

    items = await client.get(
        f"/api/inventory-counts/{session['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert items.status_code == 200
    count_item = items.json()[0]

    count_update = await client.put(
        f"/api/inventory-counts/{session['id']}/items/{count_item['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"counted_quantity": "8"},
    )
    assert count_update.status_code == 200
    assert count_update.json()["difference_quantity"] == "-2.000"

    complete = await client.post(
        f"/api/inventory-counts/{session['id']}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200

    inventory = await client.get(
        f"/api/inventory/by-bin/{data['bin_a_id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert inventory.status_code == 200
    assert inventory.json()[0]["quantity"] == "8.000"

    movements = await client.get(
        "/api/inventory/movements?limit=50",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert movements.status_code == 200
    assert any(
        row["movement_type"] == "inventory_adjustment" and row["reference_number"] == session["session_number"]
        for row in movements.json()
    )


@pytest.mark.asyncio
async def test_inventory_count_complete_blocks_when_uncounted_items_exist(client: AsyncClient, admin_token: str):
    prefix = f"ICU-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)
    await _receive_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        quantity="5",
    )

    create_session = await client.post(
        "/api/inventory-counts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"session_type": "snapshot", "warehouse_id": data["warehouse_id"]},
    )
    assert create_session.status_code == 201
    session_id = create_session.json()["id"]

    generate = await client.post(
        f"/api/inventory-counts/{session_id}/generate-items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"refresh_existing": False},
    )
    assert generate.status_code == 200

    complete = await client.post(
        f"/api/inventory-counts/{session_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 422
    assert complete.json()["code"] == "validation_error"


@pytest.mark.asyncio
async def test_inventory_count_recount_required_flow(client: AsyncClient, admin_token: str):
    prefix = f"ICR-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)
    await _receive_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        quantity="10",
    )

    create_session = await client.post(
        "/api/inventory-counts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "session_type": "cycle",
            "warehouse_id": data["warehouse_id"],
            "tolerance_quantity": "1",
        },
    )
    assert create_session.status_code == 201
    session_id = create_session.json()["id"]

    generate = await client.post(
        f"/api/inventory-counts/{session_id}/generate-items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"refresh_existing": False},
    )
    assert generate.status_code == 200

    items = await client.get(
        f"/api/inventory-counts/{session_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert items.status_code == 200
    item = items.json()[0]

    first_count = await client.put(
        f"/api/inventory-counts/{session_id}/items/{item['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"counted_quantity": "6"},
    )
    assert first_count.status_code == 200
    assert first_count.json()["recount_required"] is True
    assert first_count.json()["count_attempts"] == 1

    blocked_complete = await client.post(
        f"/api/inventory-counts/{session_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert blocked_complete.status_code == 409
    assert blocked_complete.json()["code"] == "conflict"

    second_count = await client.put(
        f"/api/inventory-counts/{session_id}/items/{item['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"counted_quantity": "9"},
    )
    assert second_count.status_code == 200
    assert second_count.json()["recount_required"] is False
    assert second_count.json()["count_attempts"] == 2

    complete = await client.post(
        f"/api/inventory-counts/{session_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200
