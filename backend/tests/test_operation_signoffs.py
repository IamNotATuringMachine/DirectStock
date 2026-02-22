from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].lower()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_and_login_user(client: AsyncClient, admin_token: str, role: str) -> str:
    username = f"{role}-{_suffix()}"
    created = await client.post(
        "/api/users",
        headers=_auth(admin_token),
        json={
            "username": username,
            "email": f"{username}@example.com",
            "full_name": f"{role} user",
            "password": "RolePass123!",
            "roles": [role],
            "is_active": True,
        },
    )
    assert created.status_code == 201

    login = await client.post(
        "/api/auth/login",
        json={"username": username, "password": "RolePass123!"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    group = await client.post(
        "/api/product-groups",
        headers=_auth(admin_token),
        json={"name": f"{prefix}-GROUP", "description": "Signoff group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers=_auth(admin_token),
        json={
            "product_number": f"{prefix}-ART-001",
            "name": f"{prefix} Product",
            "description": "Signoff product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201

    warehouse = await client.post(
        "/api/warehouses",
        headers=_auth(admin_token),
        json={"code": f"{prefix}-WH", "name": f"Warehouse {prefix}", "address": "Test", "is_active": True},
    )
    assert warehouse.status_code == 201

    zone = await client.post(
        f"/api/warehouses/{warehouse.json()['id']}/zones",
        headers=_auth(admin_token),
        json={"code": f"{prefix}-Z", "name": "Zone", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201

    source_bin = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers=_auth(admin_token),
        json={"code": f"{prefix}-BIN-A", "bin_type": "storage", "is_active": True},
    )
    assert source_bin.status_code == 201

    target_bin = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers=_auth(admin_token),
        json={"code": f"{prefix}-BIN-B", "bin_type": "storage", "is_active": True},
    )
    assert target_bin.status_code == 201

    return {
        "product_id": int(product.json()["id"]),
        "source_bin_id": int(source_bin.json()["id"]),
        "target_bin_id": int(target_bin.json()["id"]),
    }


async def _receive_stock(
    client: AsyncClient,
    admin_token: str,
    *,
    product_id: int,
    bin_id: int,
    quantity: str,
) -> None:
    receipt = await client.post("/api/goods-receipts", headers=_auth(admin_token), json={})
    assert receipt.status_code == 201

    item = await client.post(
        f"/api/goods-receipts/{receipt.json()['id']}/items",
        headers=_auth(admin_token),
        json={
            "product_id": product_id,
            "received_quantity": quantity,
            "unit": "piece",
            "target_bin_id": bin_id,
        },
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt.json()['id']}/complete",
        headers=_auth(admin_token),
    )
    assert complete.status_code == 200


def _signoff_payload(operator_id: int | None = None, token: str | None = None) -> dict:
    payload = {
        "signature_payload": {
            "strokes": [
                {
                    "points": [
                        {"x": 10, "y": 12, "t": 1},
                        {"x": 40, "y": 28, "t": 2},
                    ]
                }
            ],
            "canvas_width": 640,
            "canvas_height": 220,
            "captured_at": "2026-02-21T10:00:00Z",
        },
        "device_context": {"device": "tablet-test"},
    }
    if operator_id is not None:
        payload["operator_id"] = operator_id
    if token is not None:
        payload["pin_session_token"] = token
    return payload


@pytest.mark.asyncio
async def test_tablet_goods_receipt_complete_requires_signoff(client: AsyncClient, admin_token: str):
    tablet_token = await _create_and_login_user(client, admin_token, "tablet_ops")
    marker = f"SIGR-{_suffix()}"
    data = await _create_master_data(client, admin_token, marker)

    created_operator = await client.post(
        "/api/operators",
        headers=_auth(admin_token),
        json={"display_name": f"Tablet Operator {marker}"},
    )
    assert created_operator.status_code == 201
    operator_id = created_operator.json()["id"]

    create_receipt = await client.post(
        "/api/goods-receipts",
        headers=_auth(tablet_token),
        json={},
    )
    assert create_receipt.status_code == 201
    receipt_id = create_receipt.json()["id"]

    create_item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers=_auth(tablet_token),
        json={
            "product_id": data["product_id"],
            "received_quantity": "3",
            "unit": "piece",
            "target_bin_id": data["target_bin_id"],
        },
    )
    assert create_item.status_code == 201

    missing_signoff = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers=_auth(tablet_token),
    )
    assert missing_signoff.status_code == 422

    complete = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers=_auth(tablet_token),
        json=_signoff_payload(operator_id),
    )
    assert complete.status_code == 200

    detail = await client.get(f"/api/goods-receipts/{receipt_id}", headers=_auth(tablet_token))
    assert detail.status_code == 200
    assert detail.json()["operation_signoff"]["operator_id"] == operator_id
    assert detail.json()["operation_signoff"]["pin_verified"] is False


@pytest.mark.asyncio
async def test_tablet_goods_issue_pin_required_rejects_invalid_token(client: AsyncClient, admin_token: str):
    tablet_token = await _create_and_login_user(client, admin_token, "tablet_ops")
    marker = f"SIGI-{_suffix()}"
    data = await _create_master_data(client, admin_token, marker)

    settings = await client.put(
        "/api/operators/signoff-settings",
        headers=_auth(admin_token),
        json={"require_pin": True, "require_operator_selection": True, "pin_session_ttl_minutes": 30},
    )
    assert settings.status_code == 200

    operator = await client.post(
        "/api/operators",
        headers=_auth(admin_token),
        json={
            "display_name": f"Pin Operator {marker}",
            "pin": "9876",
            "pin_enabled": True,
        },
    )
    assert operator.status_code == 201
    operator_id = operator.json()["id"]

    await _receive_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["source_bin_id"],
        quantity="6",
    )

    create_issue = await client.post(
        "/api/goods-issues",
        headers=_auth(tablet_token),
        json={},
    )
    assert create_issue.status_code == 201
    issue_id = create_issue.json()["id"]

    create_item = await client.post(
        f"/api/goods-issues/{issue_id}/items",
        headers=_auth(tablet_token),
        json={
            "product_id": data["product_id"],
            "requested_quantity": "2",
            "unit": "piece",
            "source_bin_id": data["source_bin_id"],
        },
    )
    assert create_item.status_code == 201

    invalid_token_complete = await client.post(
        f"/api/goods-issues/{issue_id}/complete",
        headers=_auth(tablet_token),
        json=_signoff_payload(operator_id, token="invalid-token"),
    )
    assert invalid_token_complete.status_code == 409

    unlock = await client.post(
        "/api/operators/unlock",
        headers=_auth(tablet_token),
        json={"pin": "9876"},
    )
    assert unlock.status_code == 200
    pin_token = unlock.json()["session_token"]

    complete = await client.post(
        f"/api/goods-issues/{issue_id}/complete",
        headers=_auth(tablet_token),
        json=_signoff_payload(operator_id, token=pin_token),
    )
    assert complete.status_code == 200

    detail = await client.get(f"/api/goods-issues/{issue_id}", headers=_auth(tablet_token))
    assert detail.status_code == 200
    assert detail.json()["operation_signoff"]["pin_verified"] is True

    reset_settings = await client.put(
        "/api/operators/signoff-settings",
        headers=_auth(admin_token),
        json={"require_pin": False, "require_operator_selection": True, "pin_session_ttl_minutes": 480},
    )
    assert reset_settings.status_code == 200


