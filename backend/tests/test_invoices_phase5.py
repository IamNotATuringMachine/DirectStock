from __future__ import annotations

import subprocess
from uuid import uuid4

import pikepdf
import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select

from app.models.phase3 import Document
from app.models.phase5 import BillingSetting, InvoiceExport

from tests.phase5_utils import auth_headers, create_base_price, create_customer, create_product, suffix


async def _create_sales_order_for_invoice(client: AsyncClient, admin_token: str, marker: str) -> dict:
    product_id = await create_product(client, admin_token, marker)
    customer_id = await create_customer(client, admin_token, marker)
    await create_base_price(client, admin_token, product_id=product_id, net_price="42.00", vat_rate="19")

    created = await client.post(
        "/api/sales-orders",
        headers=auth_headers(admin_token),
        json={
            "customer_id": customer_id,
            "currency": "EUR",
            "items": [
                {
                    "item_type": "product",
                    "product_id": product_id,
                    "quantity": "3",
                    "unit": "piece",
                }
            ],
        },
    )
    assert created.status_code == 201
    return created.json()


async def _seed_billing_settings(db_session) -> None:
    await db_session.execute(delete(BillingSetting))
    db_session.add(
        BillingSetting(
            legal_name="DirectStock GmbH",
            seller_street="Musterstr. 1",
            seller_postal_code="12345",
            seller_city="Berlin",
            seller_country_code="DE",
            payment_terms_days=14,
        )
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_invoice_create_and_over_invoicing_guard(client: AsyncClient, admin_token: str):
    order = await _create_sales_order_for_invoice(client, admin_token, f"P5INV-{suffix()}")
    order_id = order["order"]["id"]
    order_item_id = order["items"][0]["id"]

    created = await client.post(
        "/api/invoices",
        headers=auth_headers(admin_token),
        json={"sales_order_id": order_id},
    )
    assert created.status_code == 201
    invoice_id = created.json()["invoice"]["id"]
    assert created.json()["invoice"]["total_gross"] != "0.00"

    partial = await client.post(
        f"/api/invoices/{invoice_id}/partial",
        headers=auth_headers(admin_token),
        json={"items": [{"sales_order_item_id": order_item_id, "quantity": "1"}]},
    )
    assert partial.status_code == 409


@pytest.mark.asyncio
async def test_invoice_export_validation_error_without_billing_settings(
    client: AsyncClient,
    admin_token: str,
    db_session,
):
    await db_session.execute(delete(BillingSetting))
    await db_session.commit()

    order = await _create_sales_order_for_invoice(client, admin_token, f"P5EXP-{suffix()}")
    created = await client.post(
        "/api/invoices",
        headers=auth_headers(admin_token),
        json={"sales_order_id": order["order"]["id"]},
    )
    assert created.status_code == 201
    invoice_id = created.json()["invoice"]["id"]

    export = await client.post(f"/api/invoices/{invoice_id}/exports/xrechnung", headers=auth_headers(admin_token))
    assert export.status_code == 422


@pytest.mark.asyncio
async def test_invoice_export_strict_requires_kosit_runtime(
    client: AsyncClient,
    admin_token: str,
    db_session,
    monkeypatch,
):
    monkeypatch.setenv("EINVOICE_EN16931_VALIDATION_MODE", "strict")
    monkeypatch.delenv("EINVOICE_KOSIT_VALIDATOR_JAR", raising=False)
    monkeypatch.delenv("EINVOICE_KOSIT_SCENARIO", raising=False)

    await _seed_billing_settings(db_session)

    order = await _create_sales_order_for_invoice(client, admin_token, f"P5KOS-{suffix()}")
    created = await client.post(
        "/api/invoices",
        headers=auth_headers(admin_token),
        json={"sales_order_id": order["order"]["id"]},
    )
    assert created.status_code == 201
    invoice_id = created.json()["invoice"]["id"]

    export = await client.post(f"/api/invoices/{invoice_id}/exports/xrechnung", headers=auth_headers(admin_token))
    assert export.status_code == 422

    latest_export = (
        await db_session.execute(
            select(InvoiceExport)
            .where(InvoiceExport.invoice_id == invoice_id, InvoiceExport.export_type == "xrechnung")
            .order_by(InvoiceExport.id.desc())
        )
    ).scalars().first()

    assert latest_export is not None
    assert latest_export.status == "validation_error"
    report = latest_export.validator_report_json or {}
    assert report.get("error") == "validator_jar_not_configured"
    assert latest_export.document_id is None


@pytest.mark.asyncio
async def test_invoice_export_strict_success_with_kosit_runtime(
    client: AsyncClient,
    admin_token: str,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setenv("EINVOICE_EN16931_VALIDATION_MODE", "strict")
    validator_jar = tmp_path / "validator.jar"
    validator_scenario = tmp_path / "scenario.xml"
    validator_jar.write_text("fake-jar", encoding="utf-8")
    validator_scenario.write_text("<scenario/>", encoding="utf-8")
    monkeypatch.setenv("EINVOICE_KOSIT_VALIDATOR_JAR", str(validator_jar))
    monkeypatch.setenv("EINVOICE_KOSIT_SCENARIO", str(validator_scenario))
    monkeypatch.setattr("app.services.einvoice.service.shutil.which", lambda _: "/usr/bin/java")

    def _mock_run(command, *, capture_output, text):
        assert command[0] == "java"
        assert command[2] == str(validator_jar)
        assert capture_output is True
        assert text is True
        return subprocess.CompletedProcess(args=command, returncode=0, stdout="validation ok", stderr="")

    monkeypatch.setattr("app.services.einvoice.service.subprocess.run", _mock_run)

    await _seed_billing_settings(db_session)

    order = await _create_sales_order_for_invoice(client, admin_token, f"P5KOSSUCC-{suffix()}")
    created = await client.post(
        "/api/invoices",
        headers=auth_headers(admin_token),
        json={"sales_order_id": order["order"]["id"]},
    )
    assert created.status_code == 201
    invoice_id = created.json()["invoice"]["id"]

    export = await client.post(f"/api/invoices/{invoice_id}/exports/xrechnung", headers=auth_headers(admin_token))
    assert export.status_code == 200
    payload = export.json()
    assert payload["status"] == "generated"
    assert payload["validator_report"]["engine"] == "kosit"

    latest_export = (
        await db_session.execute(
            select(InvoiceExport)
            .where(InvoiceExport.invoice_id == invoice_id, InvoiceExport.export_type == "xrechnung")
            .order_by(InvoiceExport.id.desc())
        )
    ).scalars().first()
    assert latest_export is not None
    assert latest_export.status == "generated"
    assert latest_export.document_id is not None


@pytest.mark.asyncio
async def test_invoice_export_strict_validator_non_zero_sets_validation_error(
    client: AsyncClient,
    admin_token: str,
    db_session,
    monkeypatch,
    tmp_path,
):
    monkeypatch.setenv("EINVOICE_EN16931_VALIDATION_MODE", "strict")
    validator_jar = tmp_path / "validator.jar"
    validator_scenario = tmp_path / "scenario.xml"
    validator_jar.write_text("fake-jar", encoding="utf-8")
    validator_scenario.write_text("<scenario/>", encoding="utf-8")
    monkeypatch.setenv("EINVOICE_KOSIT_VALIDATOR_JAR", str(validator_jar))
    monkeypatch.setenv("EINVOICE_KOSIT_SCENARIO", str(validator_scenario))
    monkeypatch.setattr("app.services.einvoice.service.shutil.which", lambda _: "/usr/bin/java")

    def _mock_run(command, *, capture_output, text):
        return subprocess.CompletedProcess(args=command, returncode=2, stdout="", stderr="validation failed")

    monkeypatch.setattr("app.services.einvoice.service.subprocess.run", _mock_run)

    await _seed_billing_settings(db_session)

    order = await _create_sales_order_for_invoice(client, admin_token, f"P5KOSERR-{suffix()}")
    created = await client.post(
        "/api/invoices",
        headers=auth_headers(admin_token),
        json={"sales_order_id": order["order"]["id"]},
    )
    assert created.status_code == 201
    invoice_id = created.json()["invoice"]["id"]

    export = await client.post(f"/api/invoices/{invoice_id}/exports/xrechnung", headers=auth_headers(admin_token))
    assert export.status_code == 422

    latest_export = (
        await db_session.execute(
            select(InvoiceExport)
            .where(InvoiceExport.invoice_id == invoice_id, InvoiceExport.export_type == "xrechnung")
            .order_by(InvoiceExport.id.desc())
        )
    ).scalars().first()
    assert latest_export is not None
    assert latest_export.status == "validation_error"
    assert latest_export.document_id is None
    report = latest_export.validator_report_json or {}
    assert report.get("error") == "validator_non_zero_exit"


@pytest.mark.asyncio
async def test_zugferd_export_embeds_invoice_xml_and_pdfa_metadata(
    client: AsyncClient,
    admin_token: str,
    db_session,
    monkeypatch,
):
    monkeypatch.setenv("EINVOICE_EN16931_VALIDATION_MODE", "builtin_fallback")
    monkeypatch.delenv("EINVOICE_KOSIT_VALIDATOR_JAR", raising=False)
    monkeypatch.delenv("EINVOICE_KOSIT_SCENARIO", raising=False)

    await _seed_billing_settings(db_session)

    order = await _create_sales_order_for_invoice(client, admin_token, f"P5ZUG-{suffix()}")
    created = await client.post(
        "/api/invoices",
        headers=auth_headers(admin_token),
        json={"sales_order_id": order["order"]["id"]},
    )
    assert created.status_code == 201
    invoice = created.json()["invoice"]
    invoice_id = invoice["id"]
    invoice_number = invoice["invoice_number"]

    export_response = await client.post(f"/api/invoices/{invoice_id}/exports/zugferd", headers=auth_headers(admin_token))
    assert export_response.status_code == 200
    export_payload = export_response.json()
    assert export_payload["status"] == "generated"

    latest_export = (
        await db_session.execute(
            select(InvoiceExport)
            .where(InvoiceExport.invoice_id == invoice_id, InvoiceExport.export_type == "zugferd")
            .order_by(InvoiceExport.id.desc())
        )
    ).scalars().first()
    assert latest_export is not None
    assert latest_export.status == "generated"
    assert latest_export.document_id is not None

    document = (
        await db_session.execute(select(Document).where(Document.id == latest_export.document_id))
    ).scalar_one_or_none()
    assert document is not None
    assert document.mime_type == "application/pdf"

    with pikepdf.open(document.storage_path) as pdf:
        assert "/AF" in pdf.Root
        assert len(pdf.Root.AF) == 1
        filespec = pdf.Root.AF[0]
        assert str(filespec.AFRelationship) == "/Data"
        assert filespec.F == f"{invoice_number}-xrechnung.xml"
        xml_payload = filespec.EF.F.read_bytes()
        assert b"<rsm:CrossIndustryInvoice" in xml_payload
        assert invoice_number.encode("utf-8") in xml_payload

        metadata_bytes = pdf.Root.Metadata.read_bytes()
        assert b"<pdfaid:part>3</pdfaid:part>" in metadata_bytes
        assert b"<pdfaid:conformance>B</pdfaid:conformance>" in metadata_bytes


@pytest.mark.asyncio
async def test_invoice_create_idempotent(client: AsyncClient, admin_token: str):
    order = await _create_sales_order_for_invoice(client, admin_token, f"P5IID-{suffix()}")
    payload = {"sales_order_id": order["order"]["id"]}
    headers = {**auth_headers(admin_token), "X-Client-Operation-Id": f"op-{uuid4().hex[:10]}"}

    first = await client.post("/api/invoices", headers=headers, json=payload)
    second = await client.post("/api/invoices", headers=headers, json=payload)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["invoice"]["id"] == second.json()["invoice"]["id"]
