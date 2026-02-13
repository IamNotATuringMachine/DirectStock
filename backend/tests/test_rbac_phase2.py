from datetime import UTC, datetime
from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].lower()


async def _create_and_login_user(client: AsyncClient, admin_token: str, role: str) -> str:
    username = f"{role}-{_suffix()}"
    create = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": username,
            "email": f"{username}@example.com",
            "full_name": f"{role} user",
            "password": "RolePass123!",
            "roles": [role],
            "is_active": True,
        },
    )
    assert create.status_code == 201

    login = await client.post(
        "/api/auth/login",
        json={"username": username, "password": "RolePass123!"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


@pytest.mark.asyncio
async def test_reports_and_purchasing_rbac_matrix(client: AsyncClient, admin_token: str):
    controller_token = await _create_and_login_user(client, admin_token, "controller")
    worker_token = await _create_and_login_user(client, admin_token, "lagermitarbeiter")
    einkauf_token = await _create_and_login_user(client, admin_token, "einkauf")

    today = datetime.now(UTC).date().isoformat()

    reports_controller = await client.get(
        f"/api/reports/kpis?date_from={today}&date_to={today}",
        headers={"Authorization": f"Bearer {controller_token}"},
    )
    assert reports_controller.status_code == 200

    reports_worker = await client.get(
        f"/api/reports/kpis?date_from={today}&date_to={today}",
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert reports_worker.status_code == 403

    po_controller = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"notes": "controller should be denied"},
    )
    assert po_controller.status_code == 403
    po_list_controller = await client.get(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {controller_token}"},
    )
    assert po_list_controller.status_code == 403

    po_einkauf = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {einkauf_token}"},
        json={"notes": "einkauf allowed"},
    )
    assert po_einkauf.status_code == 201

    po_list_worker = await client.get(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert po_list_worker.status_code == 403


@pytest.mark.asyncio
async def test_alerts_rbac_for_versand(client: AsyncClient, admin_token: str):
    versand_token = await _create_and_login_user(client, admin_token, "versand")

    alerts_list = await client.get(
        "/api/alerts",
        headers={"Authorization": f"Bearer {versand_token}"},
    )
    assert alerts_list.status_code == 200

    create_rule = await client.post(
        "/api/alert-rules",
        headers={"Authorization": f"Bearer {versand_token}"},
        json={
            "name": f"versand-rule-{_suffix()}",
            "rule_type": "zero_stock",
            "severity": "medium",
            "is_active": True,
        },
    )
    assert create_rule.status_code == 403


@pytest.mark.asyncio
async def test_operations_role_matrix_for_einkauf_and_versand(client: AsyncClient, admin_token: str):
    einkauf_token = await _create_and_login_user(client, admin_token, "einkauf")
    versand_token = await _create_and_login_user(client, admin_token, "versand")

    receipt_by_einkauf = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {einkauf_token}"},
        json={"notes": "rbac-einkauf-we"},
    )
    assert receipt_by_einkauf.status_code == 201

    receipt_by_versand = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {versand_token}"},
        json={"notes": "rbac-versand-we"},
    )
    assert receipt_by_versand.status_code == 403

    issue_by_versand = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {versand_token}"},
        json={"notes": "rbac-versand-wa"},
    )
    assert issue_by_versand.status_code == 201

    issue_by_einkauf = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {einkauf_token}"},
        json={"notes": "rbac-einkauf-wa"},
    )
    assert issue_by_einkauf.status_code == 403


@pytest.mark.asyncio
async def test_master_data_and_inventory_count_rbac_matrix(client: AsyncClient, admin_token: str):
    controller_token = await _create_and_login_user(client, admin_token, "controller")
    einkauf_token = await _create_and_login_user(client, admin_token, "einkauf")
    versand_token = await _create_and_login_user(client, admin_token, "versand")
    worker_token = await _create_and_login_user(client, admin_token, "lagermitarbeiter")

    suppliers_by_controller = await client.get(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {controller_token}"},
    )
    assert suppliers_by_controller.status_code == 403

    suppliers_by_einkauf = await client.get(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {einkauf_token}"},
    )
    assert suppliers_by_einkauf.status_code == 200

    customers_by_versand = await client.get(
        "/api/customers",
        headers={"Authorization": f"Bearer {versand_token}"},
    )
    assert customers_by_versand.status_code == 200

    customers_by_einkauf = await client.get(
        "/api/customers",
        headers={"Authorization": f"Bearer {einkauf_token}"},
    )
    assert customers_by_einkauf.status_code == 403

    warehouse_settings_by_einkauf = await client.get(
        "/api/products/999999/warehouse-settings",
        headers={"Authorization": f"Bearer {einkauf_token}"},
    )
    assert warehouse_settings_by_einkauf.status_code == 404

    warehouse_settings_by_versand = await client.get(
        "/api/products/999999/warehouse-settings",
        headers={"Authorization": f"Bearer {versand_token}"},
    )
    assert warehouse_settings_by_versand.status_code == 403

    inventory_counts_by_worker = await client.get(
        "/api/inventory-counts",
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert inventory_counts_by_worker.status_code == 200

    inventory_counts_by_versand = await client.get(
        "/api/inventory-counts",
        headers={"Authorization": f"Bearer {versand_token}"},
    )
    assert inventory_counts_by_versand.status_code == 403
