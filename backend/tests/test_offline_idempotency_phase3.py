from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_idempotent_replay_for_return_order_create(client: AsyncClient, admin_token: str):
    operation_id = f"op-{uuid4().hex[:8]}"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "X-Client-Operation-Id": operation_id,
    }

    first = await client.post("/api/return-orders", headers=headers, json={"notes": "idempotent return"})
    assert first.status_code == 201

    second = await client.post("/api/return-orders", headers=headers, json={"notes": "idempotent return"})
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]


@pytest.mark.asyncio
async def test_idempotency_conflict_between_phase3_endpoints(client: AsyncClient, admin_token: str):
    operation_id = f"op-{uuid4().hex[:8]}"

    first = await client.post(
        "/api/return-orders",
        headers={
            "Authorization": f"Bearer {admin_token}",
            "X-Client-Operation-Id": operation_id,
        },
        json={"notes": "first"},
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/pick-waves",
        headers={
            "Authorization": f"Bearer {admin_token}",
            "X-Client-Operation-Id": operation_id,
        },
        json={},
    )
    assert second.status_code == 409
    payload = second.json()
    assert payload["code"] == "conflict"
