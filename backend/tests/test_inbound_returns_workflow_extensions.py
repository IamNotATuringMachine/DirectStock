from datetime import UTC, datetime
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import SerialNumber


def _suffix() -> str:
    return uuid4().hex[:8].upper()


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_product_and_bins(
    client: AsyncClient,
    admin_token: str,
    *,
    prefix: str,
    requires_item_tracking: bool = False,
) -> dict[str, int]:
    group = await client.post(
        "/api/product-groups",
        headers=_auth_headers(admin_token),
        json={"name": f"{prefix}-GROUP", "description": "Inbound/returns workflow tests"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers=_auth_headers(admin_token),
        json={
            "product_number": f"{prefix}-ART-001",
            "name": f"{prefix} Product",
            "description": "Workflow extension test product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
            "requires_item_tracking": requires_item_tracking,
        },
    )
    assert product.status_code == 201

    warehouse = await client.post(
        "/api/warehouses",
        headers=_auth_headers(admin_token),
        json={"code": f"{prefix}-WH", "name": f"Warehouse {prefix}", "is_active": True},
    )
    assert warehouse.status_code == 201

    zone = await client.post(
        f"/api/warehouses/{warehouse.json()['id']}/zones",
        headers=_auth_headers(admin_token),
        json={"code": f"{prefix}-Z", "name": "Zone", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201

    bin_a = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers=_auth_headers(admin_token),
        json={"code": f"{prefix}-BIN-A", "bin_type": "storage", "is_active": True},
    )
    assert bin_a.status_code == 201

    bin_b = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers=_auth_headers(admin_token),
        json={"code": f"{prefix}-BIN-B", "bin_type": "storage", "is_active": True},
    )
    assert bin_b.status_code == 201

    return {
        "group_id": group.json()["id"],
        "product_id": product.json()["id"],
        "warehouse_id": warehouse.json()["id"],
        "zone_id": zone.json()["id"],
        "bin_a_id": bin_a.json()["id"],
        "bin_b_id": bin_b.json()["id"],
    }


@pytest.mark.asyncio
async def test_tracked_goods_receipt_requires_serial_numbers(client: AsyncClient, admin_token: str):
    prefix = f"TRK-{_suffix()}"
    data = await _create_product_and_bins(
        client,
        admin_token,
        prefix=prefix,
        requires_item_tracking=True,
    )

    receipt = await client.post(
        "/api/goods-receipts",
        headers=_auth_headers(admin_token),
        json={},
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["id"]

    item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers=_auth_headers(admin_token),
        json={
            "product_id": data["product_id"],
            "received_quantity": "2",
            "unit": "piece",
            "target_bin_id": data["bin_a_id"],
        },
    )
    assert item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers=_auth_headers(admin_token),
    )
    assert complete.status_code == 422
    assert "serial" in complete.json()["message"].lower()


@pytest.mark.asyncio
async def test_tracked_goods_receipt_with_serials_creates_labels_and_serial_rows(
    client: AsyncClient,
    admin_token: str,
    db_session: AsyncSession,
):
    prefix = f"TRKOK-{_suffix()}"
    data = await _create_product_and_bins(
        client,
        admin_token,
        prefix=prefix,
        requires_item_tracking=True,
    )

    receipt = await client.post(
        "/api/goods-receipts",
        headers=_auth_headers(admin_token),
        json={},
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["id"]

    serial_numbers = [f"{prefix}-SN-1", f"{prefix}-SN-2"]
    item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers=_auth_headers(admin_token),
        json={
            "product_id": data["product_id"],
            "received_quantity": "2",
            "unit": "piece",
            "target_bin_id": data["bin_a_id"],
            "serial_numbers": serial_numbers,
        },
    )
    assert item.status_code == 201
    item_id = item.json()["id"]

    complete = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers=_auth_headers(admin_token),
    )
    assert complete.status_code == 200

    serial_rows = list(
        (
            await db_session.execute(
                select(SerialNumber).where(SerialNumber.product_id == data["product_id"])
            )
        ).scalars()
    )
    assert len(serial_rows) == 2
    assert sorted(row.serial_number for row in serial_rows) == sorted(serial_numbers)

    label_pdf = await client.get(
        f"/api/goods-receipts/{receipt_id}/items/{item_id}/serial-labels/pdf",
        headers=_auth_headers(admin_token),
    )
    assert label_pdf.status_code == 200
    assert label_pdf.headers["content-type"].startswith("application/pdf")
    assert len(label_pdf.content) > 100


