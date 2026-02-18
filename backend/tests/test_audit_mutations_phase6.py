from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_warehouse(client: AsyncClient, admin_token: str, prefix: str) -> int:
    response = await client.post(
        "/api/warehouses",
        headers=_auth_headers(admin_token),
        json={"code": f"{prefix}-{uuid4().hex[:6]}", "name": f"Warehouse {prefix}", "is_active": True},
    )
    assert response.status_code == 201
    return int(response.json()["id"])


async def _assert_latest_audit_entry(
    db_session: AsyncSession,
    *,
    endpoint: str,
    action: str,
    expected_status: int,
) -> None:
    entry = (
        (
            await db_session.execute(
                select(AuditLog)
                .where(AuditLog.endpoint == endpoint, AuditLog.action == action)
                .order_by(AuditLog.id.desc())
            )
        )
        .scalars()
        .first()
    )

    assert entry is not None
    assert entry.request_id
    assert entry.status_code == expected_status


@pytest.mark.asyncio
async def test_core_mutations_create_audit_entries(client: AsyncClient, admin_token: str, db_session: AsyncSession):
    unique = uuid4().hex[:8]

    return_response = await client.post(
        "/api/return-orders",
        headers=_auth_headers(admin_token),
        json={"notes": f"phase6-audit-return-{unique}"},
    )
    assert return_response.status_code == 201

    purchase_response = await client.post(
        "/api/purchase-orders",
        headers=_auth_headers(admin_token),
        json={"notes": f"phase6-audit-po-{unique}"},
    )
    assert purchase_response.status_code == 201

    inventory_warehouse = await _create_warehouse(client, admin_token, "AUD-INV")
    inventory_response = await client.post(
        "/api/inventory-counts",
        headers=_auth_headers(admin_token),
        json={"session_type": "snapshot", "warehouse_id": inventory_warehouse},
    )
    assert inventory_response.status_code == 201

    source_wh = await _create_warehouse(client, admin_token, "AUD-SRC")
    target_wh = await _create_warehouse(client, admin_token, "AUD-TGT")
    transfer_response = await client.post(
        "/api/inter-warehouse-transfers",
        headers=_auth_headers(admin_token),
        json={
            "from_warehouse_id": source_wh,
            "to_warehouse_id": target_wh,
            "notes": f"phase6-audit-transfer-{unique}",
        },
    )
    assert transfer_response.status_code == 201

    await _assert_latest_audit_entry(
        db_session,
        endpoint="/api/return-orders",
        action="POST",
        expected_status=201,
    )
    await _assert_latest_audit_entry(
        db_session,
        endpoint="/api/purchase-orders",
        action="POST",
        expected_status=201,
    )
    await _assert_latest_audit_entry(
        db_session,
        endpoint="/api/inventory-counts",
        action="POST",
        expected_status=201,
    )
    await _assert_latest_audit_entry(
        db_session,
        endpoint="/api/inter-warehouse-transfers",
        action="POST",
        expected_status=201,
    )
