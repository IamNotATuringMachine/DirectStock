from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.models.catalog import ProductWarehouseSetting
from app.models.inventory import Inventory, StockMovement


@pytest.mark.asyncio
async def test_inventory_endpoints(client: AsyncClient, admin_token: str, db_session):
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "INV-GROUP-01", "description": "Inventory test group"},
    )
    assert group.status_code == 201
    group_id = group.json()["id"]

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": "INV-ART-001",
            "name": "Inventory Product",
            "description": "Inventory product",
            "product_group_id": group_id,
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]

    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "INV-WH-01", "name": "Inventory Warehouse", "address": "Hamburg", "is_active": True},
    )
    assert warehouse.status_code == 201
    warehouse_id = warehouse.json()["id"]

    zone = await client.post(
        f"/api/warehouses/{warehouse_id}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "INV-Z", "name": "Inventory Zone", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201
    zone_id = zone.json()["id"]

    bin_location = await client.post(
        f"/api/zones/{zone_id}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "INV-BIN-01", "bin_type": "storage", "is_active": True},
    )
    assert bin_location.status_code == 201
    bin_id = bin_location.json()["id"]

    db_session.add(
        ProductWarehouseSetting(
            product_id=product_id,
            warehouse_id=warehouse_id,
            reorder_point=Decimal("15"),
            min_stock=Decimal("10"),
        )
    )
    db_session.add(
        Inventory(
            product_id=product_id,
            bin_location_id=bin_id,
            quantity=Decimal("8"),
            reserved_quantity=Decimal("2"),
            unit="piece",
        )
    )
    db_session.add(
        StockMovement(
            movement_type="goods_receipt",
            reference_type="test",
            reference_number="INV-MOV-01",
            product_id=product_id,
            from_bin_id=None,
            to_bin_id=bin_id,
            quantity=Decimal("8"),
            performed_by=1,
        )
    )
    await db_session.commit()

    inventory_list = await client.get(
        "/api/inventory",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert inventory_list.status_code == 200
    assert inventory_list.json()["total"] >= 1

    by_product = await client.get(
        f"/api/inventory/by-product/{product_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert by_product.status_code == 200
    assert by_product.json()[0]["bin_id"] == bin_id

    by_bin = await client.get(
        f"/api/inventory/by-bin/{bin_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert by_bin.status_code == 200
    assert by_bin.json()[0]["product_id"] == product_id

    by_warehouse = await client.get(
        f"/api/inventory/by-warehouse/{warehouse_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert by_warehouse.status_code == 200
    assert by_warehouse.json()[0]["product_id"] == product_id

    low_stock = await client.get(
        "/api/inventory/low-stock",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert low_stock.status_code == 200
    assert any(item["product_id"] == product_id for item in low_stock.json())

    movements = await client.get(
        "/api/inventory/movements",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert movements.status_code == 200
    assert any(item["product_id"] == product_id for item in movements.json())

    filtered_movements = await client.get(
        f"/api/inventory/movements?product_id={product_id}&limit=10",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert filtered_movements.status_code == 200
    assert filtered_movements.json()
    assert all(item["product_id"] == product_id for item in filtered_movements.json())

    summary = await client.get(
        "/api/inventory/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert summary.status_code == 200
    assert Decimal(summary.json()["total_quantity"]) >= Decimal("8")
