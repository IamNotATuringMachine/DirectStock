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
    assert "module.services.read" not in payload["permissions"]
    assert "module.services.write" not in payload["permissions"]
    assert "page.services.view" not in payload["permissions"]


@pytest.mark.asyncio
async def test_roles_permissions_and_pages_flow(client: AsyncClient, admin_token: str):
    removed_route = await client.get("/api/services", headers=auth_headers(admin_token))
    assert removed_route.status_code == 404

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
    assert all(page["slug"] != "services" for page in pages_for_user.json())

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

    deny_with_override = await client.put(
        f"/api/users/{create_user.json()['id']}/access-profile",
        headers=auth_headers(admin_token),
        json={
            "roles": [role_name],
            "allow_permissions": [],
            "deny_permissions": ["module.permissions.read"],
        },
    )
    assert deny_with_override.status_code == 200

    permissions_after_deny = await client.get("/api/permissions", headers=auth_headers(user_token))
    assert permissions_after_deny.status_code == 403

    allow_back_with_override = await client.put(
        f"/api/users/{create_user.json()['id']}/access-profile",
        headers=auth_headers(admin_token),
        json={
            "roles": [role_name],
            "allow_permissions": ["module.permissions.read"],
            "deny_permissions": [],
        },
    )
    assert allow_back_with_override.status_code == 200

    permissions_after_allow = await client.get("/api/permissions", headers=auth_headers(user_token))
    assert permissions_after_allow.status_code == 200


@pytest.mark.asyncio
async def test_goods_receipt_permissions_can_be_granted_without_any_role(client: AsyncClient, admin_token: str):
    username = f"phase5-norole-{suffix().lower()}"
    created = await client.post(
        "/api/users",
        headers=auth_headers(admin_token),
        json={
            "username": username,
            "email": f"{username}@example.com",
            "full_name": "No role WE user",
            "password": "Phase5User123!",
            "roles": [],
            "is_active": True,
        },
    )
    assert created.status_code == 201
    user_id = created.json()["id"]

    login = await client.post(
        "/api/auth/login",
        json={"username": username, "password": "Phase5User123!"},
    )
    assert login.status_code == 200
    user_token = login.json()["access_token"]

    denied_without_permissions = await client.post(
        "/api/goods-receipts",
        headers=auth_headers(user_token),
        json={"notes": "no role no permissions"},
    )
    assert denied_without_permissions.status_code == 403

    grant_permissions = await client.put(
        f"/api/users/{user_id}/access-profile",
        headers=auth_headers(admin_token),
        json={
            "roles": [],
            "allow_permissions": [
                "page.goods-receipt.view",
                "module.goods_receipts.read",
                "module.goods_receipts.write",
            ],
            "deny_permissions": [],
        },
    )
    assert grant_permissions.status_code == 200

    created_receipt = await client.post(
        "/api/goods-receipts",
        headers=auth_headers(user_token),
        json={"notes": "no role with granted permissions"},
    )
    assert created_receipt.status_code == 201

    listed_receipts = await client.get(
        "/api/goods-receipts",
        headers=auth_headers(user_token),
    )
    assert listed_receipts.status_code == 200


