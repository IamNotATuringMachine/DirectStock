from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].lower()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_operators_crud_unlock_and_settings(client: AsyncClient, admin_token: str):
    create = await client.post(
        "/api/operators",
        headers=_auth(admin_token),
        json={
            "display_name": f"Operator-{_suffix()}",
            "pin": "1234",
            "pin_enabled": True,
        },
    )
    assert create.status_code == 201
    operator = create.json()
    assert operator["pin_enabled"] is True
    assert operator["has_pin"] is True

    listed = await client.get("/api/operators", headers=_auth(admin_token))
    assert listed.status_code == 200
    assert any(row["id"] == operator["id"] for row in listed.json())

    unlock = await client.post(
        "/api/operators/unlock",
        headers=_auth(admin_token),
        json={"pin": "1234"},
    )
    assert unlock.status_code == 200
    unlock_payload = unlock.json()
    assert unlock_payload["operator_id"] == operator["id"]
    assert isinstance(unlock_payload["session_token"], str) and unlock_payload["session_token"]

    get_settings = await client.get("/api/operators/signoff-settings", headers=_auth(admin_token))
    assert get_settings.status_code == 200
    settings = get_settings.json()
    assert isinstance(settings["require_pin"], bool)
    assert isinstance(settings["require_operator_selection"], bool)

    update_settings = await client.put(
        "/api/operators/signoff-settings",
        headers=_auth(admin_token),
        json={"require_pin": True, "require_operator_selection": False, "pin_session_ttl_minutes": 60},
    )
    assert update_settings.status_code == 200
    assert update_settings.json()["require_pin"] is True
    assert update_settings.json()["require_operator_selection"] is False

    renamed = await client.put(
        f"/api/operators/{operator['id']}",
        headers=_auth(admin_token),
        json={"display_name": f"Renamed-{_suffix()}"},
    )
    assert renamed.status_code == 200

    deleted = await client.delete(f"/api/operators/{operator['id']}", headers=_auth(admin_token))
    assert deleted.status_code == 200
