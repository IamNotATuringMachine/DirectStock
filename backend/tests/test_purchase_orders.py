from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    supplier = await client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_number": f"PO-SUP-{prefix}",
            "company_name": "PO Supplier",
            "is_active": True,
        },
    )
    assert supplier.status_code == 201

    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"PO-GRP-{prefix}", "description": "PO Group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"PO-ART-{prefix}",
            "name": "PO Product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201

    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"PO-WH-{prefix}", "name": f"PO Warehouse {prefix}", "is_active": True},
    )
    assert warehouse.status_code == 201

    zone = await client.post(
        f"/api/warehouses/{warehouse.json()['id']}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"PO-Z-{prefix}", "name": "PO Zone", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201

    bin_location = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"PO-BIN-{prefix}", "bin_type": "storage", "is_active": True},
    )
    assert bin_location.status_code == 201

    return {
        "supplier_id": supplier.json()["id"],
        "product_id": product.json()["id"],
        "bin_id": bin_location.json()["id"],
    }


async def _create_order_with_item(
    client: AsyncClient,
    admin_token: str,
    *,
    supplier_id: int,
    product_id: int,
    ordered_quantity: str,
) -> tuple[int, int]:
    order = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": supplier_id, "notes": "PO test"},
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    item = await client.post(
        f"/api/purchase-orders/{order_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": product_id,
            "ordered_quantity": ordered_quantity,
            "unit": "piece",
            "unit_price": "11.00",
        },
    )
    assert item.status_code == 201
    item_id = item.json()["id"]

    approved = await client.post(
        f"/api/purchase-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "approved"},
    )
    assert approved.status_code == 200

    ordered = await client.post(
        f"/api/purchase-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "ordered"},
    )
    assert ordered.status_code == 200

    return order_id, item_id


@pytest.mark.asyncio
async def test_purchase_order_lifecycle(client: AsyncClient, admin_token: str):
    suffix = _suffix()
    data = await _create_master_data(client, admin_token, suffix)

    order_id, _ = await _create_order_with_item(
        client,
        admin_token,
        supplier_id=data["supplier_id"],
        product_id=data["product_id"],
        ordered_quantity="5",
    )

    invalid = await client.post(
        f"/api/purchase-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "draft"},
    )
    assert invalid.status_code == 409


@pytest.mark.asyncio
async def test_purchase_order_completion_blocked_when_open_quantities_exist(client: AsyncClient, admin_token: str):
    suffix = _suffix()
    data = await _create_master_data(client, admin_token, suffix)

    order_id, _ = await _create_order_with_item(
        client,
        admin_token,
        supplier_id=data["supplier_id"],
        product_id=data["product_id"],
        ordered_quantity="5",
    )

    complete = await client.post(
        f"/api/purchase-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "completed"},
    )
    assert complete.status_code == 409
    payload = complete.json()
    assert payload["code"] == "conflict"
    assert "open quantities" in payload["message"].lower()


@pytest.mark.asyncio
async def test_goods_receipt_updates_linked_purchase_order_item_and_status(client: AsyncClient, admin_token: str):
    suffix = _suffix()
    data = await _create_master_data(client, admin_token, suffix)

    order_id, order_item_id = await _create_order_with_item(
        client,
        admin_token,
        supplier_id=data["supplier_id"],
        product_id=data["product_id"],
        ordered_quantity="5",
    )

    first_receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": data["supplier_id"]},
    )
    assert first_receipt.status_code == 201

    first_receipt_item = await client.post(
        f"/api/goods-receipts/{first_receipt.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "received_quantity": "3",
            "unit": "piece",
            "target_bin_id": data["bin_id"],
            "purchase_order_item_id": order_item_id,
        },
    )
    assert first_receipt_item.status_code == 201
    assert first_receipt_item.json()["purchase_order_item_id"] == order_item_id

    first_complete = await client.post(
        f"/api/goods-receipts/{first_receipt.json()['id']}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert first_complete.status_code == 200

    first_items = await client.get(
        f"/api/purchase-orders/{order_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert first_items.status_code == 200
    assert first_items.json()[0]["received_quantity"] == "3.000"

    first_order = await client.get(
        f"/api/purchase-orders/{order_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert first_order.status_code == 200
    assert first_order.json()["status"] == "partially_received"

    second_receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": data["supplier_id"]},
    )
    assert second_receipt.status_code == 201

    second_receipt_item = await client.post(
        f"/api/goods-receipts/{second_receipt.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "received_quantity": "2",
            "unit": "piece",
            "target_bin_id": data["bin_id"],
            "purchase_order_item_id": order_item_id,
        },
    )
    assert second_receipt_item.status_code == 201

    second_complete = await client.post(
        f"/api/goods-receipts/{second_receipt.json()['id']}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert second_complete.status_code == 200

    second_items = await client.get(
        f"/api/purchase-orders/{order_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert second_items.status_code == 200
    assert second_items.json()[0]["received_quantity"] == "5.000"

    second_order = await client.get(
        f"/api/purchase-orders/{order_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert second_order.status_code == 200
    assert second_order.json()["status"] == "completed"

    over_receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": data["supplier_id"]},
    )
    assert over_receipt.status_code == 201

    over_item = await client.post(
        f"/api/goods-receipts/{over_receipt.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "received_quantity": "1",
            "unit": "piece",
            "target_bin_id": data["bin_id"],
            "purchase_order_item_id": order_item_id,
        },
    )
    assert over_item.status_code == 201

    over_complete = await client.post(
        f"/api/goods-receipts/{over_receipt.json()['id']}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert over_complete.status_code == 409
