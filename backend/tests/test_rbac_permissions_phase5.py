from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.phase5_utils import auth_headers, suffix


@pytest.mark.asyncio
async def test_auth_me_includes_permissions(client: AsyncClient, admin_token: str):
    response = await client.get("/api/auth/me", headers=auth_headers(admin_token))
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload.get("permissions"), list)
    assert "module.roles.manage" in payload["permissions"]


@pytest.mark.asyncio
async def test_roles_permissions_and_pages_flow(client: AsyncClient, admin_token: str):
    invalid = await client.post(
        "/api/roles",
        headers=auth_headers(admin_token),
        json={
            "name": f"phase5-invalid-{suffix().lower()}",
            "description": "invalid",
            "permission_codes": ["module.unknown.permission"],
        },
    )
    assert invalid.status_code == 422

    role_name = f"phase5-role-{suffix().lower()}"
    create_role = await client.post(
        "/api/roles",
        headers=auth_headers(admin_token),
        json={
            "name": role_name,
            "description": "phase5 role",
            "permission_codes": ["module.pages.read"],
        },
    )
    assert create_role.status_code == 201
    role_id = create_role.json()["id"]

    create_user = await client.post(
        "/api/users",
        headers=auth_headers(admin_token),
        json={
            "username": f"phase5_user_{suffix().lower()}",
            "email": f"phase5-{suffix().lower()}@example.com",
            "full_name": "Phase5 RBAC User",
            "password": "Phase5User123!",
            "roles": [role_name],
            "is_active": True,
        },
    )
    assert create_user.status_code == 201

    login = await client.post(
        "/api/auth/login",
        json={"username": create_user.json()["username"], "password": "Phase5User123!"},
    )
    assert login.status_code == 200
    user_token = login.json()["access_token"]

    pages_for_user = await client.get("/api/pages", headers=auth_headers(user_token))
    assert pages_for_user.status_code == 200
    assert any(page["slug"] == "dashboard" for page in pages_for_user.json())

    roles_for_user = await client.get("/api/roles", headers=auth_headers(user_token))
    assert roles_for_user.status_code == 403

    permissions_for_user = await client.get("/api/permissions", headers=auth_headers(user_token))
    assert permissions_for_user.status_code == 403

    grant_permissions = await client.put(
        f"/api/roles/{role_id}/permissions",
        headers=auth_headers(admin_token),
        json={"permission_codes": ["module.pages.read", "module.permissions.read"]},
    )
    assert grant_permissions.status_code == 200

    permissions_after_grant = await client.get("/api/permissions", headers=auth_headers(user_token))
    assert permissions_after_grant.status_code == 200
    assert any(row["code"] == "module.permissions.read" for row in permissions_after_grant.json())

