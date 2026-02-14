import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

import pikepdf
from PIL import ImageCms
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


@dataclass(slots=True)
class EinvoiceValidationError(Exception):
    message: str
    report: dict


REQUIRED_BILLING_FIELDS = [
    "legal_name",
    "seller_street",
    "seller_postal_code",
    "seller_city",
    "seller_country_code",
]


def validate_export_prerequisites(*, invoice, invoice_items: list, billing_settings) -> None:
    missing = [field for field in REQUIRED_BILLING_FIELDS if not getattr(billing_settings, field, None)]
    if missing:
        raise EinvoiceValidationError(
            message="Billing settings are incomplete",
            report={"valid": False, "missing_fields": missing, "stage": "billing_settings"},
        )

    if not invoice_items:
        raise EinvoiceValidationError(
            message="Invoice has no items",
            report={"valid": False, "stage": "invoice_items", "message": "Invoice has no positions"},
        )

    if Decimal(invoice.total_gross) <= Decimal("0"):
        raise EinvoiceValidationError(
            message="Invoice total must be > 0",
            report={"valid": False, "stage": "totals", "message": "total_gross must be > 0"},
        )


def build_xrechnung_xml(*, invoice, invoice_items: list, billing_settings) -> bytes:
    issue_date = invoice.issued_at or datetime.now(UTC)
    due_date = invoice.due_at or issue_date
    lines = []
    for index, item in enumerate(invoice_items, start=1):
        lines.append(
            f"""
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>{index}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>{(item.description or f'Line {index}')[:120]}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>{item.net_unit_price}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">{item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>{item.vat_rate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>{item.net_total}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
            """.strip()
        )

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocument>
    <ram:ID>{invoice.invoice_number}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">{issue_date.strftime('%Y%m%d')}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    {''.join(lines)}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>{billing_settings.legal_name}</ram:Name>
      </ram:SellerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>{invoice.currency}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>Zahlbar bis {due_date.date().isoformat()}</ram:Description>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>{invoice.total_net}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>{invoice.total_net}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="{invoice.currency}">{invoice.total_tax}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>{invoice.total_gross}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>{invoice.total_gross}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
