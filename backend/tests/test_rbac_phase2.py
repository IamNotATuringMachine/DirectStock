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


async def _create_warehouse(client: AsyncClient, token: str, code_prefix: str) -> int:
    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {token}"},
        json={"code": f"{code_prefix.upper()}-{_suffix()}", "name": f"Warehouse {code_prefix}", "is_active": True},
    )
    assert warehouse.status_code == 201
    return int(warehouse.json()["id"])


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
async def test_returns_rbac_matrix_keeps_phase2_read_parity(client: AsyncClient, admin_token: str):
    controller_token = await _create_and_login_user(client, admin_token, "controller")
    auditor_token = await _create_and_login_user(client, admin_token, "auditor")
    versand_token = await _create_and_login_user(client, admin_token, "versand")

    seed_order = await client.post(
        "/api/return-orders",
        headers={"Authorization": f"Bearer {versand_token}"},
        json={"notes": "seed return order for read matrix"},
    )
    assert seed_order.status_code == 201

    returns_by_controller = await client.get(
        "/api/return-orders",
        headers={"Authorization": f"Bearer {controller_token}"},
    )
    assert returns_by_controller.status_code == 200

    returns_by_auditor = await client.get(
        "/api/return-orders",
        headers={"Authorization": f"Bearer {auditor_token}"},
    )
    assert returns_by_auditor.status_code == 200

    create_by_controller = await client.post(
        "/api/return-orders",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"notes": "controller should not create returns"},
    )
    assert create_by_controller.status_code == 403

    create_by_auditor = await client.post(
        "/api/return-orders",
        headers={"Authorization": f"Bearer {auditor_token}"},
        json={"notes": "auditor should not create returns"},
    )
    assert create_by_auditor.status_code == 403


@pytest.mark.asyncio
async def test_alerts_rbac_for_read_and_write_matrix(client: AsyncClient, admin_token: str):
    versand_token = await _create_and_login_user(client, admin_token, "versand")
    einkauf_token = await _create_and_login_user(client, admin_token, "einkauf")
    controller_token = await _create_and_login_user(client, admin_token, "controller")

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

    create_rule_einkauf = await client.post(
        "/api/alert-rules",
        headers={"Authorization": f"Bearer {einkauf_token}"},
        json={
            "name": f"einkauf-rule-{_suffix()}",
            "rule_type": "zero_stock",
            "severity": "medium",
            "is_active": True,
        },
    )
    assert create_rule_einkauf.status_code == 201

    create_rule_controller = await client.post(
        "/api/alert-rules",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={
            "name": f"controller-rule-{_suffix()}",
            "rule_type": "low_stock",
            "severity": "high",
            "is_active": True,
            "threshold_quantity": "2",
        },
    )
    assert create_rule_controller.status_code == 201


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
    lagerleiter_token = await _create_and_login_user(client, admin_token, "lagerleiter")

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

    warehouse_id = await _create_warehouse(client, admin_token, "ic-rbac")

    create_count_by_worker = await client.post(
        "/api/inventory-counts",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={
            "session_type": "snapshot",
            "warehouse_id": warehouse_id,
        },
    )
    assert create_count_by_worker.status_code == 201
    session_id = create_count_by_worker.json()["id"]

    create_count_by_versand = await client.post(
        "/api/inventory-counts",
        headers={"Authorization": f"Bearer {versand_token}"},
        json={
            "session_type": "snapshot",
            "warehouse_id": warehouse_id,
        },
    )
    assert create_count_by_versand.status_code == 403

    cancel_by_worker = await client.post(
        f"/api/inventory-counts/{session_id}/cancel",
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert cancel_by_worker.status_code == 403

    cancel_by_lagerleiter = await client.post(
        f"/api/inventory-counts/{session_id}/cancel",
        headers={"Authorization": f"Bearer {lagerleiter_token}"},
    )
    assert cancel_by_lagerleiter.status_code == 200


@pytest.mark.asyncio
async def test_picking_rbac_matrix_allows_versand_write(client: AsyncClient, admin_token: str):
    versand_token = await _create_and_login_user(client, admin_token, "versand")
    controller_token = await _create_and_login_user(client, admin_token, "controller")

    goods_issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": "wave3b-rbac"},
    )
    assert goods_issue.status_code == 201
    goods_issue_id = goods_issue.json()["id"]

    create_wave_by_versand = await client.post(
        "/api/pick-waves",
        headers={"Authorization": f"Bearer {versand_token}"},
        json={"goods_issue_ids": [goods_issue_id]},
    )
    assert create_wave_by_versand.status_code == 201

    create_wave_by_controller = await client.post(
        "/api/pick-waves",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"goods_issue_ids": [goods_issue_id]},
    )
    assert create_wave_by_controller.status_code == 403


