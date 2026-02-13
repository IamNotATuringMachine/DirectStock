from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


@pytest.mark.asyncio
async def test_approval_rule_and_request_flow(client: AsyncClient, admin_token: str):
    name = f"rule-{_suffix()}"
    create_rule = await client.post(
        "/api/approval-rules",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": name,
            "entity_type": "purchase_order",
            "min_amount": "10",
            "required_role": "lagerleiter",
            "is_active": True,
        },
    )
    assert create_rule.status_code == 201

    request = await client.post(
        "/api/approvals",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "entity_type": "purchase_order",
            "entity_id": 123,
            "amount": "99.99",
            "reason": "test",
        },
    )
    assert request.status_code == 201
    request_id = request.json()["id"]

    approve = await client.post(
        f"/api/approvals/{request_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"comment": "ok"},
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"
