from __future__ import annotations

from datetime import UTC, datetime
from io import BytesIO
from xml.sax.saxutils import escape

import pikepdf
from PIL import ImageCms
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.services.einvoice.models import EinvoiceValidationError


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
    # @agent-invariant: resulting PDF must remain PDF/A-3 with embedded EN16931 XML payload.
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
