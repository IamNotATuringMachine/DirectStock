from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import GoodsReceipt, Inventory, StockMovement


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_product_and_bin(client: AsyncClient, admin_token: str, prefix: str) -> tuple[int, int]:
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"{prefix}-GROUP", "description": "Idempotency Group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-1",
            "name": f"{prefix} Product",
            "description": "Idempotency Product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201

    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-WH", "name": f"Warehouse {prefix}", "is_active": True},
    )
    assert warehouse.status_code == 201

    zone = await client.post(
        f"/api/warehouses/{warehouse.json()['id']}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-Z", "name": "Zone", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201

    bin_location = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-BIN-1", "bin_type": "storage", "is_active": True},
    )
    assert bin_location.status_code == 201

    return product.json()["id"], bin_location.json()["id"]


@pytest.mark.asyncio
async def test_idempotent_replay_for_create_goods_receipt(
    client: AsyncClient,
    admin_token: str,
    db_session: AsyncSession,
):
    operation_id = f"op-{_suffix()}"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "X-Client-Operation-Id": operation_id,
    }

    first = await client.post("/api/goods-receipts", headers=headers, json={"notes": "idempotent create"})
    assert first.status_code == 201

    second = await client.post("/api/goods-receipts", headers=headers, json={"notes": "idempotent create"})
    assert second.status_code == 201

    first_payload = first.json()
    second_payload = second.json()
    assert second_payload["id"] == first_payload["id"]
    assert second_payload["receipt_number"] == first_payload["receipt_number"]

    count = (
        await db_session.execute(
            select(func.count(GoodsReceipt.id)).where(GoodsReceipt.receipt_number == first_payload["receipt_number"])
        )
    ).scalar_one()
    assert count == 1


@pytest.mark.asyncio
async def test_idempotency_conflict_when_operation_id_reused_for_other_endpoint(
    client: AsyncClient,
    admin_token: str,
):
    operation_id = f"op-{_suffix()}"

    create_receipt = await client.post(
        "/api/goods-receipts",
        headers={
            "Authorization": f"Bearer {admin_token}",
            "X-Client-Operation-Id": operation_id,
        },
        json={"notes": "first endpoint"},
    )
    assert create_receipt.status_code == 201

    reuse_different_endpoint = await client.post(
        "/api/goods-issues",
        headers={
            "Authorization": f"Bearer {admin_token}",
            "X-Client-Operation-Id": operation_id,
        },
        json={"notes": "different endpoint"},
    )

    assert reuse_different_endpoint.status_code == 409
    payload = reuse_different_endpoint.json()
    assert payload["code"] == "conflict"
    assert payload["details"]["operation_id"] == operation_id
    assert payload["details"]["existing_endpoint"] == "/api/goods-receipts"
    assert payload["details"]["request_endpoint"] == "/api/goods-issues"


@pytest.mark.asyncio
async def test_idempotent_replay_prevents_duplicate_completion_side_effects(
    client: AsyncClient,
    admin_token: str,
    db_session: AsyncSession,
):
    prefix = f"IDC-{_suffix()}"
    product_id, bin_id = await _create_product_and_bin(client, admin_token, prefix)

    receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": "complete-once"},
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["id"]
    receipt_number = receipt.json()["receipt_number"]

    item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product_id,
            "received_quantity": "5",
            "unit": "piece",
            "target_bin_id": bin_id,
        },
    )
    assert item.status_code == 201

    operation_id = f"op-{_suffix()}"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "X-Client-Operation-Id": operation_id,
    }

    first_complete = await client.post(f"/api/goods-receipts/{receipt_id}/complete", headers=headers)
    assert first_complete.status_code == 200

    second_complete = await client.post(f"/api/goods-receipts/{receipt_id}/complete", headers=headers)
    assert second_complete.status_code == 200

    inventory = (
        await db_session.execute(
            select(Inventory).where(Inventory.product_id == product_id, Inventory.bin_location_id == bin_id)
        )
    ).scalar_one()
    assert Decimal(inventory.quantity) == Decimal("5")

    movements = (
        await db_session.execute(
            select(func.count(StockMovement.id)).where(
                StockMovement.movement_type == "goods_receipt",
                StockMovement.reference_number == receipt_number,
            )
        )
    ).scalar_one()
    assert movements == 1
