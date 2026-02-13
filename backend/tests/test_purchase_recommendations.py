from uuid import uuid4

import pytest
from httpx import AsyncClient

from phase3_utils import create_product_and_bin, create_supplier


def _suffix() -> str:
    return uuid4().hex[:8].upper()


@pytest.mark.asyncio
async def test_purchase_recommendations_generate_convert_and_dismiss(client: AsyncClient, admin_token: str):
    prefix = f"PR-{_suffix()}"
    data = await create_product_and_bin(client, admin_token, prefix)
    supplier_id = await create_supplier(client, admin_token, prefix)

    relation = await client.post(
        f"/api/products/{data['product_id']}/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_id": supplier_id,
            "supplier_product_number": f"{prefix}-SUP-ART",
            "price": "10.00",
            "lead_time_days": 3,
            "min_order_quantity": "5",
            "is_preferred": True,
        },
    )
    assert relation.status_code == 201

    setting = await client.put(
        f"/api/products/{data['product_id']}/warehouse-settings/{data['warehouse_id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "min_stock": "10",
            "reorder_point": "12",
            "safety_stock": "3",
        },
    )
    assert setting.status_code == 200

    generated = await client.post(
        "/api/purchase-recommendations/generate",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"warehouse_id": data["warehouse_id"]},
    )
    assert generated.status_code == 200
    assert generated.json()["total"] >= 1

    recommendation_id = generated.json()["items"][0]["id"]

    converted = await client.post(
        f"/api/purchase-recommendations/{recommendation_id}/convert-to-po",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert converted.status_code == 200
    assert converted.json()["purchase_order_id"] > 0

    dismissed = await client.post(
        f"/api/purchase-recommendations/{recommendation_id}/dismiss",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert dismissed.status_code == 200
    assert dismissed.json()["status"] == "dismissed"
