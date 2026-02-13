from datetime import UTC, datetime
from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"{prefix}-GROUP", "description": "Reports group"},
    )
    assert group.status_code == 201
    group_id = group.json()["id"]

    product_a = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-A",
            "name": f"{prefix} Product A",
            "description": "Reports product",
            "product_group_id": group_id,
            "unit": "piece",
            "status": "active",
        },
    )
    assert product_a.status_code == 201

    product_b = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-B",
            "name": f"{prefix} Product B",
            "description": "Reports product",
            "product_group_id": group_id,
            "unit": "piece",
            "status": "active",
        },
    )
    assert product_b.status_code == 201

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

    return {
        "product_a_id": product_a.json()["id"],
        "product_a_number": product_a.json()["product_number"],
        "product_b_id": product_b.json()["id"],
        "product_b_number": product_b.json()["product_number"],
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
) -> None:
    receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
    )
    assert receipt.status_code == 201
    receipt_id = receipt.json()["id"]

    item = await client.post(
        f"/api/goods-receipts/{receipt_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product_id,
            "received_quantity": quantity,
            "unit": "piece",
            "target_bin_id": bin_id,
        },
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


async def _create_completed_inventory_count(client: AsyncClient, admin_token: str, warehouse_id: int) -> None:
    session = await client.post(
        "/api/inventory-counts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"session_type": "cycle", "warehouse_id": warehouse_id, "tolerance_quantity": "5"},
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    generated = await client.post(
        f"/api/inventory-counts/{session_id}/generate-items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"refresh_existing": False},
    )
    assert generated.status_code == 200

    items = await client.get(
        f"/api/inventory-counts/{session_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert items.status_code == 200

    for row in items.json():
        count = await client.put(
            f"/api/inventory-counts/{session_id}/items/{row['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"counted_quantity": row["snapshot_quantity"]},
        )
        assert count.status_code == 200

    complete = await client.post(
        f"/api/inventory-counts/{session_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200


@pytest.mark.asyncio
async def test_reports_stock_and_csv(client: AsyncClient, admin_token: str):
    prefix = f"RPST-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)
    await _receive_stock(client, admin_token, product_id=data["product_a_id"], bin_id=data["bin_id"], quantity="8")

    stock = await client.get(
        f"/api/reports/stock?page=1&page_size=10&search={data['product_a_number']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert stock.status_code == 200
    payload = stock.json()
    assert payload["total"] >= 1
    assert payload["items"][0]["product_number"] == data["product_a_number"]

    stock_csv = await client.get(
        f"/api/reports/stock?format=csv&search={data['product_a_number']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert stock_csv.status_code == 200
    assert stock_csv.headers["content-type"].startswith("text/csv")
    assert "product_number" in stock_csv.text
    assert data["product_a_number"] in stock_csv.text


@pytest.mark.asyncio
async def test_reports_movements_and_inbound_outbound(client: AsyncClient, admin_token: str):
    prefix = f"RPMV-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)
    await _receive_stock(client, admin_token, product_id=data["product_a_id"], bin_id=data["bin_id"], quantity="10")
    await _issue_stock(client, admin_token, product_id=data["product_a_id"], bin_id=data["bin_id"], quantity="3")

    today = datetime.now(UTC).date().isoformat()
    movements = await client.get(
        f"/api/reports/movements?page=1&page_size=1&date_from={today}&date_to={today}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert movements.status_code == 200
    payload = movements.json()
    assert payload["total"] >= 2
    assert len(payload["items"]) == 1

    movements_csv = await client.get(
        f"/api/reports/movements?format=csv&date_from={today}&date_to={today}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert movements_csv.status_code == 200
    assert "movement_type" in movements_csv.text

    inbound_outbound = await client.get(
        f"/api/reports/inbound-outbound?date_from={today}&date_to={today}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert inbound_outbound.status_code == 200
    io_items = inbound_outbound.json()["items"]
    assert len(io_items) >= 1
    assert float(io_items[0]["inbound_quantity"]) >= 0
    assert float(io_items[0]["outbound_quantity"]) >= 0

    inbound_outbound_csv = await client.get(
        f"/api/reports/inbound-outbound?format=csv&date_from={today}&date_to={today}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert inbound_outbound_csv.status_code == 200
    assert "inbound_quantity" in inbound_outbound_csv.text


@pytest.mark.asyncio
async def test_reports_inventory_accuracy_abc_and_kpis(client: AsyncClient, admin_token: str):
    prefix = f"RPAK-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)
    await _receive_stock(client, admin_token, product_id=data["product_a_id"], bin_id=data["bin_id"], quantity="12")
    await _receive_stock(client, admin_token, product_id=data["product_b_id"], bin_id=data["bin_id"], quantity="4")
    await _issue_stock(client, admin_token, product_id=data["product_a_id"], bin_id=data["bin_id"], quantity="5")
    await _issue_stock(client, admin_token, product_id=data["product_b_id"], bin_id=data["bin_id"], quantity="1")
    await _create_completed_inventory_count(client, admin_token, data["warehouse_id"])

    today = datetime.now(UTC).date().isoformat()
    accuracy = await client.get(
        f"/api/reports/inventory-accuracy?date_from={today}&date_to={today}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert accuracy.status_code == 200
    accuracy_payload = accuracy.json()
    assert accuracy_payload["total_sessions"] >= 1
    assert float(accuracy_payload["overall_accuracy_percent"]) >= 0

    accuracy_csv = await client.get(
        f"/api/reports/inventory-accuracy?format=csv&date_from={today}&date_to={today}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert accuracy_csv.status_code == 200
    assert "session_number" in accuracy_csv.text

    abc = await client.get(
        f"/api/reports/abc?date_from={today}&date_to={today}&search={prefix}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert abc.status_code == 200
    abc_items = abc.json()["items"]
    assert len(abc_items) >= 1
    assert abc_items[0]["category"] in {"A", "B", "C"}

    abc_csv = await client.get(
        f"/api/reports/abc?format=csv&date_from={today}&date_to={today}&search={prefix}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert abc_csv.status_code == 200
    assert "cumulative_share_percent" in abc_csv.text

    kpis = await client.get(
        f"/api/reports/kpis?date_from={today}&date_to={today}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert kpis.status_code == 200
    kpi_payload = kpis.json()
    assert "turnover_rate" in kpi_payload
    assert "dock_to_stock_hours" in kpi_payload
    assert "inventory_accuracy_percent" in kpi_payload
    assert "alert_count" in kpi_payload
    assert "inter_warehouse_transfers_in_transit" in kpi_payload
    assert "inter_warehouse_transit_quantity" in kpi_payload
