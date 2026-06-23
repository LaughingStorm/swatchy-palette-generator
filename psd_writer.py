import tempfile
import os
from PIL import Image, ImageDraw
from psd_tools import PSDImage
from ase_writer import hex_to_rgb


def write_psd(hex_colors):
    rgbs = [(int(r*255), int(g*255), int(b*255)) for r, g, b in [hex_to_rgb(c) for c in hex_colors]]
    canvas_w, canvas_h = 1920, 1080
    swatch_width = int((canvas_w * 0.8) / len(rgbs))
    swatch_height = 200
    margin = 20

    canvas = Image.new("RGB", (canvas_w, canvas_h), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)

    for i, (r, g, b) in enumerate(rgbs):
        x = margin + swatch_width * i
        draw.rectangle([x, margin, x + swatch_width, margin + swatch_height], fill=(r, g, b))

    psd = PSDImage.new("RGB", (canvas_w, canvas_h))
    psd.create_pixel_layer(canvas, "Color Swatches", top=0, left=0)

    with tempfile.NamedTemporaryFile(suffix=".psd", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        psd.save(tmp_path)
        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)