@pytest.mark.asyncio
async def test_free_technician_receipt_requires_condition_and_routes_to_repair_center(
    client: AsyncClient,
    admin_token: str,
):
    prefix = f"RCT-{_suffix()}"
    data = await _create_product_and_bins(client, admin_token, prefix=prefix)

    receipt = await client.post(
        "/api/goods-receipts",
        headers=_auth_headers(admin_token),
        json={"mode": "free", "source_type": "technician"},
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["id"]

    missing_condition = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers=_auth_headers(admin_token),
        json={
            "product_id": data["product_id"],
            "received_quantity": "1",
            "unit": "piece",
            "target_bin_id": data["bin_a_id"],
        },
    )
    assert missing_condition.status_code == 422

    valid_item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers=_auth_headers(admin_token),
        json={
            "product_id": data["product_id"],
            "received_quantity": "1",
            "unit": "piece",
            "target_bin_id": data["bin_a_id"],
            "condition": "defective",
        },
    )
    assert valid_item.status_code == 201

    complete_without_returns_bin = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers=_auth_headers(admin_token),
    )
    assert complete_without_returns_bin.status_code == 422
    assert "repaircenter" in complete_without_returns_bin.json()["message"].lower()

    returns_zone = await client.post(
        f"/api/warehouses/{data['warehouse_id']}/zones",
        headers=_auth_headers(admin_token),
        json={"code": f"{prefix}-RET", "name": "Repair Center", "zone_type": "returns", "is_active": True},
    )
    assert returns_zone.status_code == 201
    returns_zone_id = returns_zone.json()["id"]

    returns_bin = await client.post(
        f"/api/zones/{returns_zone_id}/bins",
        headers=_auth_headers(admin_token),
        json={"code": f"{prefix}-RC-BIN", "bin_type": "returns", "is_active": True},
    )
    assert returns_bin.status_code == 201
    returns_bin_id = returns_bin.json()["id"]

    complete = await client.post(
        f"/api/goods-receipts/{receipt_id}/complete",
        headers=_auth_headers(admin_token),
    )
    assert complete.status_code == 200

    storage_bin_stock = await client.get(
        f"/api/inventory/by-bin/{data['bin_a_id']}",
        headers=_auth_headers(admin_token),
    )
    assert storage_bin_stock.status_code == 200
    assert all(
        row["product_id"] != data["product_id"] or row["quantity"] == "0.000"
        for row in storage_bin_stock.json()
    )

    repair_bin_stock = await client.get(
        f"/api/inventory/by-bin/{returns_bin_id}",
        headers=_auth_headers(admin_token),
    )
    assert repair_bin_stock.status_code == 200
    assert any(
        row["product_id"] == data["product_id"] and row["quantity"] == "1.000"
        for row in repair_bin_stock.json()
    )

    movements = await client.get(
        "/api/inventory/movements",
        headers=_auth_headers(admin_token),
    )
    assert movements.status_code == 200
    assert any(
        row["reference_number"] == receipt.json()["receipt_number"]
        and row["to_bin_code"] == f"{prefix}-RC-BIN"
        for row in movements.json()
    )


@pytest.mark.asyncio
async def test_goods_receipt_item_labels_pdf_for_non_serial_item(client: AsyncClient, admin_token: str):
    prefix = f"LBL-{_suffix()}"
    data = await _create_product_and_bins(client, admin_token, prefix=prefix)

    receipt = await client.post(
        "/api/goods-receipts",
        headers=_auth_headers(admin_token),
        json={},
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["id"]

    item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers=_auth_headers(admin_token),
        json={
            "product_id": data["product_id"],
            "received_quantity": "4",
            "unit": "piece",
            "target_bin_id": data["bin_a_id"],
        },
    )
    assert item.status_code == 201
    item_id = item.json()["id"]

    label_pdf = await client.get(
        f"/api/goods-receipts/{receipt_id}/items/{item_id}/item-labels/pdf",
        headers=_auth_headers(admin_token),
        params={"copies": 3},
    )
    assert label_pdf.status_code == 200
    assert label_pdf.headers["content-type"].startswith("application/pdf")
    assert len(label_pdf.content) > 100


