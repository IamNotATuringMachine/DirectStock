from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"{prefix}-GROUP", "description": "Ops group"},
    )
    assert group.status_code == 201
    group_id = group.json()["id"]

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-001",
            "name": f"{prefix} Product",
            "description": "Ops test product",
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

    bin_b = await client.post(
        f"/api/zones/{zone_id}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-BIN-B", "bin_type": "storage", "is_active": True},
    )
    assert bin_b.status_code == 201

    return {
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "zone_id": zone_id,
        "bin_a_id": bin_a.json()["id"],
        "bin_b_id": bin_b.json()["id"],
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
async def test_goods_receipt_complete_updates_inventory_and_movements(client: AsyncClient, admin_token: str):
    prefix = f"GR-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": "Incoming shipment"},
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["id"]

    item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "expected_quantity": "12",
            "received_quantity": "10",
            "unit": "piece",
            "target_bin_id": data["bin_a_id"],
        },
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200

    receipt_detail = await client.get(
        f"/api/goods-receipts/{receipt_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert receipt_detail.status_code == 200
    assert receipt_detail.json()["status"] == "completed"

    by_bin = await client.get(
        f"/api/inventory/by-bin/{data['bin_a_id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert by_bin.status_code == 200
    assert by_bin.json()[0]["quantity"] == "10.000"

    movements = await client.get(
        "/api/inventory/movements",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert movements.status_code == 200
    assert any(
        row["reference_number"] == receipt.json()["receipt_number"] and row["movement_type"] == "goods_receipt"
        for row in movements.json()
    )


@pytest.mark.asyncio
async def test_goods_issue_complete_checks_available_stock(client: AsyncClient, admin_token: str):
    prefix = f"GI-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    await _receive_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        quantity="6",
    )

    issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"customer_reference": f"ORD-{prefix}"},
    )
    assert issue.status_code == 201
    issue_id = issue.json()["id"]

    issue_item = await client.post(
        f"/api/goods-issues/{issue_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "requested_quantity": "4",
            "unit": "piece",
            "source_bin_id": data["bin_a_id"],
        },
    )
    assert issue_item.status_code == 201

    complete = await client.post(
        f"/api/goods-issues/{issue_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200

    by_bin = await client.get(
        f"/api/inventory/by-bin/{data['bin_a_id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert by_bin.status_code == 200
    assert by_bin.json()[0]["quantity"] == "2.000"

    failing_issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert failing_issue.status_code == 201
    failing_issue_id = failing_issue.json()["id"]

    failing_item = await client.post(
        f"/api/goods-issues/{failing_issue_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "requested_quantity": "5",
            "unit": "piece",
            "source_bin_id": data["bin_a_id"],
        },
    )
    assert failing_item.status_code == 201

    fail_complete = await client.post(
        f"/api/goods-issues/{failing_issue_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert fail_complete.status_code == 409
    assert fail_complete.json()["code"] == "conflict"


@pytest.mark.asyncio
async def test_stock_transfer_complete_moves_inventory_atomically(client: AsyncClient, admin_token: str):
    prefix = f"ST-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    await _receive_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        quantity="5",
    )

    transfer = await client.post(
        "/api/stock-transfers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": "Rebalance"},
    )
    assert transfer.status_code == 201
    transfer_id = transfer.json()["id"]

    transfer_item = await client.post(
        f"/api/stock-transfers/{transfer_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "quantity": "3",
            "unit": "piece",
            "from_bin_id": data["bin_a_id"],
            "to_bin_id": data["bin_b_id"],
        },
    )
    assert transfer_item.status_code == 201

    complete = await client.post(
        f"/api/stock-transfers/{transfer_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200

    source = await client.get(
        f"/api/inventory/by-bin/{data['bin_a_id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    target = await client.get(
        f"/api/inventory/by-bin/{data['bin_b_id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert source.status_code == 200
    assert target.status_code == 200

    assert source.json()[0]["quantity"] == "2.000"
    assert target.json()[0]["quantity"] == "3.000"