@pytest.mark.asyncio
async def test_returns_purchasing_and_warehouse_permissions_can_be_granted_without_any_role(
    client: AsyncClient,
    admin_token: str,
):
    username = f"phase5-wave3a-{suffix().lower()}"
    created = await client.post(
        "/api/users",
        headers=auth_headers(admin_token),
        json={
            "username": username,
            "email": f"{username}@example.com",
            "full_name": "No role Wave3A user",
            "password": "Phase5User123!",
            "roles": [],
            "is_active": True,
        },
    )
    assert created.status_code == 201
    user_id = created.json()["id"]

    login = await client.post(
        "/api/auth/login",
        json={"username": username, "password": "Phase5User123!"},
    )
    assert login.status_code == 200
    user_token = login.json()["access_token"]
    headers = auth_headers(user_token)

    denied_po_read = await client.get("/api/purchase-orders", headers=headers)
    assert denied_po_read.status_code == 403
    denied_po_write = await client.post("/api/purchase-orders", headers=headers, json={"notes": "denied"})
    assert denied_po_write.status_code == 403

    denied_returns_read = await client.get("/api/return-orders", headers=headers)
    assert denied_returns_read.status_code == 403
    denied_returns_write = await client.post("/api/return-orders", headers=headers, json={"notes": "denied"})
    assert denied_returns_write.status_code == 403

    denied_warehouse_write = await client.post(
        "/api/warehouses",
        headers=headers,
        json={"code": f"W3A-DENIED-{suffix().lower()}", "name": "Denied Warehouse", "is_active": True},
    )
    assert denied_warehouse_write.status_code == 403

    grant_permissions = await client.put(
        f"/api/users/{user_id}/access-profile",
        headers=auth_headers(admin_token),
        json={
            "roles": [],
            "allow_permissions": [
                "module.purchasing.read",
                "module.purchasing.write",
                "module.returns.read",
                "module.returns.write",
                "module.warehouses.write",
            ],
            "deny_permissions": [],
        },
    )
    assert grant_permissions.status_code == 200

    allowed_po_read = await client.get("/api/purchase-orders", headers=headers)
    assert allowed_po_read.status_code == 200
    allowed_po_write = await client.post("/api/purchase-orders", headers=headers, json={"notes": "allowed"})
    assert allowed_po_write.status_code == 201

    allowed_returns_read = await client.get("/api/return-orders", headers=headers)
    assert allowed_returns_read.status_code == 200
    allowed_returns_write = await client.post("/api/return-orders", headers=headers, json={"notes": "allowed"})
    assert allowed_returns_write.status_code == 201

    allowed_warehouse_write = await client.post(
        "/api/warehouses",
        headers=headers,
        json={"code": f"W3A-ALLOW-{suffix().lower()}", "name": "Allowed Warehouse", "is_active": True},
    )
    assert allowed_warehouse_write.status_code == 201