@pytest.mark.asyncio
async def test_tablet_goods_receipt_complete_without_operator_when_selection_disabled(client: AsyncClient, admin_token: str):
    tablet_token = await _create_and_login_user(client, admin_token, "tablet_ops")
    marker = f"SIGRNO-{_suffix()}"
    data = await _create_master_data(client, admin_token, marker)

    settings = await client.put(
        "/api/operators/signoff-settings",
        headers=_auth(admin_token),
        json={"require_pin": False, "require_operator_selection": False, "pin_session_ttl_minutes": 480},
    )
    assert settings.status_code == 200

    create_receipt = await client.post(
        "/api/goods-receipts",
        headers=_auth(tablet_token),
        json={},
    )
    assert create_receipt.status_code == 201
    receipt_id = create_receipt.json()["id"]

    create_item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers=_auth(tablet_token),
        json={
            "product_id": data["product_id"],
            "received_quantity": "2",
            "unit": "piece",
            "target_bin_id": data["target_bin_id"],
        },
    )
    assert create_item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers=_auth(tablet_token),
        json=_signoff_payload(),
    )
    assert complete.status_code == 200

    detail = await client.get(f"/api/goods-receipts/{receipt_id}", headers=_auth(tablet_token))
    assert detail.status_code == 200
    assert detail.json()["operation_signoff"]["operator_id"] is None

    reset_settings = await client.put(
        "/api/operators/signoff-settings",
        headers=_auth(admin_token),
        json={"require_pin": False, "require_operator_selection": True, "pin_session_ttl_minutes": 480},
    )
    assert reset_settings.status_code == 200
