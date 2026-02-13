from uuid import uuid4

import pytest
from httpx import AsyncClient

from phase3_utils import create_product_and_bin, receive_stock


def _suffix() -> str:
    return uuid4().hex[:8].upper()


@pytest.mark.asyncio
async def test_pick_wave_lifecycle(client: AsyncClient, admin_token: str):
    prefix = f"PK-{_suffix()}"
    data = await create_product_and_bin(client, admin_token, prefix)
    await receive_stock(client, admin_token, product_id=int(data["product_id"]), bin_id=int(data["bin_id"]), quantity="10")

    issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert issue.status_code == 201

    issue_item = await client.post(
        f"/api/goods-issues/{issue.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "requested_quantity": "2",
            "unit": "piece",
            "source_bin_id": data["bin_id"],
        },
    )
    assert issue_item.status_code == 201

    wave = await client.post(
        "/api/pick-waves",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"goods_issue_ids": [issue.json()["id"]]},
    )
    assert wave.status_code == 201
    wave_id = wave.json()["wave"]["id"]
    task_id = wave.json()["tasks"][0]["id"]

    release = await client.post(
        f"/api/pick-waves/{wave_id}/release",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert release.status_code == 200

    pick_task = await client.patch(
        f"/api/pick-tasks/{task_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "picked"},
    )
    assert pick_task.status_code == 200
    assert pick_task.json()["status"] == "picked"

    complete = await client.post(
        f"/api/pick-waves/{wave_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200
    assert complete.json()["status"] == "completed"
