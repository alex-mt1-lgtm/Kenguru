"""Rebuild the British Bulldog lesson crops from the checked archive figures."""

from io import BytesIO
import json
from pathlib import Path
from xml.etree import ElementTree

import fitz
from PIL import Image

from pdf_figure import cropped_svg, remove_print_marks

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "sources" / "british-bulldog"
PUBLIC = ROOT / "dist" / "assets" / "british-bulldog"


def extract_raster(document, page, rectangle, master_size):
    if master_size:
        images = [
            image
            for image in page.get_image_info(xrefs=True)
            if [image["width"], image["height"]] == master_size
            and fitz.Rect(image["bbox"]).intersects(rectangle)
            and image["xref"]
        ]
        if len(images) != 1:
            raise ValueError(f"Expected one matching image on page {page.number + 1}")
        original = document.extract_image(images[0]["xref"])
        image = Image.open(BytesIO(original["image"])).convert("RGB")
        if original["smask"]:
            mask = document.extract_image(original["smask"])
            image.putalpha(Image.open(BytesIO(mask["image"])).convert("L"))
        return image

    pixmap = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=rectangle, alpha=False)
    return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)


def build_figure(year, row):
    source = PUBLIC / year / row["sourceFile"]
    target = ROOT / "dist" / row["src"]
    rectangle = fitz.Rect(row["cropPoints"])

    with fitz.open(source) as document:
        page = document[row["page"]]
        if page.rotation:
            page.remove_rotation()
        if not page.rect.contains(rectangle):
            raise ValueError(f"Crop outside the page in {source}: {rectangle}")

        if row.get("omitText"):
            for bounds in row["omitText"]:
                page.add_redact_annot(fitz.Rect(bounds), fill=False, cross_out=False)
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)

        if target.suffix == ".svg":
            svg = cropped_svg(document, page.number, rectangle)
            if row["svg"] == "art":
                tree = ElementTree.fromstring(svg)
                glyphs = {value for item in tree.iter() if (value := item.get("data-text"))}
                svg = remove_print_marks(tree, omit_glyphs=glyphs)
            target.write_text(svg, encoding="utf-8")
            return

        image = extract_raster(document, page, rectangle, row.get("masterSize"))
        image.save(target, lossless=True, method=6)


def main():
    for year in range(2007, 2014):
        for registry in sorted((SOURCE / str(year)).glob("*-figures.json")):
            for row in json.loads(registry.read_text(encoding="utf-8")).values():
                build_figure(str(year), row)


if __name__ == "__main__":
    main()
