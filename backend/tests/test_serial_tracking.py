from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"{prefix}-GROUP", "description": "Serial test group"},
    )
    assert group.status_code == 201
    group_id = group.json()["id"]

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-001",
            "name": f"{prefix} Product",
            "description": "Serial test product",
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


async def _receive_serialized_stock(
    client: AsyncClient,
    admin_token: str,
    *,
    product_id: int,
    bin_id: int,
    serial_numbers: list[str],
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
            "received_quantity": str(len(serial_numbers)),
            "unit": "piece",
            "target_bin_id": bin_id,
            "serial_numbers": serial_numbers,
        },
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200


@pytest.mark.asyncio
async def test_goods_receipt_rejects_duplicate_serial_number(client: AsyncClient, admin_token: str):
    prefix = f"SR-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    await _receive_serialized_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        serial_numbers=[f"{prefix}-SN1", f"{prefix}-SN2"],
    )

    duplicate_receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert duplicate_receipt.status_code == 201
    duplicate_receipt_id = duplicate_receipt.json()["id"]

    item = await client.post(
        f"/api/goods-receipts/{duplicate_receipt_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "received_quantity": "1",
            "unit": "piece",
            "target_bin_id": data["bin_a_id"],
            "serial_numbers": [f"{prefix}-SN1"],
        },
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{duplicate_receipt_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 409
    assert complete.json()["code"] == "conflict"


@pytest.mark.asyncio
async def test_goods_issue_blocks_double_issue_for_same_serial(client: AsyncClient, admin_token: str):
    prefix = f"ISS-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)
    serial = f"{prefix}-SN1"

    await _receive_serialized_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        serial_numbers=[serial],
    )

    first_issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert first_issue.status_code == 201
    first_issue_id = first_issue.json()["id"]

    first_item = await client.post(
        f"/api/goods-issues/{first_issue_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "requested_quantity": "1",
            "unit": "piece",
            "source_bin_id": data["bin_a_id"],
            "serial_numbers": [serial],
        },
    )
    assert first_item.status_code == 201

    first_complete = await client.post(
        f"/api/goods-issues/{first_issue_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert first_complete.status_code == 200

    second_issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert second_issue.status_code == 201
    second_issue_id = second_issue.json()["id"]

    second_item = await client.post(
        f"/api/goods-issues/{second_issue_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "requested_quantity": "1",
            "unit": "piece",
            "source_bin_id": data["bin_a_id"],
            "serial_numbers": [serial],
        },
    )
    assert second_item.status_code == 201

    second_complete = await client.post(
        f"/api/goods-issues/{second_issue_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert second_complete.status_code == 409
    assert second_complete.json()["code"] == "conflict"


@pytest.mark.asyncio
async def test_stock_transfer_relocates_serial_to_target_bin(client: AsyncClient, admin_token: str):
    prefix = f"TR-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)
    serial = f"{prefix}-SN1"

    await _receive_serialized_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_a_id"],
        serial_numbers=[serial],
    )

    transfer = await client.post(
        "/api/stock-transfers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert transfer.status_code == 201
    transfer_id = transfer.json()["id"]

    transfer_item = await client.post(
        f"/api/stock-transfers/{transfer_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "quantity": "1",
            "unit": "piece",
            "from_bin_id": data["bin_a_id"],
            "to_bin_id": data["bin_b_id"],
            "serial_numbers": [serial],
        },
    )
    assert transfer_item.status_code == 201

    transfer_complete = await client.post(
        f"/api/stock-transfers/{transfer_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert transfer_complete.status_code == 200

    wrong_issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert wrong_issue.status_code == 201
    wrong_issue_id = wrong_issue.json()["id"]

    wrong_item = await client.post(
        f"/api/goods-issues/{wrong_issue_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "requested_quantity": "1",
            "unit": "piece",
            "source_bin_id": data["bin_a_id"],
            "serial_numbers": [serial],
        },
    )
    assert wrong_item.status_code == 201

    wrong_complete = await client.post(
        f"/api/goods-issues/{wrong_issue_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert wrong_complete.status_code == 409
    assert wrong_complete.json()["code"] == "conflict"

    right_issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert right_issue.status_code == 201
    right_issue_id = right_issue.json()["id"]

    right_item = await client.post(
        f"/api/goods-issues/{right_issue_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "requested_quantity": "1",
            "unit": "piece",
            "source_bin_id": data["bin_b_id"],
            "serial_numbers": [serial],
        },
    )
    assert right_item.status_code == 201

    right_complete = await client.post(
        f"/api/goods-issues/{right_issue_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert right_complete.status_code == 200