@pytest.mark.asyncio
async def test_wave3b_permissions_can_be_granted_without_any_role(client: AsyncClient, admin_token: str):
    username = f"phase5-wave3b-{suffix().lower()}"
    created = await client.post(
        "/api/users",
        headers=auth_headers(admin_token),
        json={
            "username": username,
            "email": f"{username}@example.com",
            "full_name": "No role Wave3B user",
            "password": "Phase5User123!",
            "roles": [],
            "is_active": True,
        },
    )
    assert created.status_code == 201
    user_id = int(created.json()["id"])

    source_warehouse = await client.post(
        "/api/warehouses",
        headers=auth_headers(admin_token),
        json={"code": f"W3B-SRC-{suffix().lower()}", "name": "Wave3B Source", "is_active": True},
    )
    assert source_warehouse.status_code == 201
    source_warehouse_id = int(source_warehouse.json()["id"])

    target_warehouse = await client.post(
        "/api/warehouses",
        headers=auth_headers(admin_token),
        json={"code": f"W3B-TGT-{suffix().lower()}", "name": "Wave3B Target", "is_active": True},
    )
    assert target_warehouse.status_code == 201
    target_warehouse_id = int(target_warehouse.json()["id"])

    draft_goods_issue = await client.post(
        "/api/goods-issues",
        headers=auth_headers(admin_token),
        json={"notes": "wave3b-rbac-draft"},
    )
    assert draft_goods_issue.status_code == 201
    goods_issue_id = int(draft_goods_issue.json()["id"])

    login = await client.post(
        "/api/auth/login",
        json={"username": username, "password": "Phase5User123!"},
    )
    assert login.status_code == 200
    user_token = login.json()["access_token"]
    headers = auth_headers(user_token)

    denied_alerts_read = await client.get("/api/alerts", headers=headers)
    assert denied_alerts_read.status_code == 403
    denied_alert_rule_write = await client.post(
        "/api/alert-rules",
        headers=headers,
        json={"name": f"w3b-denied-alert-{suffix().lower()}", "rule_type": "zero_stock", "severity": "medium"},
    )
    assert denied_alert_rule_write.status_code == 403

    denied_pick_read = await client.get("/api/pick-waves", headers=headers)
    assert denied_pick_read.status_code == 403
    denied_pick_write = await client.post(
        "/api/pick-waves",
        headers=headers,
        json={"goods_issue_ids": [goods_issue_id]},
    )
    assert denied_pick_write.status_code == 403

    denied_rule_read = await client.get("/api/approval-rules", headers=headers)
    assert denied_rule_read.status_code == 403
    denied_rule_write = await client.post(
        "/api/approval-rules",
        headers=headers,
        json={
            "name": f"w3b-denied-rule-{suffix().lower()}",
            "entity_type": "purchase_order",
            "required_role": "lagerleiter",
            "is_active": True,
        },
    )
    assert denied_rule_write.status_code == 403

    denied_approval_read = await client.get("/api/approvals", headers=headers)
    assert denied_approval_read.status_code == 403
    denied_approval_write = await client.post(
        "/api/approvals",
        headers=headers,
        json={"entity_type": "purchase_order", "entity_id": 5001, "amount": "10.00"},
    )
    assert denied_approval_write.status_code == 403

    denied_iwt_read = await client.get("/api/inter-warehouse-transfers", headers=headers)
    assert denied_iwt_read.status_code == 403
    denied_iwt_write = await client.post(
        "/api/inter-warehouse-transfers",
        headers=headers,
        json={
            "from_warehouse_id": source_warehouse_id,
            "to_warehouse_id": target_warehouse_id,
            "notes": "denied",
        },
    )
    assert denied_iwt_write.status_code == 403

    denied_inventory_write = await client.post(
        "/api/inventory-counts",
        headers=headers,
        json={"session_type": "snapshot", "warehouse_id": source_warehouse_id},
    )
    assert denied_inventory_write.status_code == 403

    grant_permissions = await client.put(
        f"/api/users/{user_id}/access-profile",
        headers=auth_headers(admin_token),
        json={
            "roles": [],
            "allow_permissions": [
                "module.inventory_counts.read",
                "module.inventory_counts.write",
                "module.inventory_counts.cancel",
                "module.alerts.read",
                "module.alerts.write",
                "module.picking.read",
                "module.picking.write",
                "module.approval_rules.read",
                "module.approval_rules.write",
                "module.approvals.read",
                "module.approvals.write",
                "module.inter_warehouse_transfers.read",
                "module.inter_warehouse_transfers.write",
            ],
            "deny_permissions": [],
        },
    )
    assert grant_permissions.status_code == 200

    allowed_alerts_read = await client.get("/api/alerts", headers=headers)
    assert allowed_alerts_read.status_code == 200
    allowed_alert_rule_write = await client.post(
        "/api/alert-rules",
        headers=headers,
        json={"name": f"w3b-allow-alert-{suffix().lower()}", "rule_type": "zero_stock", "severity": "medium"},
    )
    assert allowed_alert_rule_write.status_code == 201

    allowed_pick_read = await client.get("/api/pick-waves", headers=headers)
    assert allowed_pick_read.status_code == 200
    allowed_pick_write = await client.post(
        "/api/pick-waves",
        headers=headers,
        json={"goods_issue_ids": [goods_issue_id]},
    )
    assert allowed_pick_write.status_code == 201

    allowed_rule_read = await client.get("/api/approval-rules", headers=headers)
    assert allowed_rule_read.status_code == 200
    allowed_rule_write = await client.post(
        "/api/approval-rules",
        headers=headers,
        json={
            "name": f"w3b-allow-rule-{suffix().lower()}",
            "entity_type": "purchase_order",
            "required_role": "lagerleiter",
            "is_active": True,
        },
    )
    assert allowed_rule_write.status_code == 201

    allowed_approval_read = await client.get("/api/approvals", headers=headers)
    assert allowed_approval_read.status_code == 200
    allowed_approval_write = await client.post(
        "/api/approvals",
        headers=headers,
        json={"entity_type": "purchase_order", "entity_id": 5002, "amount": "11.00"},
    )
    assert allowed_approval_write.status_code == 201

    allowed_iwt_read = await client.get("/api/inter-warehouse-transfers", headers=headers)
    assert allowed_iwt_read.status_code == 200
    allowed_iwt_write = await client.post(
        "/api/inter-warehouse-transfers",
        headers=headers,
        json={
            "from_warehouse_id": source_warehouse_id,
            "to_warehouse_id": target_warehouse_id,
            "notes": "allowed",
        },
    )
    assert allowed_iwt_write.status_code == 201

    allowed_inventory_write = await client.post(
        "/api/inventory-counts",
        headers=headers,
        json={"session_type": "snapshot", "warehouse_id": source_warehouse_id},
    )
    assert allowed_inventory_write.status_code == 201
    session_id = int(allowed_inventory_write.json()["id"])

    allowed_inventory_cancel = await client.post(
        f"/api/inventory-counts/{session_id}/cancel",
        headers=headers,
    )
    assert allowed_inventory_cancel.status_code == 200


