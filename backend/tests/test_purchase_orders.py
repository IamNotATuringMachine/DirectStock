from email.message import EmailMessage
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.services.purchasing import email_workflow as purchasing_email_workflow


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    supplier = await client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_number": f"PO-SUP-{prefix}",
            "company_name": "PO Supplier",
            "email": f"lieferant-{prefix.lower()}@example.test",
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

    confirmed = await client.patch(
        f"/api/purchase-orders/{order_id}/supplier-confirmation",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_comm_status": "confirmed_undetermined"},
    )
    assert confirmed.status_code == 200

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


@pytest.mark.asyncio
async def test_purchase_order_resolve_by_order_number_returns_open_items(client: AsyncClient, admin_token: str):
    suffix = _suffix()
    data = await _create_master_data(client, admin_token, suffix)

    order_id, order_item_id = await _create_order_with_item(
        client,
        admin_token,
        supplier_id=data["supplier_id"],
        product_id=data["product_id"],
        ordered_quantity="5",
    )
    order_detail = await client.get(
        f"/api/purchase-orders/{order_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert order_detail.status_code == 200
    order_number = order_detail.json()["order_number"]

    resolved = await client.get(
        "/api/purchase-orders/resolve",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"order_number": order_number},
    )
    assert resolved.status_code == 200
    payload = resolved.json()
    assert payload["order"]["id"] == order_id
    assert len(payload["items"]) == 1
    assert payload["items"][0]["id"] == order_item_id
    assert payload["items"][0]["open_quantity"] == "5.000"

    receipt = await client.post(
        "/api/goods-receipts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": data["supplier_id"]},
    )
    assert receipt.status_code == 201

    receipt_item = await client.post(
        f"/api/goods-receipts/{receipt.json()['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "received_quantity": "2",
            "unit": "piece",
            "target_bin_id": data["bin_id"],
            "purchase_order_item_id": order_item_id,
        },
    )
    assert receipt_item.status_code == 201

    complete = await client.post(
        f"/api/goods-receipts/{receipt.json()['id']}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 200

    resolved_after = await client.get(
        "/api/purchase-orders/resolve",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"order_number": order_number},
    )
    assert resolved_after.status_code == 200
    assert resolved_after.json()["items"][0]["open_quantity"] == "3.000"


