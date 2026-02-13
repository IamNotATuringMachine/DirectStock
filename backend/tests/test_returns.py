from uuid import uuid4

import pytest
from httpx import AsyncClient

from phase3_utils import create_product_and_bin


def _suffix() -> str:
    return uuid4().hex[:8].upper()


@pytest.mark.asyncio
async def test_return_order_lifecycle(client: AsyncClient, admin_token: str):
    prefix = f"RT-{_suffix()}"
    data = await create_product_and_bin(client, admin_token, prefix)

    order = await client.post(
        "/api/return-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": "phase3 return"},
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    item = await client.post(
        f"/api/return-orders/{order_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "quantity": "1",
            "unit": "piece",
            "decision": "restock",
            "target_bin_id": data["bin_id"],
        },
    )
    assert item.status_code == 201

    received = await client.post(
        f"/api/return-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "received"},
    )
    assert received.status_code == 200

    inspected = await client.post(
        f"/api/return-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "inspected"},
    )
    assert inspected.status_code == 200

    resolved = await client.post(
        f"/api/return-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "resolved"},
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"
