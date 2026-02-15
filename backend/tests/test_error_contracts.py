import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_401_error_contract_contains_api_error_fields(client: AsyncClient):
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong-password"},
    )

    assert response.status_code == 401
    payload = response.json()

    assert payload["code"] == "unauthenticated"
    assert isinstance(payload["message"], str)
    assert payload["message"]
    assert isinstance(payload["request_id"], str)
    assert payload["request_id"]
    assert "details" in payload
    assert payload["details"] is None
    assert response.headers.get("x-request-id") == payload["request_id"]


@pytest.mark.asyncio
async def test_validation_422_error_contract_contains_api_error_fields(client: AsyncClient):
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin"},
    )

    assert response.status_code == 422
    payload = response.json()

    assert payload["code"] == "validation_error"
    assert payload["message"] == "Request validation failed"
    assert isinstance(payload["request_id"], str)
    assert payload["request_id"]
    assert isinstance(payload["details"], list)
    assert response.headers.get("x-request-id") == payload["request_id"]

    missing_password = any(
        isinstance(entry, dict) and "password" in entry.get("loc", [])
        for entry in payload["details"]
    )
    assert missing_password
