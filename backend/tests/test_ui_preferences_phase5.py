from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient

from tests.phase5_utils import auth_headers, suffix


@pytest.mark.asyncio
async def test_ui_preferences_get_and_put(client: AsyncClient, admin_token: str):
    initial = await client.get("/api/ui-preferences/me", headers=auth_headers(admin_token))
    assert initial.status_code == 200
    assert initial.json()["theme"] in {"system", "light", "dark"}

    update = await client.put(
        "/api/ui-preferences/me",
        headers=auth_headers(admin_token),
        json={"theme": "dark", "compact_mode": True, "show_help": False},
    )
    assert update.status_code == 200
    assert update.json()["theme"] == "dark"
    assert update.json()["compact_mode"] is True
    assert update.json()["show_help"] is False


@pytest.mark.asyncio
async def test_ui_preferences_parallel_get_is_race_safe(client: AsyncClient, admin_token: str):
    headers = auth_headers(admin_token)

    responses = await asyncio.gather(
        client.get("/api/ui-preferences/me", headers=headers),
        client.get("/api/ui-preferences/me", headers=headers),
        client.get("/api/ui-preferences/me", headers=headers),
    )

    assert all(response.status_code == 200 for response in responses)
    payloads = [response.json() for response in responses]
    assert all(payload["theme"] in {"system", "light", "dark"} for payload in payloads)


@pytest.mark.asyncio
async def test_dashboard_validation_for_unknown_and_locked_cards(client: AsyncClient, admin_token: str):
    unknown = await client.put(
        "/api/dashboard/config/me",
        headers=auth_headers(admin_token),
        json={"cards": [{"card_key": "does-not-exist", "visible": True, "display_order": 1}]},
    )
    assert unknown.status_code == 422

    roles_response = await client.get("/api/roles", headers=auth_headers(admin_token))
    assert roles_response.status_code == 200
    lagermitarbeiter = next(role for role in roles_response.json() if role["name"] == "lagermitarbeiter")

    set_locked_policy = await client.put(
        f"/api/dashboard/config/roles/{lagermitarbeiter['id']}",
        headers=auth_headers(admin_token),
        json={"cards": [{"card_key": "summary", "allowed": True, "default_visible": True, "locked": True}]},
    )
    assert set_locked_policy.status_code == 200

    username = f"phase5_ui_{suffix().lower()}"
    create_user = await client.post(
        "/api/users",
        headers=auth_headers(admin_token),
        json={
            "username": username,
            "email": f"{username}@example.com",
            "full_name": "Phase5 UI User",
            "password": "Phase5Ui123!",
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert create_user.status_code == 201

    login = await client.post("/api/auth/login", json={"username": username, "password": "Phase5Ui123!"})
    assert login.status_code == 200
    user_token = login.json()["access_token"]

    hide_locked = await client.put(
        "/api/dashboard/config/me",
        headers=auth_headers(user_token),
        json={"cards": [{"card_key": "summary", "visible": False, "display_order": 1}]},
    )
    assert hide_locked.status_code == 422
