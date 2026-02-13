from datetime import UTC, datetime
from uuid import uuid4

import pytest
from httpx import AsyncClient

from phase3_utils import create_product_and_bin, receive_stock


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _issue_stock(
    client: AsyncClient,
    admin_token: str,
    *,
    product_id: int,
    bin_id: int,
    quantity: str,
) -> None:
    issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert issue.status_code == 201
    issue_id = issue.json()["id"]

    item = await client.post(
        f"/api/goods-issues/{issue_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product_id,
            "requested_quantity": quantity,
            "unit": "piece",
            "source_bin_id": bin_id,
        },
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-issues/{issue_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200


@pytest.mark.asyncio
async def test_abc_recompute_and_list(client: AsyncClient, admin_token: str):
    prefix = f"ABC-{_suffix()}"
    data = await create_product_and_bin(client, admin_token, prefix)
    await receive_stock(client, admin_token, product_id=int(data["product_id"]), bin_id=int(data["bin_id"]), quantity="10")
    await _issue_stock(client, admin_token, product_id=int(data["product_id"]), bin_id=int(data["bin_id"]), quantity="3")

    recompute = await client.post(
        "/api/abc-classifications/recompute",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "date_from": (datetime.now(UTC).date()).isoformat(),
            "date_to": (datetime.now(UTC).date()).isoformat(),
        },
    )
    assert recompute.status_code == 200
    run_id = recompute.json()["id"]

    listing = await client.get(
        f"/api/abc-classifications?run_id={run_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listing.status_code == 200
    payload = listing.json()
    assert payload["run"]["id"] == run_id
    assert len(payload["items"]) >= 1
