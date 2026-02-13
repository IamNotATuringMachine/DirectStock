from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_product(client: AsyncClient, admin_token: str, prefix: str) -> int:
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"{prefix}-GROUP", "description": "IWT group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-001",
            "name": f"{prefix} Product",
            "description": "IWT test product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201
    return product.json()["id"]


async def _create_wh_zone_bin(client: AsyncClient, admin_token: str, code_prefix: str) -> tuple[int, int]:
    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{code_prefix}-WH", "name": f"Warehouse {code_prefix}", "address": "Test", "is_active": True},
    )
    assert warehouse.status_code == 201
    warehouse_id = warehouse.json()["id"]

    zone = await client.post(
        f"/api/warehouses/{warehouse_id}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{code_prefix}-Z", "name": "Zone", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201

    bin_row = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{code_prefix}-BIN", "bin_type": "storage", "is_active": True},
    )
    assert bin_row.status_code == 201
    return warehouse_id, bin_row.json()["id"]


async def _receive_stock(client: AsyncClient, admin_token: str, product_id: int, bin_id: int, quantity: str) -> None:
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
async def test_inter_warehouse_transfer_dispatch_and_receive(client: AsyncClient, admin_token: str):
    prefix = f"IWT-{_suffix()}"
    product_id = await _create_product(client, admin_token, prefix)
    source_wh_id, source_bin_id = await _create_wh_zone_bin(client, admin_token, f"{prefix}-SRC")
    target_wh_id, target_bin_id = await _create_wh_zone_bin(client, admin_token, f"{prefix}-TGT")

    await _receive_stock(client, admin_token, product_id, source_bin_id, "10")

    transfer = await client.post(
        "/api/inter-warehouse-transfers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "from_warehouse_id": source_wh_id,
            "to_warehouse_id": target_wh_id,
            "notes": "rebalance",
        },
    )
    assert transfer.status_code == 201
    transfer_id = transfer.json()["id"]

    item = await client.post(
        f"/api/inter-warehouse-transfers/{transfer_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product_id,
            "from_bin_id": source_bin_id,
            "to_bin_id": target_bin_id,
            "requested_quantity": "4",
            "unit": "piece",
        },
    )
    assert item.status_code == 201

    dispatch = await client.post(
        f"/api/inter-warehouse-transfers/{transfer_id}/dispatch",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert dispatch.status_code == 200

    source_after_dispatch = await client.get(
        f"/api/inventory/by-bin/{source_bin_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert source_after_dispatch.status_code == 200
    assert source_after_dispatch.json()[0]["quantity"] == "6.000"

    receive = await client.post(
        f"/api/inter-warehouse-transfers/{transfer_id}/receive",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert receive.status_code == 200

    target_after_receive = await client.get(
        f"/api/inventory/by-bin/{target_bin_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert target_after_receive.status_code == 200
    assert target_after_receive.json()[0]["quantity"] == "4.000"