@pytest.mark.asyncio
async def test_workflows_rbac_matrix_rules_and_approvals(client: AsyncClient, admin_token: str):
    worker_token = await _create_and_login_user(client, admin_token, "lagermitarbeiter")
    auditor_token = await _create_and_login_user(client, admin_token, "auditor")
    controller_token = await _create_and_login_user(client, admin_token, "controller")
    einkauf_token = await _create_and_login_user(client, admin_token, "einkauf")
    versand_token = await _create_and_login_user(client, admin_token, "versand")
    lagerleiter_token = await _create_and_login_user(client, admin_token, "lagerleiter")

    list_rules_by_auditor = await client.get(
        "/api/approval-rules",
        headers={"Authorization": f"Bearer {auditor_token}"},
    )
    assert list_rules_by_auditor.status_code == 200

    create_rule_by_worker = await client.post(
        "/api/approval-rules",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={
            "name": f"worker-rule-{_suffix()}",
            "entity_type": "purchase_order",
            "required_role": "lagerleiter",
            "is_active": True,
        },
    )
    assert create_rule_by_worker.status_code == 403

    create_rule_by_lagerleiter = await client.post(
        "/api/approval-rules",
        headers={"Authorization": f"Bearer {lagerleiter_token}"},
        json={
            "name": f"lagerleiter-rule-{_suffix()}",
            "entity_type": "purchase_order",
            "required_role": "lagerleiter",
            "is_active": True,
        },
    )
    assert create_rule_by_lagerleiter.status_code == 201

    list_approvals_by_controller = await client.get(
        "/api/approvals",
        headers={"Authorization": f"Bearer {controller_token}"},
    )
    assert list_approvals_by_controller.status_code == 200

    create_approval_by_controller = await client.post(
        "/api/approvals",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"entity_type": "purchase_order", "entity_id": 1001, "amount": "11.00"},
    )
    assert create_approval_by_controller.status_code == 403

    create_approval_by_versand = await client.post(
        "/api/approvals",
        headers={"Authorization": f"Bearer {versand_token}"},
        json={"entity_type": "purchase_order", "entity_id": 1002, "amount": "12.00"},
    )
    assert create_approval_by_versand.status_code == 201
    request_id = int(create_approval_by_versand.json()["id"])

    create_approval_by_einkauf = await client.post(
        "/api/approvals",
        headers={"Authorization": f"Bearer {einkauf_token}"},
        json={"entity_type": "purchase_order", "entity_id": 1003, "amount": "13.00"},
    )
    assert create_approval_by_einkauf.status_code == 201

    list_approvals_by_auditor = await client.get(
        "/api/approvals",
        headers={"Authorization": f"Bearer {auditor_token}"},
    )
    assert list_approvals_by_auditor.status_code == 200

    approve_by_versand = await client.post(
        f"/api/approvals/{request_id}/approve",
        headers={"Authorization": f"Bearer {versand_token}"},
        json={"comment": "should fail required_role"},
    )
    assert approve_by_versand.status_code == 403

    approve_by_lagerleiter = await client.post(
        f"/api/approvals/{request_id}/approve",
        headers={"Authorization": f"Bearer {lagerleiter_token}"},
        json={"comment": "allowed by required_role"},
    )
    assert approve_by_lagerleiter.status_code == 200


