from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AlertEvent, AlertRule
from app.services.alerts import AlertCandidate, _is_duplicate_candidate


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"{prefix}-GROUP", "description": "Alerts group"},
    )
    assert group.status_code == 201
    group_id = group.json()["id"]

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-1",
            "name": f"{prefix} Product",
            "description": "Alerts product",
            "product_group_id": group_id,
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201

    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-WH", "name": f"Warehouse {prefix}", "address": "Test", "is_active": True},
    )
    assert warehouse.status_code == 201
    warehouse_id = warehouse.json()["id"]

    zone = await client.post(
        f"/api/warehouses/{warehouse_id}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-Z", "name": "Zone", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201
    zone_id = zone.json()["id"]

    bin_a = await client.post(
        f"/api/zones/{zone_id}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-BIN-A", "bin_type": "storage", "is_active": True},
    )
    assert bin_a.status_code == 201

    setting = await client.put(
        f"/api/products/{product.json()['id']}/warehouse-settings/{warehouse_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "min_stock": "5",
            "reorder_point": "5",
        },
    )
    assert setting.status_code == 200

    return {
        "product_id": product.json()["id"],
        "warehouse_id": warehouse_id,
        "bin_id": bin_a.json()["id"],
    }


async def _receive_stock(
    client: AsyncClient,
    admin_token: str,
    *,
    product_id: int,
    bin_id: int,
    quantity: str,
    batch_number: str | None = None,
    expiry_date: str | None = None,
) -> None:
    receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["id"]

    item_payload = {
        "product_id": product_id,
        "received_quantity": quantity,
        "unit": "piece",
        "target_bin_id": bin_id,
    }
    if batch_number:
        item_payload["batch_number"] = batch_number
    if expiry_date:
        item_payload["expiry_date"] = expiry_date

    item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=item_payload,
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200