@pytest.mark.asyncio
async def test_wave3c_permissions_can_be_granted_without_any_role(client: AsyncClient, admin_token: str):
    username = f"phase5-wave3c-{suffix().lower()}"
    created = await client.post(
        "/api/users",
        headers=auth_headers(admin_token),
        json={
            "username": username,
            "email": f"{username}@example.com",
            "full_name": "No role Wave3C user",
            "password": "Phase5User123!",
            "roles": [],
            "is_active": True,
        },
    )
    assert created.status_code == 201
    user_id = int(created.json()["id"])

    login = await client.post(
        "/api/auth/login",
        json={"username": username, "password": "Phase5User123!"},
    )
    assert login.status_code == 200
    user_token = login.json()["access_token"]
    headers = auth_headers(user_token)

    denied_recommendations_read = await client.get("/api/purchase-recommendations", headers=headers)
    assert denied_recommendations_read.status_code == 403
    denied_recommendations_write = await client.post(
        "/api/purchase-recommendations/generate",
        headers=headers,
        json={},
    )
    assert denied_recommendations_write.status_code == 403

    denied_product_settings_read = await client.get("/api/products/999999/warehouse-settings", headers=headers)
    assert denied_product_settings_read.status_code == 403
    denied_product_settings_write = await client.put(
        "/api/products/999999/warehouse-settings/999999",
        headers=headers,
        json={"min_stock": "1"},
    )
    assert denied_product_settings_write.status_code == 403

    denied_abc_read = await client.get("/api/abc-classifications", headers=headers)
    assert denied_abc_read.status_code == 403
    denied_abc_write = await client.post(
        "/api/abc-classifications/recompute",
        headers=headers,
        json={},
    )
    assert denied_abc_write.status_code == 403

    denied_audit_log_read = await client.get("/api/audit-log?page=1&page_size=10", headers=headers)
    assert denied_audit_log_read.status_code == 403

    grant_permissions = await client.put(
        f"/api/users/{user_id}/access-profile",
        headers=auth_headers(admin_token),
        json={
            "roles": [],
            "allow_permissions": [
                "module.purchase_recommendations.read",
                "module.purchase_recommendations.write",
                "module.product_settings.read",
                "module.product_settings.write",
                "module.abc.read",
                "module.abc.write",
                "module.audit_log.read",
            ],
            "deny_permissions": [],
        },
    )
    assert grant_permissions.status_code == 200

    allowed_recommendations_read = await client.get("/api/purchase-recommendations", headers=headers)
    assert allowed_recommendations_read.status_code == 200
    allowed_recommendations_write = await client.post(
        "/api/purchase-recommendations/generate",
        headers=headers,
        json={},
    )
    assert allowed_recommendations_write.status_code == 200

    allowed_product_settings_read = await client.get("/api/products/999999/warehouse-settings", headers=headers)
    assert allowed_product_settings_read.status_code == 404
    allowed_product_settings_write = await client.put(
        "/api/products/999999/warehouse-settings/999999",
        headers=headers,
        json={"min_stock": "1"},
    )
    assert allowed_product_settings_write.status_code == 404

    allowed_abc_write = await client.post(
        "/api/abc-classifications/recompute",
        headers=headers,
        json={},
    )
    assert allowed_abc_write.status_code == 200
    run_id = int(allowed_abc_write.json()["id"])

    allowed_abc_read = await client.get(
        f"/api/abc-classifications?run_id={run_id}",
        headers=headers,
    )
    assert allowed_abc_read.status_code == 200

    allowed_audit_log_read = await client.get("/api/audit-log?page=1&page_size=10", headers=headers)
    assert allowed_audit_log_read.status_code == 200
