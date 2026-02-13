from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"{prefix}-GROUP", "description": "Batch test group"},
    )
    assert group.status_code == 201
    group_id = group.json()["id"]

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-001",
            "name": f"{prefix} Product",
            "description": "Batch test product",
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
        "zone_id": zone_id,
        "bin_a_id": bin_a.json()["id"],
    }


async def _receive_batch(
    client: AsyncClient,
    admin_token: str,
    *,
    product_id: int,
    bin_id: int,
    quantity: str,
    batch_number: str,
    expiry_date: str,
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
            "batch_number": batch_number,
            "expiry_date": expiry_date,
        },
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200


@pytest.mark.asyncio
async def test_goods_receipt_tracks_batches_in_inventory_views(client: AsyncClient, admin_token: str):
    prefix = f"BT-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    await _receive_batch(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        quantity="10",
        batch_number=f"{prefix}-B1",
        expiry_date="2030-05-01",
    )

    by_product = await client.get(
        f"/api/inventory/by-product/{data['product_id']}/batches",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert by_product.status_code == 200
    product_rows = by_product.json()
    assert len(product_rows) == 1
    assert product_rows[0]["batch_number"] == f"{prefix}-B1"
    assert product_rows[0]["quantity"] == "10.000"
    assert product_rows[0]["bin_id"] == data["bin_a_id"]

    by_bin = await client.get(
        f"/api/inventory/by-bin/{data['bin_a_id']}/batches",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert by_bin.status_code == 200
    bin_rows = by_bin.json()
    assert len(bin_rows) == 1
    assert bin_rows[0]["batch_number"] == f"{prefix}-B1"
    assert bin_rows[0]["quantity"] == "10.000"


@pytest.mark.asyncio
async def test_goods_issue_fefo_selects_earliest_expiry_batch(client: AsyncClient, admin_token: str):
    prefix = f"FEFO-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    await _receive_batch(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        quantity="4",
        batch_number=f"{prefix}-LATE",
        expiry_date="2030-12-31",
    )
    await _receive_batch(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        quantity="4",
        batch_number=f"{prefix}-EARLY",
        expiry_date="2030-01-15",
    )

    issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert issue.status_code == 201
    issue_id = issue.json()["id"]

    issue_item = await client.post(
        f"/api/goods-issues/{issue_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "requested_quantity": "2",
            "unit": "piece",
            "source_bin_id": data["bin_a_id"],
            "use_fefo": True,
        },
    )
    assert issue_item.status_code == 201

    complete = await client.post(
        f"/api/goods-issues/{issue_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200

    issue_items = await client.get(
        f"/api/goods-issues/{issue_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert issue_items.status_code == 200
    assert issue_items.json()[0]["batch_number"] == f"{prefix}-EARLY"

    by_product = await client.get(
        f"/api/inventory/by-product/{data['product_id']}/batches",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert by_product.status_code == 200
    quantities = {row["batch_number"]: row["quantity"] for row in by_product.json()}
    assert quantities[f"{prefix}-EARLY"] == "2.000"
    assert quantities[f"{prefix}-LATE"] == "4.000"
