from __future__ import annotations

from io import BytesIO

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def generate_qr_png_bytes(content: str, *, box_size: int = 10, border: int = 4) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(content)
    qr.make(fit=True)

    image = qr.make_image(fill_color="black", back_color="white")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def generate_bin_labels_pdf(labels: list[tuple[str, str]]) -> bytes:
    """Render 2x5 labels per A4 page for bin QR codes.

    labels: list of tuples (bin_code, qr_data)
    """
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4)
    page_width, page_height = A4

    columns = 2
    rows = 5
    labels_per_page = columns * rows

    margin_x = 24
    margin_y = 28
    gap_x = 12
    gap_y = 10

    cell_width = (page_width - (2 * margin_x) - ((columns - 1) * gap_x)) / columns
    cell_height = (page_height - (2 * margin_y) - ((rows - 1) * gap_y)) / rows

    for index, (bin_code, qr_data) in enumerate(labels):
        page_index = index % labels_per_page
        if index > 0 and page_index == 0:
            pdf.showPage()

        row = page_index // columns
        col = page_index % columns

        x = margin_x + (col * (cell_width + gap_x))
        y = page_height - margin_y - ((row + 1) * cell_height) - (row * gap_y)

        pdf.roundRect(x, y, cell_width, cell_height, 8)

        qr_png = generate_qr_png_bytes(qr_data, box_size=6, border=2)
        qr_image = ImageReader(BytesIO(qr_png))

        qr_size = min(cell_width * 0.58, cell_height * 0.68)
        qr_x = x + ((cell_width - qr_size) / 2)
        qr_y = y + cell_height - qr_size - 12

        pdf.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size, preserveAspectRatio=True, mask="auto")

        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawCentredString(x + (cell_width / 2), y + 20, bin_code)

        pdf.setFont("Helvetica", 8)
        pdf.drawCentredString(x + (cell_width / 2), y + 8, qr_data)

    pdf.save()
    return output.getvalue()
