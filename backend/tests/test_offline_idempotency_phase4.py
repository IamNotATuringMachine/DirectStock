from uuid import uuid4

import pytest
from httpx import AsyncClient


async def _create_integration_token(client: AsyncClient, admin_token: str) -> str:
    create = await client.post(
        "/api/integration-clients",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": f"idem-{uuid4().hex[:8]}",
            "client_id": f"idem-client-{uuid4().hex[:8]}",
            "scopes": ["orders:write"],
        },
    )
    assert create.status_code == 201
    create_payload = create.json()

    token = await client.post(
        "/api/external/token",
        json={
            "client_id": create_payload["client"]["client_id"],
            "client_secret": create_payload["client_secret"],
            "scope": "orders:write",
        },
    )
    assert token.status_code == 200
    return token.json()["access_token"]


async def _create_product(client: AsyncClient, admin_token: str) -> int:
    suffix = uuid4().hex[:8].upper()
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"IDEM-{suffix}-GROUP", "description": "Idempotency group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"IDEM-{suffix}-ART-001",
            "name": f"Idem Product {suffix}",
            "description": "idempotency",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201
    return product.json()["id"]


@pytest.mark.asyncio
async def test_idempotent_replay_for_external_purchase_order_command(client: AsyncClient, admin_token: str):
    product_id = await _create_product(client, admin_token)
    token = await _create_integration_token(client, admin_token)

    operation_id = f"op-{uuid4().hex[:8]}"
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Client-Operation-Id": operation_id,
    }

    payload = {
        "notes": "idempotent external command",
        "items": [
            {
                "product_id": product_id,
                "ordered_quantity": "2",
                "unit": "piece",
            }
        ],
    }

    first = await client.post("/api/external/v1/commands/purchase-orders", headers=headers, json=payload)
    assert first.status_code == 201

    second = await client.post("/api/external/v1/commands/purchase-orders", headers=headers, json=payload)
    assert second.status_code == 201
    assert second.json()["purchase_order_id"] == first.json()["purchase_order_id"]


@pytest.mark.asyncio
async def test_idempotent_replay_for_inter_warehouse_dispatch(client: AsyncClient, admin_token: str):
    suffix = uuid4().hex[:8].upper()
    product_id = await _create_product(client, admin_token)

    source_wh = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"IDEM-{suffix}-SRC", "name": "Source", "address": "Test", "is_active": True},
    )
    assert source_wh.status_code == 201
    target_wh = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"IDEM-{suffix}-TGT", "name": "Target", "address": "Test", "is_active": True},
    )
    assert target_wh.status_code == 201

    source_zone = await client.post(
        f"/api/warehouses/{source_wh.json()['id']}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"IDEM-{suffix}-SZ", "name": "Source Zone", "zone_type": "storage", "is_active": True},
    )
    assert source_zone.status_code == 201
    target_zone = await client.post(
        f"/api/warehouses/{target_wh.json()['id']}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"IDEM-{suffix}-TZ", "name": "Target Zone", "zone_type": "storage", "is_active": True},
    )
    assert target_zone.status_code == 201

    source_bin = await client.post(
        f"/api/zones/{source_zone.json()['id']}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"IDEM-{suffix}-SB", "bin_type": "storage", "is_active": True},
    )
    assert source_bin.status_code == 201
    target_bin = await client.post(
        f"/api/zones/{target_zone.json()['id']}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"IDEM-{suffix}-TB", "bin_type": "storage", "is_active": True},
    )
    assert target_bin.status_code == 201

    receipt = await client.post("/api/goods-receipts", headers={"Authorization": f"Bearer {admin_token}"}, json={})
    assert receipt.status_code == 201
    receipt_item = await client.post(
        f"/api/goods-receipts/{receipt.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product_id,
            "received_quantity": "5",
            "unit": "piece",
            "target_bin_id": source_bin.json()["id"],
        },
    )
    assert receipt_item.status_code == 201
    complete_receipt = await client.post(
        f"/api/goods-receipts/{receipt.json()['id']}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete_receipt.status_code == 200

    transfer = await client.post(
        "/api/inter-warehouse-transfers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "from_warehouse_id": source_wh.json()["id"],
            "to_warehouse_id": target_wh.json()["id"],
        },
    )
    assert transfer.status_code == 201

    item = await client.post(
        f"/api/inter-warehouse-transfers/{transfer.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product_id,
            "from_bin_id": source_bin.json()["id"],
            "to_bin_id": target_bin.json()["id"],
            "requested_quantity": "2",
            "unit": "piece",
        },
    )
    assert item.status_code == 201

    operation_id = f"op-{uuid4().hex[:8]}"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "X-Client-Operation-Id": operation_id,
    }

    first = await client.post(f"/api/inter-warehouse-transfers/{transfer.json()['id']}/dispatch", headers=headers)
    assert first.status_code == 200

    second = await client.post(f"/api/inter-warehouse-transfers/{transfer.json()['id']}/dispatch", headers=headers)
    assert second.status_code == 200
    assert second.json()["message"] == first.json()["message"]
