from io import BytesIO

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_document_upload_list_download_delete(client: AsyncClient, admin_token: str):
    files = {
        "file": ("sample.pdf", BytesIO(b"%PDF-1.4\n%test\n"), "application/pdf"),
    }
    data = {
        "entity_type": "purchase_order",
        "entity_id": "1",
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
        "/api/documents?entity_type=purchase_order&entity_id=1&document_type=attachment",
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
