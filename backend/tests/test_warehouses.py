from io import BytesIO
from decimal import Decimal

import pikepdf
import pytest
from httpx import AsyncClient
from PIL import Image, ImageChops

from app.models.inventory import Inventory
from app.utils.qr_generator import format_bin_label_name


@pytest.mark.asyncio
async def test_warehouse_zone_bin_flow(client: AsyncClient, admin_token: str, db_session):
    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "WH-1", "name": "Main Warehouse", "address": "Berlin", "is_active": True},
    )
    assert warehouse.status_code == 201
    warehouse_id = warehouse.json()["id"]

    zone = await client.post(
        f"/api/warehouses/{warehouse_id}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "A", "name": "Storage A", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201
    zone_id = zone.json()["id"]

    batch = await client.post(
        f"/api/zones/{zone_id}/bins/batch",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "prefix": "A",
            "aisle_from": 1,
            "aisle_to": 2,
            "shelf_from": 1,
            "shelf_to": 2,
            "level_from": 1,
            "level_to": 1,
            "bin_type": "storage",
        },
    )
    assert batch.status_code == 200
    assert batch.json()["created_count"] == 4

    bins = await client.get(
        f"/api/zones/{zone_id}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert bins.status_code == 200
    assert len(bins.json()) == 4
    assert "is_occupied" in bins.json()[0]
    assert "occupied_quantity" in bins.json()[0]

    first_bin = bins.json()[0]
    db_session.add(
        Inventory(
            product_id=1,
            bin_location_id=first_bin["id"],
            quantity=Decimal("3"),
            reserved_quantity=Decimal("0"),
            unit="piece",
        )
    )
    await db_session.commit()

    bins_after_stock = await client.get(
        f"/api/zones/{zone_id}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert bins_after_stock.status_code == 200
    occupied_row = next(item for item in bins_after_stock.json() if item["id"] == first_bin["id"])
    assert occupied_row["is_occupied"] is True
    assert Decimal(occupied_row["occupied_quantity"]) == Decimal("3")

    qr_lookup = await client.get(
        f"/api/bins/by-qr/{first_bin['qr_code_data']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert qr_lookup.status_code == 200
    assert qr_lookup.json()["id"] == first_bin["id"]
    assert qr_lookup.json()["is_occupied"] is True
    assert Decimal(qr_lookup.json()["occupied_quantity"]) == Decimal("3")

    qr_png = await client.get(
        f"/api/bins/{first_bin['id']}/qr-code",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert qr_png.status_code == 200
    assert qr_png.headers["content-type"] == "image/png"
    assert len(qr_png.content) > 100
    with Image.open(BytesIO(qr_png.content)) as image:
        rgb = image.convert("RGB")
        assert rgb.height > rgb.width
        caption_band = rgb.crop((0, int(rgb.height * 0.8), rgb.width, rgb.height))
        assert ImageChops.invert(caption_band.convert("L")).getbbox() is not None

    qr_pdf = await client.post(
        "/api/bins/qr-codes/pdf",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"bin_ids": [first_bin["id"]]},
    )
    assert qr_pdf.status_code == 200
    assert qr_pdf.headers["content-type"] == "application/pdf"
    assert qr_pdf.content.startswith(b"%PDF")
    with pikepdf.open(BytesIO(qr_pdf.content)) as pdf:
        page_contents = pdf.pages[0].Contents
        if isinstance(page_contents, pikepdf.Array):
            content_bytes = b"".join(stream.read_bytes() for stream in page_contents)
        else:
            content_bytes = page_contents.read_bytes()
    expected_label = format_bin_label_name(first_bin["code"]).encode("utf-8")
    assert expected_label in content_bytes


@pytest.mark.asyncio
async def test_non_admin_non_lagerleiter_cannot_mutate_warehouse(client: AsyncClient, admin_token: str):
    create_worker = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "warehouse_worker",
            "email": "warehouse_worker@example.com",
            "full_name": "Warehouse Worker",
            "password": "WarehouseWorker123!",
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert create_worker.status_code == 201

    login = await client.post(
        "/api/auth/login",
        json={"username": "warehouse_worker", "password": "WarehouseWorker123!"},
    )
    worker_token = login.json()["access_token"]

    forbidden = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={"code": "WH-2", "name": "No Access", "address": "-", "is_active": True},
    )
    assert forbidden.status_code == 403
