import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "change-me-admin-password"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_failure(client: AsyncClient):
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_login_success_with_email_identifier(client: AsyncClient, admin_token: str):
    create_user = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "testuser",
            "email": "testuser@test.de",
            "full_name": "Test User",
            "password": "passwort",
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert create_user.status_code == 201

    response = await client.post(
        "/api/auth/login",
        json={"username": "testuser@test.de", "password": "passwort"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_success(client: AsyncClient):
    login = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "change-me-admin-password"},
    )
    refresh_token = login.json()["refresh_token"]

    refresh = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh.status_code == 200
    assert refresh.json()["access_token"]


@pytest.mark.asyncio
async def test_refresh_failure(client: AsyncClient):
    refresh = await client.post("/api/auth/refresh", json={"refresh_token": "invalid"})
    assert refresh.status_code == 401


@pytest.mark.asyncio
async def test_me(client: AsyncClient, admin_token: str):
    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "admin"
    assert "admin" in data["roles"]


@pytest.mark.asyncio
async def test_logout_revokes_tokens(client: AsyncClient):
    login = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "change-me-admin-password"},
    )
    access_token = login.json()["access_token"]
    refresh_token = login.json()["refresh_token"]

    logout = await client.post("/api/auth/logout", headers={"Authorization": f"Bearer {access_token}"})
    assert logout.status_code == 200

    refresh = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh.status_code == 401


@pytest.mark.asyncio
async def test_me_uses_user_permission_overrides(client: AsyncClient, admin_token: str):
    username = "auth-override-user"
    password = "AuthOverride123!"

    created_user = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": username,
            "email": f"{username}@example.com",
            "full_name": "Auth Override User",
            "password": password,
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert created_user.status_code == 201
    user_id = created_user.json()["id"]

    update_profile = await client.put(
        f"/api/users/{user_id}/access-profile",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "roles": ["lagermitarbeiter"],
            "allow_permissions": [],
            "deny_permissions": ["page.dashboard.view"],
        },
    )
    assert update_profile.status_code == 200

    login_user = await client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert login_user.status_code == 200
    user_token = login_user.json()["access_token"]

    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    assert me.status_code == 200
    assert "page.dashboard.view" not in me.json()["permissions"]