"""
    return xml.encode("utf-8")


def _builtin_en16931_checks(xml_bytes: bytes) -> dict:
    text = xml_bytes.decode("utf-8", errors="ignore")
    required_tokens = [
        "<rsm:CrossIndustryInvoice",
        "<ram:ID>",
        "<ram:SellerTradeParty>",
        "<ram:GrandTotalAmount>",
    ]
    missing = [token for token in required_tokens if token not in text]
    valid = len(missing) == 0
    return {
        "valid": valid,
        "engine": "builtin-minimal",
        "missing_tokens": missing,
    }


def _validation_mode() -> str:
    raw = os.getenv("EINVOICE_EN16931_VALIDATION_MODE", "strict").strip().lower()
    if raw in {"strict", "builtin_fallback"}:
        return raw
    return "strict"


def validate_en16931(xml_bytes: bytes) -> dict:
    mode = _validation_mode()
    validator_jar = os.getenv("EINVOICE_KOSIT_VALIDATOR_JAR", "").strip()
    validator_scenario = os.getenv("EINVOICE_KOSIT_SCENARIO", "").strip()

    def _builtin_or_raise(error_code: str, message: str, *, report_extra: dict | None = None) -> dict:
        if mode == "builtin_fallback":
            report = _builtin_en16931_checks(xml_bytes)
            report["mode"] = mode
            report["fallback_reason"] = error_code
            if report_extra:
                report.update(report_extra)
            if not report["valid"]:
                raise EinvoiceValidationError(message="EN16931 validation failed", report=report)
            return report
        report = {"valid": False, "engine": "kosit", "mode": mode, "error": error_code}
        if report_extra:
            report.update(report_extra)
        raise EinvoiceValidationError(message=message, report=report)

    if not validator_jar:
        return _builtin_or_raise(
            "validator_jar_not_configured",
            "KoSIT validator jar is required for strict EN16931 validation",
        )

    if not Path(validator_jar).exists():
        return _builtin_or_raise(
            "validator_jar_missing",
            "Configured KoSIT validator jar not found",
            report_extra={"validator_jar": validator_jar},
        )

    if not validator_scenario:
        return _builtin_or_raise(
            "validator_scenario_not_configured",
            "KoSIT scenario is required for strict EN16931 validation",
        )

    if not Path(validator_scenario).exists():
        return _builtin_or_raise(
            "validator_scenario_missing",
            "Configured KoSIT scenario not found",
            report_extra={"validator_scenario": validator_scenario},
        )

    if shutil.which("java") is None:
        return _builtin_or_raise(
            "java_not_found",
            "Java runtime is required to execute KoSIT validator",
        )

    with tempfile.TemporaryDirectory(prefix="einvoice-kosit-") as temp_dir:
        temp_dir_path = Path(temp_dir)
        input_file = temp_dir_path / "invoice.xml"
        input_file.write_bytes(xml_bytes)
        output_dir = temp_dir_path / "out"
        output_dir.mkdir(parents=True, exist_ok=True)

        command = [
            "java",
            "-jar",
            validator_jar,
            "-s",
            validator_scenario,
            "-o",
            str(output_dir),
            str(input_file),
        ]
        try:
            process = subprocess.run(command, capture_output=True, text=True)
        except OSError as exc:
            return _builtin_or_raise(
                "validator_execution_error",
                "KoSIT validator execution failed",
                report_extra={"exception": str(exc)},
            )

        if process.returncode != 0:
            return _builtin_or_raise(
                "validator_non_zero_exit",
                "KoSIT validator returned non-zero exit code",
                report_extra={
                    "return_code": process.returncode,
                    "stdout": process.stdout[-4000:],
                    "stderr": process.stderr[-4000:],
                },
            )

        report = {
            "valid": True,
            "engine": "kosit",
            "return_code": process.returncode,
            "stdout": process.stdout[-4000:],
            "stderr": process.stderr[-4000:],
        }
        return report


def _pdf_datetime_string(value: datetime) -> str:
    normalized = value.astimezone(UTC)
    return normalized.strftime("D:%Y%m%d%H%M%S+00'00'")


def _factur_x_xml_file_name(invoice_number: str) -> str:
    return f"{invoice_number}-xrechnung.xml"


def _build_pdfa3_metadata_xml(*, invoice_number: str, xml_file_name: str, created_at: datetime) -> bytes:
    created_iso = created_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    escaped_invoice = escape(invoice_number)
    escaped_xml_name = escape(xml_file_name)
    xmp = f"""<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">Rechnung {escaped_invoice}</rdf:li>
        </rdf:Alt>
      </dc:title>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreateDate>{created_iso}</xmp:CreateDate>
      <xmp:ModifyDate>{created_iso}</xmp:ModifyDate>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>{escaped_xml_name}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN16931</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"""
    return xmp.encode("utf-8")


def _build_base_invoice_pdf(*, invoice, invoice_items: list) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(f"Rechnung {invoice.invoice_number}")

    pdf.drawString(40, 800, "DirectStock Rechnung (ZUGFeRD)")
    pdf.drawString(40, 782, f"Rechnung: {invoice.invoice_number}")
    pdf.drawString(40, 764, f"Gesamt netto: {invoice.total_net} {invoice.currency}")
    pdf.drawString(40, 746, f"Gesamt brutto: {invoice.total_gross} {invoice.currency}")

    y = 710
    for idx, item in enumerate(invoice_items, start=1):
        pdf.drawString(40, y, f"{idx}. {(item.description or 'Position')[:90]}")
        y -= 16
        if y < 80:
            pdf.showPage()
            y = 780

    pdf.save()
    return buffer.getvalue()


def _build_srgb_icc_profile() -> bytes:
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
    return profile.tobytes()


def build_zugferd_pdf(*, invoice, invoice_items: list, xml_bytes: bytes) -> bytes:
    created_at = datetime.now(UTC)
    xml_file_name = _factur_x_xml_file_name(invoice.invoice_number)
    base_pdf = _build_base_invoice_pdf(invoice=invoice, invoice_items=invoice_items)

    try:
        with pikepdf.open(BytesIO(base_pdf)) as pdf:
            root = pdf.Root

            metadata_stream = pdf.make_stream(
                _build_pdfa3_metadata_xml(
                    invoice_number=invoice.invoice_number,
                    xml_file_name=xml_file_name,
                    created_at=created_at,
                )
            )
            metadata_stream.Type = pikepdf.Name("/Metadata")
            metadata_stream.Subtype = pikepdf.Name("/XML")
            root.Metadata = pdf.make_indirect(metadata_stream)

            icc_profile_stream = pdf.make_stream(_build_srgb_icc_profile())
            icc_profile_stream.N = 3
            icc_profile_stream.Alternate = pikepdf.Name("/DeviceRGB")
            icc_profile_ref = pdf.make_indirect(icc_profile_stream)

            output_intent = pdf.make_indirect(
                pikepdf.Dictionary(
                    Type=pikepdf.Name("/OutputIntent"),
                    S=pikepdf.Name("/GTS_PDFA1"),
                    OutputConditionIdentifier="sRGB IEC61966-2.1",
                    Info="sRGB IEC61966-2.1",
                    DestOutputProfile=icc_profile_ref,
                )
            )
            root.OutputIntents = pikepdf.Array([output_intent])

            xml_stream = pdf.make_stream(xml_bytes)
            xml_stream.Type = pikepdf.Name("/EmbeddedFile")
            xml_stream.Subtype = pikepdf.Name("/application#2Fxml")
            xml_stream.Params = pikepdf.Dictionary(
                Size=len(xml_bytes),
                ModDate=pikepdf.String(_pdf_datetime_string(created_at)),
            )

            filespec = pdf.make_indirect(
                pikepdf.Dictionary(
                    Type=pikepdf.Name("/Filespec"),
                    F=xml_file_name,
                    UF=xml_file_name,
                    AFRelationship=pikepdf.Name("/Data"),
                    Desc="Factur-X / ZUGFeRD invoice XML",
                    EF=pikepdf.Dictionary(F=xml_stream, UF=xml_stream),
                )
            )

            if "/Names" not in root:
                root.Names = pikepdf.Dictionary()
            if "/EmbeddedFiles" not in root.Names:
                root.Names.EmbeddedFiles = pikepdf.Dictionary(Names=pikepdf.Array())
            if "/Names" not in root.Names.EmbeddedFiles:
                root.Names.EmbeddedFiles.Names = pikepdf.Array()
            root.Names.EmbeddedFiles.Names.append(xml_file_name)
            root.Names.EmbeddedFiles.Names.append(filespec)

            root.AF = pikepdf.Array([filespec])

            output = BytesIO()
            pdf.save(output)
            return output.getvalue()
    except Exception as exc:
        raise EinvoiceValidationError(
            message="Failed to generate ZUGFeRD PDF/A-3",
            report={"valid": False, "stage": "zugferd_generation", "error": str(exc)},
        ) from exc