@pytest.mark.asyncio
async def test_goods_receipt_ad_hoc_product_creation_requires_permission(client: AsyncClient, admin_token: str):
    prefix = f"ADHOC-{_suffix()}"
    data = await _create_product_and_bins(client, admin_token, prefix=prefix)

    login_worker = await client.post(
        "/api/auth/login",
        json={"username": "lagermitarbeiter", "password": "Lagermitarbeiter2026!"},
    )
    assert login_worker.status_code == 200
    worker_token = login_worker.json()["access_token"]

    receipt = await client.post(
        "/api/goods-receipts",
        headers=_auth_headers(admin_token),
        json={},
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["id"]

    payload = {
        "product_number": f"{prefix}-ADHOC-1",
        "name": f"{prefix} AdHoc",
        "description": "Ad-hoc from WE dialog",
        "product_group_id": data["group_id"],
        "unit": "piece",
        "status": "active",
        "requires_item_tracking": True,
    }
    forbidden = await client.post(
        f"/api/goods-receipts/{receipt_id}/ad-hoc-product",
        headers=_auth_headers(worker_token),
        json=payload,
    )
    assert forbidden.status_code == 403

    created = await client.post(
        f"/api/goods-receipts/{receipt_id}/ad-hoc-product",
        headers=_auth_headers(admin_token),
        json=payload,
    )
    assert created.status_code == 201
    assert created.json()["requires_item_tracking"] is True

    created_with_new_group = await client.post(
        f"/api/goods-receipts/{receipt_id}/ad-hoc-product",
        headers=_auth_headers(admin_token),
        json={
            "product_number": f"{prefix}-ADHOC-2",
            "name": f"{prefix} AdHoc New Group",
            "description": "Ad-hoc from WE dialog with group creation",
            "product_group_id": None,
            "product_group_name": f"{prefix}-ADHOC-GROUP",
            "unit": "piece",
            "status": "active",
            "requires_item_tracking": False,
        },
    )
    assert created_with_new_group.status_code == 201
    assert created_with_new_group.json()["group_name"] == f"{prefix}-ADHOC-GROUP"
    assert created_with_new_group.json()["product_group_id"] is not None

    invalid_both_group_fields = await client.post(
        f"/api/goods-receipts/{receipt_id}/ad-hoc-product",
        headers=_auth_headers(admin_token),
        json={
            "product_number": f"{prefix}-ADHOC-3",
            "name": f"{prefix} AdHoc Invalid",
            "description": "Invalid dual group input",
            "product_group_id": data["group_id"],
            "product_group_name": f"{prefix}-ADHOC-GROUP-2",
            "unit": "piece",
            "status": "active",
            "requires_item_tracking": False,
        },
    )
    assert invalid_both_group_fields.status_code == 422


@pytest.mark.asyncio
async def test_external_repair_dispatch_and_receive_flow_creates_document_and_moves_stock(
    client: AsyncClient,
    admin_token: str,
):
    prefix = f"RMAEXT-{_suffix()}"
    data = await _create_product_and_bins(client, admin_token, prefix=prefix)

    order = await client.post(
        "/api/return-orders",
        headers=_auth_headers(admin_token),
        json={
            "source_type": "technician",
            "source_reference": f"TECH-{prefix}",
            "notes": "External repair path",
        },
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    item = await client.post(
        f"/api/return-orders/{order_id}/items",
        headers=_auth_headers(admin_token),
        json={
            "product_id": data["product_id"],
            "quantity": "2",
            "unit": "piece",
            "decision": "repair",
            "repair_mode": "external",
            "target_bin_id": data["bin_a_id"],
            "reason": "Needs vendor repair",
        },
    )
    assert item.status_code == 201
    item_id = item.json()["id"]
    assert item.json()["external_status"] == "waiting_external_provider"

    dispatch = await client.post(
        f"/api/return-orders/{order_id}/items/{item_id}/dispatch-external",
        headers=_auth_headers(admin_token),
        json={"external_partner": "Spain Repair Partner"},
    )
    assert dispatch.status_code == 200
    dispatch_payload = dispatch.json()
    assert dispatch_payload["item"]["external_status"] == "at_external_provider"
    assert dispatch_payload["document_id"] > 0

    docs = await client.get(
        f"/api/documents?entity_type=return_order&entity_id={order_id}&document_type=external_repair_form",
        headers=_auth_headers(admin_token),
    )
    assert docs.status_code == 200
    assert any(row["id"] == dispatch_payload["document_id"] for row in docs.json()["items"])

    by_product_after_dispatch = await client.get(
        f"/api/inventory/by-product/{data['product_id']}",
        headers=_auth_headers(admin_token),
    )
    assert by_product_after_dispatch.status_code == 200
    rows_after_dispatch = {row["bin_code"]: row for row in by_product_after_dispatch.json()}
    assert rows_after_dispatch["ESP-REPAIR-BIN"]["quantity"] == "2.000"

    receive = await client.post(
        f"/api/return-orders/{order_id}/items/{item_id}/receive-external",
        headers=_auth_headers(admin_token),
        json={"target_bin_id": data["bin_b_id"]},
    )
    assert receive.status_code == 200
    receive_payload = receive.json()
    assert receive_payload["external_status"] == "ready_for_use"
    assert receive_payload["target_bin_id"] == data["bin_b_id"]

    by_product_after_receive = await client.get(
        f"/api/inventory/by-product/{data['product_id']}",
        headers=_auth_headers(admin_token),
    )
    assert by_product_after_receive.status_code == 200
    rows_after_receive = {row["bin_code"]: row for row in by_product_after_receive.json()}
    assert rows_after_receive["ESP-REPAIR-BIN"]["quantity"] == "0.000"
    assert rows_after_receive[f"{prefix}-BIN-B"]["quantity"] == "2.000"


@pytest.mark.asyncio
async def test_returns_report_includes_internal_and_external_repair_counters(
    client: AsyncClient,
    admin_token: str,
):
    prefix = f"RTRP-{_suffix()}"
    data = await _create_product_and_bins(client, admin_token, prefix=prefix)

    internal_order = await client.post(
        "/api/return-orders",
        headers=_auth_headers(admin_token),
        json={"source_type": "customer", "source_reference": f"CUST-{prefix}"},
    )
    assert internal_order.status_code == 201

    external_order = await client.post(
        "/api/return-orders",
        headers=_auth_headers(admin_token),
        json={"source_type": "technician", "source_reference": f"TECH-{prefix}"},
    )
    assert external_order.status_code == 201

    internal_item = await client.post(
        f"/api/return-orders/{internal_order.json()['id']}/items",
        headers=_auth_headers(admin_token),
        json={
            "product_id": data["product_id"],
            "quantity": "1",
            "unit": "piece",
            "decision": "repair",
            "repair_mode": "internal",
            "target_bin_id": data["bin_a_id"],
        },
    )
    assert internal_item.status_code == 201

    external_item = await client.post(
        f"/api/return-orders/{external_order.json()['id']}/items",
        headers=_auth_headers(admin_token),
        json={
            "product_id": data["product_id"],
            "quantity": "1",
            "unit": "piece",
            "decision": "repair",
            "repair_mode": "external",
            "target_bin_id": data["bin_a_id"],
        },
    )
    assert external_item.status_code == 201

    today = datetime.now(UTC).date().isoformat()
    report = await client.get(
        f"/api/reports/returns?date_from={today}&date_to={today}",
        headers=_auth_headers(admin_token),
    )
    assert report.status_code == 200
    items = {row["return_number"]: row for row in report.json()["items"]}

    internal_row = items[internal_order.json()["return_number"]]
    external_row = items[external_order.json()["return_number"]]
    assert internal_row["internal_repair_items"] == 1
    assert internal_row["external_repair_items"] == 0
    assert external_row["internal_repair_items"] == 0
    assert external_row["external_repair_items"] == 1
