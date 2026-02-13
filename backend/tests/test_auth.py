import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "DirectStock2026!"},
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
async def test_refresh_success(client: AsyncClient):
    login = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "DirectStock2026!"},
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
        json={"username": "admin", "password": "DirectStock2026!"},
    )
    access_token = login.json()["access_token"]
    refresh_token = login.json()["refresh_token"]

    logout = await client.post("/api/auth/logout", headers={"Authorization": f"Bearer {access_token}"})
    assert logout.status_code == 200

    refresh = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh.status_code == 401
