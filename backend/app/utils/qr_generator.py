from __future__ import annotations

from collections.abc import Callable
from io import BytesIO
import re

import qrcode
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

_BIN_LABEL_PATTERN = re.compile(r"^(?P<prefix>.+)-(?P<aisle>\d+)-(?P<shelf>\d+)-(?P<slot>\d+)$")


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


def format_bin_label_name(bin_code: str) -> str:
    value = bin_code.strip()
    match = _BIN_LABEL_PATTERN.match(value)
    if match is None:
        return value

    prefix = " ".join(match.group("prefix").replace("-", " ").replace("_", " ").split())
    if not prefix:
        return value

    aisle = int(match.group("aisle"))
    shelf = int(match.group("shelf"))
    slot = int(match.group("slot"))
    return f"{prefix} {aisle}, Fach {shelf}, Platz {slot}"


def _fit_text_to_width(
    value: str,
    max_width: float,
    *,
    text_width_fn: Callable[[str], float],
) -> str:
    if not value:
        return "-"
    if text_width_fn(value) <= max_width:
        return value

    suffix = "..."
    trimmed = value
    while trimmed:
        candidate = f"{trimmed}{suffix}"
        if text_width_fn(candidate) <= max_width:
            return candidate
        trimmed = trimmed[:-1]
    return suffix


def generate_bin_label_png_bytes(bin_code: str, qr_data: str) -> bytes:
    qr_png = generate_qr_png_bytes(qr_data)
    qr_image = Image.open(BytesIO(qr_png)).convert("RGB")
    caption_raw = format_bin_label_name(bin_code)

    font = ImageFont.load_default()
    measure_draw = ImageDraw.Draw(Image.new("RGB", (1, 1), "white"))

    padding_x = 16
    padding_top = 16
    caption_gap = 10
    padding_bottom = 14

    canvas_width = qr_image.width + (padding_x * 2)
    caption_max_width = canvas_width - 8
    caption = _fit_text_to_width(
        caption_raw,
        caption_max_width,
        text_width_fn=lambda value: measure_draw.textlength(value, font=font),
    )

    caption_bbox = measure_draw.textbbox((0, 0), caption, font=font)
    caption_height = caption_bbox[3] - caption_bbox[1]

    canvas_height = padding_top + qr_image.height + caption_gap + caption_height + padding_bottom
    image = Image.new("RGB", (canvas_width, canvas_height), "white")
    image.paste(qr_image, (padding_x, padding_top))

    draw = ImageDraw.Draw(image)
    caption_bbox = draw.textbbox((0, 0), caption, font=font)
    caption_width = caption_bbox[2] - caption_bbox[0]
    caption_x = max((canvas_width - caption_width) // 2, 0)
    caption_y = padding_top + qr_image.height + caption_gap
    draw.text((caption_x, caption_y), caption, fill="black", font=font)

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

    def _fit_pdf_text(value: str, max_width: float, *, font_name: str, font_size: float) -> str:
        return _fit_text_to_width(
            value,
            max_width,
            text_width_fn=lambda text: pdf.stringWidth(text, font_name, font_size),
        )

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
        qr_y = y + cell_height - qr_size - 18

        pdf.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size, preserveAspectRatio=True, mask="auto")

        display_name = format_bin_label_name(bin_code)
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawCentredString(
            x + (cell_width / 2),
            y + 11,
            _fit_pdf_text(display_name, cell_width - 10, font_name="Helvetica-Bold", font_size=10),
        )

    pdf.save()
    return output.getvalue()