@pytest.mark.asyncio
async def test_inter_warehouse_transfer_rbac_matrix(client: AsyncClient, admin_token: str):
    worker_token = await _create_and_login_user(client, admin_token, "lagermitarbeiter")
    auditor_token = await _create_and_login_user(client, admin_token, "auditor")

    source_warehouse_id = await _create_warehouse(client, admin_token, "iwt-src")
    target_warehouse_id = await _create_warehouse(client, admin_token, "iwt-tgt")

    read_by_auditor = await client.get(
        "/api/inter-warehouse-transfers",
        headers={"Authorization": f"Bearer {auditor_token}"},
    )
    assert read_by_auditor.status_code == 200

    create_by_auditor = await client.post(
        "/api/inter-warehouse-transfers",
        headers={"Authorization": f"Bearer {auditor_token}"},
        json={
            "from_warehouse_id": source_warehouse_id,
            "to_warehouse_id": target_warehouse_id,
            "notes": "auditor should be denied",
        },
    )
    assert create_by_auditor.status_code == 403

    create_by_worker = await client.post(
        "/api/inter-warehouse-transfers",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={
            "from_warehouse_id": source_warehouse_id,
            "to_warehouse_id": target_warehouse_id,
            "notes": "worker allowed",
        },
    )
    assert create_by_worker.status_code == 201


@pytest.mark.asyncio
async def test_wave3c_remaining_router_rbac_matrix(client: AsyncClient, admin_token: str):
    controller_token = await _create_and_login_user(client, admin_token, "controller")
    auditor_token = await _create_and_login_user(client, admin_token, "auditor")
    einkauf_token = await _create_and_login_user(client, admin_token, "einkauf")

    recommendations_by_controller = await client.get(
        "/api/purchase-recommendations",
        headers={"Authorization": f"Bearer {controller_token}"},
    )
    assert recommendations_by_controller.status_code == 200

    generate_by_controller = await client.post(
        "/api/purchase-recommendations/generate",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={},
    )
    assert generate_by_controller.status_code == 403

    generate_by_einkauf = await client.post(
        "/api/purchase-recommendations/generate",
        headers={"Authorization": f"Bearer {einkauf_token}"},
        json={},
    )
    assert generate_by_einkauf.status_code == 200

    product_settings_by_einkauf = await client.get(
        "/api/products/999999/warehouse-settings",
        headers={"Authorization": f"Bearer {einkauf_token}"},
    )
    assert product_settings_by_einkauf.status_code == 404

    product_settings_write_by_einkauf = await client.put(
        "/api/products/999999/warehouse-settings/999999",
        headers={"Authorization": f"Bearer {einkauf_token}"},
        json={"min_stock": "1"},
    )
    assert product_settings_write_by_einkauf.status_code == 404

    product_settings_by_controller = await client.get(
        "/api/products/999999/warehouse-settings",
        headers={"Authorization": f"Bearer {controller_token}"},
    )
    assert product_settings_by_controller.status_code == 403

    product_settings_write_by_controller = await client.put(
        "/api/products/999999/warehouse-settings/999999",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"min_stock": "1"},
    )
    assert product_settings_write_by_controller.status_code == 403

    today = datetime.now(UTC).date().isoformat()
    abc_recompute_by_einkauf = await client.post(
        "/api/abc-classifications/recompute",
        headers={"Authorization": f"Bearer {einkauf_token}"},
        json={"date_from": today, "date_to": today},
    )
    assert abc_recompute_by_einkauf.status_code == 200
    run_id = abc_recompute_by_einkauf.json()["id"]

    abc_list_by_auditor = await client.get(
        f"/api/abc-classifications?run_id={run_id}",
        headers={"Authorization": f"Bearer {auditor_token}"},
    )
    assert abc_list_by_auditor.status_code == 200

    abc_recompute_by_controller = await client.post(
        "/api/abc-classifications/recompute",
        headers={"Authorization": f"Bearer {controller_token}"},
        json={"date_from": today, "date_to": today},
    )
    assert abc_recompute_by_controller.status_code == 403

    audit_log_by_auditor = await client.get(
        "/api/audit-log?page=1&page_size=10",
        headers={"Authorization": f"Bearer {auditor_token}"},
    )
    assert audit_log_by_auditor.status_code == 200

    audit_log_by_einkauf = await client.get(
        "/api/audit-log?page=1&page_size=10",
        headers={"Authorization": f"Bearer {einkauf_token}"},
    )
    assert audit_log_by_einkauf.status_code == 403
