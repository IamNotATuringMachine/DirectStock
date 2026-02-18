from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.purchasing import ClientOperationLog


def _auth_headers(token: str, operation_id: str | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {token}"}
    if operation_id:
        headers["X-Client-Operation-Id"] = operation_id
    return headers


async def _create_warehouse(client: AsyncClient, admin_token: str, prefix: str) -> int:
    response = await client.post(
        "/api/warehouses",
        headers=_auth_headers(admin_token),
        json={"code": f"{prefix}-{uuid4().hex[:6]}", "name": f"Warehouse {prefix}", "is_active": True},
    )
    assert response.status_code == 201
    return int(response.json()["id"])


@pytest.mark.asyncio
async def test_idempotent_replay_for_core_wave6_mutations(client: AsyncClient, admin_token: str):
    returns_op = f"op-ret-{uuid4().hex[:12]}"
    first_return = await client.post(
        "/api/return-orders",
        headers=_auth_headers(admin_token, returns_op),
        json={"notes": "phase6-idempotent-return"},
    )
    second_return = await client.post(
        "/api/return-orders",
        headers=_auth_headers(admin_token, returns_op),
        json={"notes": "phase6-idempotent-return"},
    )
    assert first_return.status_code == 201
    assert second_return.status_code == 201
    assert first_return.json()["id"] == second_return.json()["id"]

    purchasing_op = f"op-po-{uuid4().hex[:12]}"
    first_po = await client.post(
        "/api/purchase-orders",
        headers=_auth_headers(admin_token, purchasing_op),
        json={"notes": "phase6-idempotent-po"},
    )
    second_po = await client.post(
        "/api/purchase-orders",
        headers=_auth_headers(admin_token, purchasing_op),
        json={"notes": "phase6-idempotent-po"},
    )
    assert first_po.status_code == 201
    assert second_po.status_code == 201
    assert first_po.json()["id"] == second_po.json()["id"]

    warehouse_id = await _create_warehouse(client, admin_token, "W6-INV")
    inventory_op = f"op-inv-{uuid4().hex[:12]}"
    first_inventory = await client.post(
        "/api/inventory-counts",
        headers=_auth_headers(admin_token, inventory_op),
        json={"session_type": "snapshot", "warehouse_id": warehouse_id},
    )
    second_inventory = await client.post(
        "/api/inventory-counts",
        headers=_auth_headers(admin_token, inventory_op),
        json={"session_type": "snapshot", "warehouse_id": warehouse_id},
    )
    assert first_inventory.status_code == 201
    assert second_inventory.status_code == 201
    assert first_inventory.json()["id"] == second_inventory.json()["id"]

    source_wh = await _create_warehouse(client, admin_token, "W6-SRC")
    target_wh = await _create_warehouse(client, admin_token, "W6-TGT")
    transfer_op = f"op-iwt-{uuid4().hex[:12]}"
    transfer_payload = {
        "from_warehouse_id": source_wh,
        "to_warehouse_id": target_wh,
        "notes": "phase6-idempotent-transfer",
    }
    first_transfer = await client.post(
        "/api/inter-warehouse-transfers",
        headers=_auth_headers(admin_token, transfer_op),
        json=transfer_payload,
    )
    second_transfer = await client.post(
        "/api/inter-warehouse-transfers",
        headers=_auth_headers(admin_token, transfer_op),
        json=transfer_payload,
    )
    assert first_transfer.status_code == 201
    assert second_transfer.status_code == 201
    assert first_transfer.json()["id"] == second_transfer.json()["id"]


@pytest.mark.asyncio
async def test_idempotency_conflict_for_cross_endpoint_operation_reuse(client: AsyncClient, admin_token: str):
    operation_id = f"op-conflict-{uuid4().hex[:12]}"

    created_return = await client.post(
        "/api/return-orders",
        headers=_auth_headers(admin_token, operation_id),
        json={"notes": "phase6-conflict-return"},
    )
    assert created_return.status_code == 201

    reused_for_purchase_order = await client.post(
        "/api/purchase-orders",
        headers=_auth_headers(admin_token, operation_id),
        json={"notes": "phase6-conflict-po"},
    )
    assert reused_for_purchase_order.status_code == 409
    payload = reused_for_purchase_order.json()
    assert payload["code"] == "conflict"
    assert payload["details"]["operation_id"] == operation_id
    assert payload["details"]["existing_endpoint"] == "/api/return-orders"
    assert payload["details"]["request_endpoint"] == "/api/purchase-orders"


@pytest.mark.asyncio
async def test_idempotency_in_progress_conflict_is_stable(
    client: AsyncClient,
    admin_token: str,
    db_session: AsyncSession,
):
    operation_id = f"op-in-progress-{uuid4().hex[:12]}"
    db_session.add(
        ClientOperationLog(
            operation_id=operation_id,
            endpoint="/api/return-orders",
            method="POST",
            status_code=0,
            response_body=None,
        )
    )
    await db_session.commit()

    response = await client.post(
        "/api/return-orders",
        headers=_auth_headers(admin_token, operation_id),
        json={"notes": "phase6-in-progress"},
    )
    assert response.status_code == 409
    payload = response.json()
    assert payload["code"] == "conflict"
    assert payload["details"]["operation_id"] == operation_id
    assert "already in progress" in payload["message"].lower()