@pytest.mark.asyncio
async def test_create_goods_receipt_from_po_uses_strict_soll_ist_defaults(client: AsyncClient, admin_token: str):
    suffix = _suffix()
    data = await _create_master_data(client, admin_token, suffix)

    order_id, _ = await _create_order_with_item(
        client,
        admin_token,
        supplier_id=data["supplier_id"],
        product_id=data["product_id"],
        ordered_quantity="7",
    )

    receipt = await client.post(
        f"/api/goods-receipts/from-po/{order_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert receipt.status_code == 201
    receipt_payload = receipt.json()
    assert receipt_payload["purchase_order_id"] == order_id
    assert receipt_payload["mode"] == "po"
    assert receipt_payload["source_type"] == "supplier"

    items = await client.get(
        f"/api/goods-receipts/{receipt_payload['id']}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert items.status_code == 200
    assert len(items.json()) == 1
    assert items.json()[0]["expected_quantity"] == "7.000"
    assert items.json()[0]["expected_open_quantity"] == "7.000"
    assert items.json()[0]["received_quantity"] == "0.000"

    complete = await client.post(
        f"/api/goods-receipts/{receipt_payload['id']}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete.status_code == 422


@pytest.mark.asyncio
async def test_send_purchase_order_email_happy_path(client: AsyncClient, admin_token: str):
    suffix = _suffix()
    data = await _create_master_data(client, admin_token, suffix)

    order = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": data["supplier_id"], "notes": "Mail send test"},
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    item = await client.post(
        f"/api/purchase-orders/{order_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_id": data["product_id"],
            "ordered_quantity": "4",
            "unit": "piece",
        },
    )
    assert item.status_code == 201

    approved = await client.post(
        f"/api/purchase-orders/{order_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "approved"},
    )
    assert approved.status_code == 200

    sent = await client.post(
        f"/api/purchase-orders/{order_id}/send-email",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert sent.status_code == 200
    sent_payload = sent.json()
    assert sent_payload["communication_event_id"] > 0
    assert sent_payload["document_id"] > 0
    assert sent_payload["message_id"].startswith("<")

    order_detail = await client.get(
        f"/api/purchase-orders/{order_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert order_detail.status_code == 200
    assert order_detail.json()["supplier_comm_status"] == "waiting_reply"
    assert order_detail.json()["supplier_email_sent_at"] is not None
    assert order_detail.json()["status"] == "ordered"

    communications = await client.get(
        f"/api/purchase-orders/{order_id}/communications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert communications.status_code == 200
    assert any(
        event["direction"] == "outbound" and event["event_type"] == "sent"
        for event in communications.json()["items"]
    )

    documents = await client.get(
        "/api/documents",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={
            "entity_type": "purchase_order",
            "entity_id": order_id,
            "document_type": "purchase_order_pdf",
        },
    )
    assert documents.status_code == 200
    assert documents.json()["total"] >= 1


@pytest.mark.asyncio
async def test_send_purchase_order_email_uses_multiple_to_and_cc_addresses(client: AsyncClient, admin_token: str):
    suffix = _suffix()
    data = await _create_master_data(client, admin_token, suffix)

    supplier_update = await client.put(
        f"/api/suppliers/{data['supplier_id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "company_name": "PO Supplier",
            "email": f"lieferant-{suffix.lower()}@example.test;weitere-{suffix.lower()}@example.test",
        },
    )
    assert supplier_update.status_code == 200

    settings_saved = await client.put(
        "/api/purchase-email-settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "profiles": [
                {
                    "profile_name": "Gmail Test",
                    "is_active": True,
                    "smtp_enabled": False,
                    "smtp_port": 587,
                    "smtp_use_tls": True,
                    "from_address": "einkauf@example.test",
                    "reply_to_address": "antwort@example.test",
                    "sender_name": "Einkauf Team",
                    "imap_enabled": False,
                    "imap_port": 993,
                    "imap_mailbox": "INBOX",
                    "imap_use_ssl": True,
                    "poll_interval_seconds": 300,
                    "default_to_addresses": f"team-{suffix.lower()}@example.test",
                    "default_cc_addresses": f"cc1-{suffix.lower()}@example.test,cc2-{suffix.lower()}@example.test",
                }
            ]
        },
    )
    assert settings_saved.status_code == 200
    assert settings_saved.json()["active_profile_id"] > 0

    order = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": data["supplier_id"]},
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    item = await client.post(
        f"/api/purchase-orders/{order_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"product_id": data["product_id"], "ordered_quantity": "2", "unit": "piece"},
    )
    assert item.status_code == 201

    sent = await client.post(
        f"/api/purchase-orders/{order_id}/send-email",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert sent.status_code == 200

    communications = await client.get(
        f"/api/purchase-orders/{order_id}/communications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert communications.status_code == 200
    sent_event = next(
        event
        for event in communications.json()["items"]
        if event["direction"] == "outbound" and event["event_type"] == "sent"
    )
    assert f"lieferant-{suffix.lower()}@example.test" in sent_event["to_address"]
    assert f"weitere-{suffix.lower()}@example.test" in sent_event["to_address"]
    assert f"team-{suffix.lower()}@example.test" in sent_event["to_address"]
    assert sent_event["metadata_json"]["cc_addresses"] == [
        f"cc1-{suffix.lower()}@example.test",
        f"cc2-{suffix.lower()}@example.test",
    ]


@pytest.mark.asyncio
async def test_send_purchase_order_email_validation_and_failure_cases(client: AsyncClient, admin_token: str, monkeypatch):
    suffix = _suffix()
    data = await _create_master_data(client, admin_token, suffix)

    reset_settings = await client.put(
        "/api/purchase-email-settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "profiles": [
                {
                    "profile_name": "Reset",
                    "is_active": True,
                    "smtp_enabled": False,
                    "smtp_port": 587,
                    "smtp_use_tls": True,
                    "from_address": "einkauf@example.test",
                    "reply_to_address": "antwort@example.test",
                    "sender_name": "Einkauf",
                    "imap_enabled": False,
                    "imap_port": 993,
                    "imap_mailbox": "INBOX",
                    "imap_use_ssl": True,
                    "poll_interval_seconds": 300,
                    "default_to_addresses": "",
                    "default_cc_addresses": "",
                }
            ]
        },
    )
    assert reset_settings.status_code == 200

    supplier_without_email = await client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_number": f"PO-SUP-NE-{suffix}",
            "company_name": "No Email Supplier",
            "is_active": True,
        },
    )
    assert supplier_without_email.status_code == 201

    order_no_email = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": supplier_without_email.json()["id"]},
    )
    assert order_no_email.status_code == 201
    order_no_email_id = order_no_email.json()["id"]

    item_no_email = await client.post(
        f"/api/purchase-orders/{order_no_email_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"product_id": data["product_id"], "ordered_quantity": "1", "unit": "piece"},
    )
    assert item_no_email.status_code == 201

    send_without_email = await client.post(
        f"/api/purchase-orders/{order_no_email_id}/send-email",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert send_without_email.status_code == 422

    order_without_items = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": data["supplier_id"]},
    )
    assert order_without_items.status_code == 201

    send_without_items = await client.post(
        f"/api/purchase-orders/{order_without_items.json()['id']}/send-email",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert send_without_items.status_code == 409

    order_smtp_error = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": data["supplier_id"]},
    )
    assert order_smtp_error.status_code == 201
    order_smtp_error_id = order_smtp_error.json()["id"]

    smtp_item = await client.post(
        f"/api/purchase-orders/{order_smtp_error_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"product_id": data["product_id"], "ordered_quantity": "2", "unit": "piece"},
    )
    assert smtp_item.status_code == 201

    monkeypatch.setattr(
        purchasing_email_workflow,
        "_send_email_sync",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("smtp down")),
    )

    smtp_failure = await client.post(
        f"/api/purchase-orders/{order_smtp_error_id}/send-email",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert smtp_failure.status_code == 502

    order_after_failure = await client.get(
        f"/api/purchase-orders/{order_smtp_error_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert order_after_failure.status_code == 200
    assert order_after_failure.json()["supplier_comm_status"] == "open_unsent"

    events = await client.get(
        f"/api/purchase-orders/{order_smtp_error_id}/communications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert events.status_code == 200
    assert any(event["event_type"] == "failed" for event in events.json()["items"])


@pytest.mark.asyncio
async def test_purchase_order_reply_import_and_dedupe(client: AsyncClient, admin_token: str, monkeypatch):
    suffix = _suffix()
    data = await _create_master_data(client, admin_token, suffix)

    order = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": data["supplier_id"]},
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    item = await client.post(
        f"/api/purchase-orders/{order_id}/items",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"product_id": data["product_id"], "ordered_quantity": "3", "unit": "piece"},
    )
    assert item.status_code == 201

    sent = await client.post(
        f"/api/purchase-orders/{order_id}/send-email",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert sent.status_code == 200
    outbound_message_id = sent.json()["message_id"]

    reply = EmailMessage()
    reply["From"] = "supplier@example.test"
    reply["To"] = "einkauf@example.test"
    reply["Subject"] = f"Re: Bestellung {order.json()['order_number']}"
    reply["Message-ID"] = "<reply-message-id-1@example.test>"
    reply["In-Reply-To"] = outbound_message_id
    reply["References"] = outbound_message_id
    reply.set_content("Wir bestaetigen den Auftrag. Liefertermin folgt.")
    raw_reply = reply.as_bytes()

    monkeypatch.setattr(
        purchasing_email_workflow,
        "_fetch_imap_messages_sync",
        lambda settings, max_messages: [raw_reply],
    )
    sync_settings = await client.put(
        "/api/purchase-email-settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "profiles": [
                {
                    "profile_name": "IMAP Sync",
                    "is_active": True,
                    "smtp_enabled": False,
                    "smtp_port": 587,
                    "smtp_use_tls": True,
                    "from_address": "einkauf@example.test",
                    "reply_to_address": "antwort@example.test",
                    "sender_name": "Einkauf",
                    "imap_enabled": True,
                    "imap_host": "imap.example.test",
                    "imap_port": 993,
                    "imap_username": "user",
                    "imap_password": "pass",
                    "imap_mailbox": "INBOX",
                    "imap_use_ssl": True,
                    "poll_interval_seconds": 300,
                }
            ]
        },
    )
    assert sync_settings.status_code == 200

    first_sync = await client.post(
        "/api/purchase-orders/mail-sync",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert first_sync.status_code == 200
    assert first_sync.json()["processed"] == 1
    assert first_sync.json()["matched"] == 1
    assert first_sync.json()["skipped"] == 0
    assert len(first_sync.json()["imported_document_ids"]) == 1

    order_after_sync = await client.get(
        f"/api/purchase-orders/{order_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert order_after_sync.status_code == 200
    assert order_after_sync.json()["supplier_comm_status"] == "reply_received_pending"
    assert order_after_sync.json()["supplier_reply_received_at"] is not None

    communications = await client.get(
        f"/api/purchase-orders/{order_id}/communications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert communications.status_code == 200
    inbound_events = [event for event in communications.json()["items"] if event["direction"] == "inbound"]
    assert len(inbound_events) == 1
    assert inbound_events[0]["event_type"] == "received"
    assert inbound_events[0]["document_id"] is not None

    documents = await client.get(
        "/api/documents",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={
            "entity_type": "purchase_order",
            "entity_id": order_id,
            "document_type": "supplier_reply_email",
        },
    )
    assert documents.status_code == 200
    assert documents.json()["total"] == 1
    assert documents.json()["items"][0]["mime_type"] == "message/rfc822"

    second_sync = await client.post(
        "/api/purchase-orders/mail-sync",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert second_sync.status_code == 200
    assert second_sync.json()["processed"] == 1
    assert second_sync.json()["matched"] == 0
    assert second_sync.json()["skipped"] == 1


@pytest.mark.asyncio
async def test_supplier_confirmation_validation_rules(client: AsyncClient, admin_token: str):
    suffix = _suffix()
    data = await _create_master_data(client, admin_token, suffix)

    order = await client.post(
        "/api/purchase-orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_id": data["supplier_id"]},
    )
    assert order.status_code == 201
    order_id = order.json()["id"]

    invalid_with_date = await client.patch(
        f"/api/purchase-orders/{order_id}/supplier-confirmation",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"supplier_comm_status": "confirmed_with_date"},
    )
    assert invalid_with_date.status_code == 422

    invalid_undetermined = await client.patch(
        f"/api/purchase-orders/{order_id}/supplier-confirmation",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_comm_status": "confirmed_undetermined",
            "supplier_delivery_date": "2026-03-01",
        },
    )
    assert invalid_undetermined.status_code == 422

    valid_with_date = await client.patch(
        f"/api/purchase-orders/{order_id}/supplier-confirmation",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_comm_status": "confirmed_with_date",
            "supplier_delivery_date": "2026-03-01",
            "supplier_last_reply_note": "Lieferung Anfang Maerz",
        },
    )
    assert valid_with_date.status_code == 200
    assert valid_with_date.json()["supplier_comm_status"] == "confirmed_with_date"
    assert valid_with_date.json()["supplier_delivery_date"] == "2026-03-01"


@pytest.mark.asyncio
async def test_supplier_purchase_email_template_save_load_and_validate(client: AsyncClient, admin_token: str):
    suffix = _suffix()
    supplier = await client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "supplier_number": f"TPL-{suffix}",
            "company_name": "Template Supplier",
            "email": "template@example.test",
            "is_active": True,
        },
    )
    assert supplier.status_code == 201
    supplier_id = supplier.json()["id"]

    updated = await client.put(
        f"/api/suppliers/{supplier_id}/purchase-email-template",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "salutation": "Guten Tag {supplier_company_name},",
            "subject_template": "Bestellung {order_number}",
            "body_template": "{salutation}\n{items_table}",
            "signature": "Viele Gruesse\n{sender_name}",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["supplier_id"] == supplier_id
    assert updated.json()["subject_template"] == "Bestellung {order_number}"

    loaded = await client.get(
        f"/api/suppliers/{supplier_id}/purchase-email-template",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert loaded.status_code == 200
    assert loaded.json()["body_template"] == "{salutation}\n{items_table}"

    invalid = await client.put(
        f"/api/suppliers/{supplier_id}/purchase-email-template",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "salutation": "Hallo {unknown_token}",
            "subject_template": "Bestellung {order_number}",
            "body_template": "Test",
            "signature": "Signatur",
        },
    )
    assert invalid.status_code == 422


@pytest.mark.asyncio
async def test_purchase_email_settings_read_update_and_password_flags(client: AsyncClient, admin_token: str):
    initial = await client.get(
        "/api/purchase-email-settings",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert initial.status_code == 200
    assert initial.json()["active_profile_id"] > 0
    assert len(initial.json()["profiles"]) >= 1

    saved = await client.put(
        "/api/purchase-email-settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "profiles": [
                {
                    "profile_name": "Gmail Test",
                    "is_active": True,
                    "smtp_enabled": True,
                    "smtp_host": "smtp.example.test",
                    "smtp_port": 2525,
                    "smtp_username": "smtp-user",
                    "smtp_password": "smtp-secret",
                    "smtp_use_tls": False,
                    "from_address": "einkauf@example.test",
                    "reply_to_address": "antwort@example.test",
                    "sender_name": "Einkauf Team",
                    "imap_enabled": True,
                    "imap_host": "imap.example.test",
                    "imap_port": 993,
                    "imap_username": "imap-user",
                    "imap_password": "imap-secret",
                    "imap_mailbox": "INBOX",
                    "imap_use_ssl": True,
                    "poll_interval_seconds": 420,
                    "default_to_addresses": "lieferant@example.test,team@example.test",
                    "default_cc_addresses": "cc@example.test",
                },
                {
                    "profile_name": "Backup",
                    "is_active": False,
                    "smtp_enabled": False,
                    "smtp_port": 587,
                    "smtp_use_tls": True,
                    "from_address": "backup@example.test",
                    "reply_to_address": "backup@example.test",
                    "sender_name": "Backup",
                    "imap_enabled": False,
                    "imap_port": 993,
                    "imap_mailbox": "INBOX",
                    "imap_use_ssl": True,
                    "poll_interval_seconds": 300,
                },
            ]
        },
    )
    assert saved.status_code == 200
    payload = saved.json()
    assert payload["active_profile_id"] > 0
    assert len(payload["profiles"]) == 2
    active = next(item for item in payload["profiles"] if item["is_active"] is True)
    assert active["profile_name"] == "Gmail Test"
    assert active["smtp_host"] == "smtp.example.test"
    assert active["smtp_port"] == 2525
    assert active["smtp_username"] == "smtp-user"
    assert active["smtp_password_set"] is True
    assert active["from_address"] == "einkauf@example.test"
    assert active["imap_host"] == "imap.example.test"
    assert active["imap_password_set"] is True
    assert active["poll_interval_seconds"] == 420
    assert active["default_to_addresses"] == "lieferant@example.test,team@example.test"
    assert active["default_cc_addresses"] == "cc@example.test"

    cleared = await client.put(
        "/api/purchase-email-settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "profiles": [
                {
                    "id": active["id"],
                    "profile_name": active["profile_name"],
                    "is_active": True,
                    "smtp_enabled": active["smtp_enabled"],
                    "smtp_host": active["smtp_host"],
                    "smtp_port": active["smtp_port"],
                    "smtp_username": active["smtp_username"],
                    "clear_smtp_password": True,
                    "smtp_use_tls": active["smtp_use_tls"],
                    "from_address": active["from_address"],
                    "reply_to_address": active["reply_to_address"],
                    "sender_name": active["sender_name"],
                    "imap_enabled": active["imap_enabled"],
                    "imap_host": active["imap_host"],
                    "imap_port": active["imap_port"],
                    "imap_username": active["imap_username"],
                    "clear_imap_password": True,
                    "imap_mailbox": active["imap_mailbox"],
                    "imap_use_ssl": active["imap_use_ssl"],
                    "poll_interval_seconds": active["poll_interval_seconds"],
                    "default_to_addresses": active["default_to_addresses"],
                    "default_cc_addresses": active["default_cc_addresses"],
                }
            ]
        },
    )
    assert cleared.status_code == 200
    cleared_active = next(item for item in cleared.json()["profiles"] if item["is_active"] is True)
    assert cleared_active["smtp_password_set"] is False
    assert cleared_active["imap_password_set"] is False