def generate_serial_labels_pdf(labels: list[tuple[str, str, str, str]]) -> bytes:
    """Render serial labels as 3x8 cells per A4 page.

    labels: list of tuples (product_name, serial_number, product_number, qr_data)
    """

    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4)
    page_width, page_height = A4

    def _fit_text(value: str, max_width: float, *, font_name: str, font_size: float) -> str:
        if not value:
            return "-"
        if pdf.stringWidth(value, font_name, font_size) <= max_width:
            return value
        suffix = "..."
        trimmed = value
        while trimmed:
            candidate = f"{trimmed}{suffix}"
            if pdf.stringWidth(candidate, font_name, font_size) <= max_width:
                return candidate
            trimmed = trimmed[:-1]
        return suffix

    columns = 3
    rows = 8
    labels_per_page = columns * rows

    margin_x = 16
    margin_y = 18
    gap_x = 8
    gap_y = 8

    cell_width = (page_width - (2 * margin_x) - ((columns - 1) * gap_x)) / columns
    cell_height = (page_height - (2 * margin_y) - ((rows - 1) * gap_y)) / rows

    for index, (product_name, serial_number, product_number, qr_data) in enumerate(labels):
        page_index = index % labels_per_page
        if index > 0 and page_index == 0:
            pdf.showPage()

        row = page_index // columns
        col = page_index % columns

        x = margin_x + (col * (cell_width + gap_x))
        y = page_height - margin_y - ((row + 1) * cell_height) - (row * gap_y)

        pdf.roundRect(x, y, cell_width, cell_height, 6)

        qr_png = generate_qr_png_bytes(qr_data, box_size=5, border=2)
        qr_image = ImageReader(BytesIO(qr_png))

        qr_size = min(cell_width * 0.42, cell_height * 0.56)
        qr_x = x + ((cell_width - qr_size) / 2)
        qr_y = y + cell_height - qr_size - 8
        pdf.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size, preserveAspectRatio=True, mask="auto")

        text_center_x = x + (cell_width / 2)
        text_max_width = cell_width - 12

        pdf.setFont("Helvetica-Bold", 6.5)
        pdf.drawCentredString(
            text_center_x,
            y + 18,
            _fit_text(product_name, text_max_width, font_name="Helvetica-Bold", font_size=6.5),
        )

        pdf.setFont("Helvetica", 6)
        pdf.drawCentredString(
            text_center_x,
            y + 12,
            _fit_text(f"SN: {serial_number}", text_max_width, font_name="Helvetica", font_size=6),
        )
        pdf.drawCentredString(
            text_center_x,
            y + 6,
            _fit_text(f"Art.-Nr: {product_number}", text_max_width, font_name="Helvetica", font_size=6),
        )

    pdf.save()
    return output.getvalue()


def generate_item_labels_pdf(labels: list[tuple[str, str, str]]) -> bytes:
    """Render non-serial item labels as 3x8 cells per A4 page.

    labels: list of tuples (product_name, product_number, qr_data)
    """

    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4)
    page_width, page_height = A4

    def _fit_text(value: str, max_width: float, *, font_name: str, font_size: float) -> str:
        if not value:
            return "-"
        if pdf.stringWidth(value, font_name, font_size) <= max_width:
            return value
        suffix = "..."
        trimmed = value
        while trimmed:
            candidate = f"{trimmed}{suffix}"
            if pdf.stringWidth(candidate, font_name, font_size) <= max_width:
                return candidate
            trimmed = trimmed[:-1]
        return suffix

    columns = 3
    rows = 8
    labels_per_page = columns * rows

    margin_x = 16
    margin_y = 18
    gap_x = 8
    gap_y = 8

    cell_width = (page_width - (2 * margin_x) - ((columns - 1) * gap_x)) / columns
    cell_height = (page_height - (2 * margin_y) - ((rows - 1) * gap_y)) / rows

    for index, (product_name, product_number, qr_data) in enumerate(labels):
        page_index = index % labels_per_page
        if index > 0 and page_index == 0:
            pdf.showPage()

        row = page_index // columns
        col = page_index % columns

        x = margin_x + (col * (cell_width + gap_x))
        y = page_height - margin_y - ((row + 1) * cell_height) - (row * gap_y)

        pdf.roundRect(x, y, cell_width, cell_height, 6)

        qr_png = generate_qr_png_bytes(qr_data, box_size=5, border=2)
        qr_image = ImageReader(BytesIO(qr_png))

        qr_size = min(cell_width * 0.44, cell_height * 0.58)
        qr_x = x + ((cell_width - qr_size) / 2)
        qr_y = y + cell_height - qr_size - 8
        pdf.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size, preserveAspectRatio=True, mask="auto")

        text_center_x = x + (cell_width / 2)
        text_max_width = cell_width - 12

        pdf.setFont("Helvetica-Bold", 6.5)
        pdf.drawCentredString(
            text_center_x,
            y + 16,
            _fit_text(product_name, text_max_width, font_name="Helvetica-Bold", font_size=6.5),
        )

        pdf.setFont("Helvetica", 6)
        pdf.drawCentredString(
            text_center_x,
            y + 9,
            _fit_text(f"Art.-Nr: {product_number}", text_max_width, font_name="Helvetica", font_size=6),
        )

    pdf.save()
    return output.getvalue()
