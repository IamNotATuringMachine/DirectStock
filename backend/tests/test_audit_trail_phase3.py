from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_audit_log_endpoint_with_filters(client: AsyncClient, admin_token: str):
    unique_note = f"audit-{uuid4().hex[:8]}"
    created = await client.post(
        "/api/return-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": unique_note},
    )
    assert created.status_code == 201

    listing = await client.get(
        "/api/audit-log?entity=return-orders&page=1&page_size=50",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listing.status_code == 200
    payload = listing.json()
    assert payload["total"] >= 1
    assert len(payload["items"]) >= 1
    first = payload["items"][0]
    assert "request_id" in first
    assert "endpoint" in first
    assert "method" in first


@pytest.mark.asyncio
async def test_audit_log_contains_before_after_snapshots(client: AsyncClient, admin_token: str):
    created = await client.post(
        "/api/return-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": "before-state"},
    )
    assert created.status_code == 201
    order_id = created.json()["id"]

    updated = await client.put(
        f"/api/return-orders/{order_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": "after-state"},
    )
    assert updated.status_code == 200

    listing = await client.get(
        "/api/audit-log?entity=return-orders&action=PUT&page=1&page_size=50",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listing.status_code == 200
    payload = listing.json()
    assert payload["items"]
    row = next(item for item in payload["items"] if item["endpoint"] == f"/api/return-orders/{order_id}")
    assert row["entity_snapshot_before"] is not None
    assert row["entity_snapshot_after"] is not None
    assert row["entity_snapshot_before"]["notes"] == "before-state"
    assert row["entity_snapshot_after"]["notes"] == "after-state"
    assert "notes" in (row["changed_fields"] or [])
