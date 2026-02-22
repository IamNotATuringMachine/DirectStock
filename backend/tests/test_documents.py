from io import BytesIO
from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_document_upload_list_download_delete(client: AsyncClient, admin_token: str):
    suffix = uuid4().hex[:8].upper()
    supplier = await client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_number": f"DOC-SUP-{suffix}",
            "company_name": "Document Supplier",
            "is_active": True,
        },
    )
    assert supplier.status_code == 201

    order = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": supplier.json()["id"], "notes": "Document test"},
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    files = {
        "file": ("sample.pdf", BytesIO(b"%PDF-1.4\n%test\n"), "application/pdf"),
    }
    data = {
        "entity_type": "purchase_order",
        "entity_id": str(order_id),
        "document_type": "attachment",
    }

    uploaded = await client.post(
        "/api/documents",
        headers={"Authorization": f"Bearer {admin_token}"},
        files=files,
        data=data,
    )
    assert uploaded.status_code == 201
    doc_id = uploaded.json()["id"]

    listed = await client.get(
        f"/api/documents?entity_type=purchase_order&entity_id={order_id}&document_type=attachment",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1

    downloaded = await client.get(
        f"/api/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert downloaded.status_code == 200
    assert downloaded.headers["content-type"].startswith("application/pdf")

    deleted = await client.delete(
        f"/api/documents/{doc_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_document_upload_accepts_rfc822_eml(client: AsyncClient, admin_token: str):
    suffix = uuid4().hex[:8].upper()
    supplier = await client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_number": f"DOC-EML-{suffix}",
            "company_name": "Document EML Supplier",
            "is_active": True,
        },
    )
    assert supplier.status_code == 201

    order = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": supplier.json()["id"], "notes": "EML test"},
    )
    assert order.status_code == 201

    eml_body = b"From: supplier@example.test\nTo: einkauf@example.test\nSubject: Reply\n\nBestellbestaetigung\n"
    upload = await client.post(
        "/api/documents",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("reply.eml", BytesIO(eml_body), "message/rfc822")},
        data={
            "entity_type": "purchase_order",
            "entity_id": str(order.json()["id"]),
            "document_type": "supplier_reply_email",
        },
    )
    assert upload.status_code == 201
    assert upload.json()["mime_type"] == "message/rfc822"