async def _issue_stock(
    client: AsyncClient,
    admin_token: str,
    *,
    product_id: int,
    bin_id: int,
    quantity: str,
) -> None:
    issue = await client.post(
        "/api/goods-issues",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert issue.status_code == 201
    issue_id = issue.json()["id"]

    item = await client.post(
        f"/api/goods-issues/{issue_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product_id,
            "requested_quantity": quantity,
            "unit": "piece",
            "source_bin_id": bin_id,
        },
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-issues/{issue_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200


@pytest.mark.asyncio
async def test_alert_rules_crud_low_stock_and_ack(client: AsyncClient, admin_token: str):
    prefix = f"ALRT-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    create_rule = await client.post(
        "/api/alert-rules",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": f"{prefix} low stock",
            "rule_type": "low_stock",
            "severity": "high",
            "is_active": True,
            "product_id": data["product_id"],
            "warehouse_id": data["warehouse_id"],
            "threshold_quantity": "10",
            "dedupe_window_minutes": 1440,
        },
    )
    assert create_rule.status_code == 201
    rule_id = create_rule.json()["id"]

    await _receive_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_id"],
        quantity="4",
    )

    alerts = await client.get(
        f"/api/alerts?rule_id={rule_id}&alert_type=low_stock&status=open",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert alerts.status_code == 200
    payload = alerts.json()
    assert payload["total"] == 1
    alert_id = payload["items"][0]["id"]
    prefilled_order_id = payload["items"][0]["metadata_json"].get("prefilled_purchase_order_id")
    assert prefilled_order_id is not None

    order_detail = await client.get(
        f"/api/purchase-orders/{prefilled_order_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert order_detail.status_code == 200
    assert order_detail.json()["status"] == "draft"
    assert "low-stock-alert" in order_detail.json()["notes"].lower()

    order_items = await client.get(
        f"/api/purchase-orders/{prefilled_order_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert order_items.status_code == 200
    assert len(order_items.json()) == 1
    assert order_items.json()[0]["product_id"] == data["product_id"]
    assert order_items.json()[0]["ordered_quantity"] == "6.000"

    ack = await client.post(
        f"/api/alerts/{alert_id}/ack",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert ack.status_code == 200
    assert ack.json()["status"] == "acknowledged"
    assert ack.json()["acknowledged_by"] is not None

    get_rule = await client.get(
        f"/api/alert-rules/{rule_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert get_rule.status_code == 200

    update_rule = await client.put(
        f"/api/alert-rules/{rule_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"severity": "critical", "is_active": False},
    )
    assert update_rule.status_code == 200
    assert update_rule.json()["severity"] == "critical"
    assert update_rule.json()["is_active"] is False


@pytest.mark.asyncio
async def test_alert_rule_rbac_and_zero_stock_dedup(client: AsyncClient, admin_token: str):
    prefix = f"ALRB-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    create_worker = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": f"alerts-worker-{_suffix().lower()}",
            "email": f"alerts-worker-{_suffix().lower()}@example.com",
            "full_name": "Alerts Worker",
            "password": "WorkerPass123!",
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert create_worker.status_code == 201

    worker_login = await client.post(
        "/api/auth/login",
        json={"username": create_worker.json()["username"], "password": "WorkerPass123!"},
    )
    assert worker_login.status_code == 200
    worker_token = worker_login.json()["access_token"]

    worker_create_rule = await client.post(
        "/api/alert-rules",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={
            "name": f"{prefix} forbidden",
            "rule_type": "zero_stock",
            "severity": "high",
            "is_active": True,
            "product_id": data["product_id"],
            "warehouse_id": data["warehouse_id"],
        },
    )
    assert worker_create_rule.status_code == 403

    create_rule = await client.post(
        "/api/alert-rules",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": f"{prefix} zero stock",
            "rule_type": "zero_stock",
            "severity": "critical",
            "is_active": True,
            "product_id": data["product_id"],
            "warehouse_id": data["warehouse_id"],
            "dedupe_window_minutes": 1440,
        },
    )
    assert create_rule.status_code == 201
    rule_id = create_rule.json()["id"]

    await _receive_stock(client, admin_token, product_id=data["product_id"], bin_id=data["bin_id"], quantity="2")
    await _issue_stock(client, admin_token, product_id=data["product_id"], bin_id=data["bin_id"], quantity="2")

    first = await client.get(
        f"/api/alerts?rule_id={rule_id}&alert_type=zero_stock&status=open",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert first.status_code == 200
    assert first.json()["total"] == 1
    alert_id = first.json()["items"][0]["id"]

    await _receive_stock(client, admin_token, product_id=data["product_id"], bin_id=data["bin_id"], quantity="2")
    await _issue_stock(client, admin_token, product_id=data["product_id"], bin_id=data["bin_id"], quantity="2")

    second = await client.get(
        f"/api/alerts?rule_id={rule_id}&alert_type=zero_stock&status=open",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert second.status_code == 200
    assert second.json()["total"] == 1

    ack = await client.post(
        f"/api/alerts/{alert_id}/ack",
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert ack.status_code == 200

    await _receive_stock(client, admin_token, product_id=data["product_id"], bin_id=data["bin_id"], quantity="1")
    await _issue_stock(client, admin_token, product_id=data["product_id"], bin_id=data["bin_id"], quantity="1")

    all_alerts = await client.get(
        f"/api/alerts?rule_id={rule_id}&alert_type=zero_stock",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert all_alerts.status_code == 200
    assert all_alerts.json()["total"] == 1


@pytest.mark.asyncio
async def test_low_stock_alert_does_not_create_prefilled_order_when_open_po_exists(client: AsyncClient, admin_token: str):
    prefix = f"ALPO-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    existing_po = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": "Manual pre-existing PO"},
    )
    assert existing_po.status_code == 201

    existing_po_item = await client.post(
        f"/api/purchase-orders/{existing_po.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "ordered_quantity": "10",
            "unit": "piece",
        },
    )
    assert existing_po_item.status_code == 201

    create_rule = await client.post(
        "/api/alert-rules",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": f"{prefix} low stock",
            "rule_type": "low_stock",
            "severity": "high",
            "is_active": True,
            "product_id": data["product_id"],
            "warehouse_id": data["warehouse_id"],
            "threshold_quantity": "10",
            "dedupe_window_minutes": 1440,
        },
    )
    assert create_rule.status_code == 201

    await _receive_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_id"],
        quantity="4",
    )

    alerts = await client.get(
        f"/api/alerts?rule_id={create_rule.json()['id']}&alert_type=low_stock&status=open",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert alerts.status_code == 200
    assert alerts.json()["total"] == 1
    assert alerts.json()["items"][0]["metadata_json"].get("prefilled_purchase_order_id") is None

    all_orders = await client.get(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert all_orders.status_code == 200

    matching_orders: set[int] = set()
    for order in all_orders.json():
        items = await client.get(
            f"/api/purchase-orders/{order['id']}/items",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert items.status_code == 200
        if any(item["product_id"] == data["product_id"] for item in items.json()):
            matching_orders.add(order["id"])

    assert matching_orders == {existing_po.json()["id"]}


@pytest.mark.asyncio
async def test_expiry_window_alert_trigger(client: AsyncClient, admin_token: str):
    prefix = f"ALEX-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)

    create_rule = await client.post(
        "/api/alert-rules",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": f"{prefix} expiry",
            "rule_type": "expiry_window",
            "severity": "high",
            "is_active": True,
            "product_id": data["product_id"],
            "warehouse_id": data["warehouse_id"],
            "expiry_days": 5,
            "dedupe_window_minutes": 1440,
        },
    )
    assert create_rule.status_code == 201
    rule_id = create_rule.json()["id"]

    expiry_date = (datetime.now(UTC).date() + timedelta(days=2)).isoformat()
    await _receive_stock(
        client,
        admin_token,
        product_id=data["product_id"],
        bin_id=data["bin_id"],
        quantity="3",
        batch_number=f"BAT-{_suffix()}",
        expiry_date=expiry_date,
    )

    alerts = await client.get(
        f"/api/alerts?rule_id={rule_id}&alert_type=expiry_window&status=open",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert alerts.status_code == 200
    assert alerts.json()["total"] == 1
    assert alerts.json()["items"][0]["batch_id"] is not None


@pytest.mark.asyncio
async def test_alert_dedupe_handles_duplicate_open_rows_without_error(db_session: AsyncSession):
    source_key = f"low_stock:dup:{_suffix()}"
    rule = AlertRule(
        name=f"Deduplicate {_suffix()}",
        rule_type="low_stock",
        severity="medium",
        is_active=True,
        dedupe_window_minutes=60,
    )
    db_session.add(rule)
    await db_session.flush()

    now = datetime.now(UTC)
    db_session.add_all(
        [
            AlertEvent(
                rule_id=rule.id,
                alert_type="low_stock",
                severity="medium",
                status="open",
                title="Duplicate alert 1",
                message="duplicate open row",
                source_key=source_key,
                triggered_at=now,
            ),
            AlertEvent(
                rule_id=rule.id,
                alert_type="low_stock",
                severity="medium",
                status="open",
                title="Duplicate alert 2",
                message="duplicate open row",
                source_key=source_key,
                triggered_at=now,
            ),
        ]
    )
    await db_session.commit()

    candidate = AlertCandidate(
        rule_id=rule.id,
        alert_type="low_stock",
        severity="medium",
        title="Candidate",
        message="Candidate",
        source_key=source_key,
        product_id=None,
        warehouse_id=None,
        bin_location_id=None,
        batch_id=None,
        metadata_json=None,
        dedupe_window_minutes=60,
    )
    assert await _is_duplicate_candidate(db_session, candidate) is True
