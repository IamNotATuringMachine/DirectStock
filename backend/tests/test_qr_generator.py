from io import BytesIO

from PIL import Image, ImageChops

from app.utils.qr_generator import format_bin_label_name, generate_bin_label_png_bytes


def test_format_bin_label_name_from_pattern() -> None:
    assert format_bin_label_name("Regal-01-02-03") == "Regal 1, Fach 2, Platz 3"


def test_format_bin_label_name_fallback_for_non_pattern() -> None:
    value = "schwerlastregal 1, fach 2, platz 2"
    assert format_bin_label_name(value) == value


def test_generate_bin_label_png_bytes_contains_caption_area() -> None:
    png = generate_bin_label_png_bytes("Regal-01-02-03", "DS:BIN:Regal-01-02-03")

    with Image.open(BytesIO(png)) as image:
        rgb = image.convert("RGB")
        assert rgb.height > rgb.width
        caption_band = rgb.crop((0, int(rgb.height * 0.8), rgb.width, rgb.height))
        assert ImageChops.invert(caption_band.convert("L")).getbbox() is not None
