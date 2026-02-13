from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8]


async def _create_integration_client(client: AsyncClient, admin_token: str, *, scopes: list[str]):
    response = await client.post(
        "/api/integration-clients",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": f"ci-{_suffix()}",
            "client_id": f"cid-{_suffix()}",
            "scopes": scopes,
            "token_ttl_minutes": 30,
            "is_active": True,
        },
    )
    assert response.status_code == 201
    payload = response.json()
    return payload["client"]["client_id"], payload["client_secret"]


@pytest.mark.asyncio
async def test_external_token_flow_and_scope_validation(client: AsyncClient, admin_token: str):
    client_id, client_secret = await _create_integration_client(
        client,
        admin_token,
        scopes=["products:read", "warehouses:read"],
    )

    invalid = await client.post(
        "/api/external/token",
        json={"client_id": client_id, "client_secret": "wrong-secret"},
    )
    assert invalid.status_code == 401

    invalid_scope = await client.post(
        "/api/external/token",
        json={"client_id": client_id, "client_secret": client_secret, "scope": "inventory:read"},
    )
    assert invalid_scope.status_code == 403

    token_response = await client.post(
        "/api/external/token",
        json={"client_id": client_id, "client_secret": client_secret, "scope": "products:read"},
    )
    assert token_response.status_code == 200
    token_payload = token_response.json()
    assert token_payload["token_type"] == "bearer"
    assert token_payload["scope"] == "products:read"

    me = await client.get(
        "/api/external/v1/me",
        headers={"Authorization": f"Bearer {token_payload['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["client_id"] == client_id


@pytest.mark.asyncio
async def test_external_scope_denied_for_ungranted_endpoint(client: AsyncClient, admin_token: str):
    client_id, client_secret = await _create_integration_client(
        client,
        admin_token,
        scopes=["products:read"],
    )

    token_response = await client.post(
        "/api/external/token",
        json={"client_id": client_id, "client_secret": client_secret, "scope": "products:read"},
    )
    assert token_response.status_code == 200
    access_token = token_response.json()["access_token"]

    denied = await client.get(
        "/api/external/v1/warehouses",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert denied.status_code == 403
