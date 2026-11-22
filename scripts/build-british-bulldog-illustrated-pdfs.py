"""Build full reading copies with restored British Bulldog illustrations."""

from contextlib import ExitStack
from os import environ
from pathlib import Path
from subprocess import run
from tempfile import TemporaryDirectory

import fitz
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BOOKLETS = ROOT / "dist" / "assets" / "british-bulldog"
ILLUSTRATIONS = ROOT / "sources" / "british-bulldog" / "reading-illustrations"
FONT = fitz.Font("helv")
BLUE = (0.10, 0.28, 0.44)

# These points enclose the dress, including the neckline, folds and ribbon.
# The 368 × 233 source is the embedded bathroom image on page 2 of the 2008 booklet.
DRESS = [
    (17, 46), (21, 46), (22, 52), (24, 56), (28, 57), (31, 53),
    (32, 46), (37, 46), (38, 57), (41, 62), (41, 68), (38, 72),
    (40, 73), (43, 82), (47, 87), (42, 93), (42, 97), (44, 107),
    (45, 130), (47, 137), (39, 139), (34, 139), (31, 137),
    (26, 141), (20, 140), (15, 138), (11, 140), (5, 139), (6, 132),
    (9, 119), (11, 102), (13, 93), (15, 87), (17, 77), (16, 72),
    (13, 68), (13, 63), (16, 56),
]


def image_rect(page, xref, size):
    for info in page.get_image_info(xrefs=True):
        if info["xref"] == xref and (info["width"], info["height"]) == size:
            return fitz.Rect(info["bbox"])
    raise ValueError(f"Image {xref} ({size}) missing from page {page.number + 1}")


def recolour_dress(doc, page):
    xref = 7
    image_rect(page, xref, (368, 233))
    pixmap = fitz.Pixmap(fitz.csRGB, fitz.Pixmap(doc, xref))
    scene = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    mask = Image.new("L", (scene.width * 4, scene.height * 4))
    ImageDraw.Draw(mask).polygon([(x * 4, y * 4) for x, y in DRESS], fill=255)
    mask = mask.resize(scene.size, Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(0.35))
    green = ImageOps.colorize(
        scene.convert("L"), "#101a13", "#c7edc1", mid="#437c50",
        midpoint=145,
    )
    corrected = Image.composite(green, scene, mask)
    restored = fitz.Pixmap(fitz.csRGB, scene.width, scene.height, corrected.tobytes(), False)
    page.replace_image(xref, pixmap=restored)


def note(page, origin, color=BLUE):
    page.insert_text(origin, "Reading copy", fontsize=8, color=color)


def add_link(page, origin, label, target):
    x, y = origin
    size = 9.5
    end = x + FONT.text_length(label, fontsize=size)
    page.insert_text(origin, label, fontsize=size, color=BLUE)
    page.draw_line((x, y + 2), (end, y + 2), color=BLUE, width=0.55)
    page.insert_link({"kind": fitz.LINK_GOTO, "from": fitz.Rect(x - 2, y - size, end + 2, y + 4),
                      "page": target, "to": fitz.Point(0, 0)})


def edit_2008(doc, art):
    page = doc[1]
    recolour_dress(doc, page)
    xref = 14
    image_rect(page, xref, (132, 93))
    # Replace the raster in its original paint order, below the five question numbers.
    # Render the new vector master at five times its printed size.
    master = art["2008-figures"][0].get_pixmap(matrix=fitz.Matrix(1.8, 1.8), alpha=False)
    page.replace_image(xref, pixmap=master)
    note(page, (311, 588))


def edit_2010(doc, art):
    page = doc[1]
    page.remove_rotation()
    xref = 19
    scene = image_rect(page, xref, (716, 504))
    overlay = art["2010-forest-detail"]
    page.show_pdf_page(scene, overlay, keep_proportion=False)
    detail = doc.new_page(width=640, height=528)
    detail.insert_text((28, 31), "British Bulldog 2010  /  Grades 3-4", fontsize=11, color=BLUE)
    detail.insert_text((28, 59), "Picture for questions 31-40", fontsize=23, fontname="hebo")
    detail.insert_text((28, 78), "Editorial details on the original illustration.", fontsize=10, color=BLUE)
    enlarged = fitz.Rect(28, 93, 612, 93 + 584 * 504 / 716)
    detail.insert_image(enlarged, xref=xref)
    detail.show_pdf_page(enlarged, overlay, keep_proportion=False)
    add_link(detail, (28, 520), "Back to questions on page 2", 1)
    page = doc[1]
    add_link(page, (44, 610), "Enlarged picture on page 3", 2)
    page.insert_link({"kind": fitz.LINK_GOTO, "from": scene, "page": 2, "to": fitz.Point(0, 0)})
    doc.set_toc([[1, "Booklet", 1], [1, "Picture for questions 31-40", 3]])


def edit_2012(doc, art):
    page = doc[1]
    page.remove_rotation()
    labels = art["2012-recipe-labels"]
    for letter, panel, label, side in [
        ("a", (317.45, 170.5, 395.83, 301.82), (371.4, 289.6, 394.6, 312.4), 0),
        ("c", (475.20, 170.5, 553.83, 301.82), (529.1, 289.6, 552.3, 312.4), 1),
    ]:
        page.show_pdf_page(fitz.Rect(panel), art[f"2012-recipes-{letter}"], keep_proportion=False)
        source = labels[0].rect
        center = source.width / 2
        clip = fitz.Rect(side * center, 0, (side + 1) * center, source.height)
        page.show_pdf_page(fitz.Rect(label), labels, clip=clip, keep_proportion=False)
    note(page, (504, 611), (0.06, 0.20, 0.08))


def edit_2015_tales(doc, art):
    page = doc[0]
    for xref, size, name in [
        (842, (128, 163), "2015-robin-hood"),
        (838, (124, 170), "2015-snow-white"),
    ]:
        rect = image_rect(page, xref, size)
        page.draw_rect(rect + (-0.7, 0, 0.7, 0.6), color=None, fill=(1, 1, 1), width=0)
        page.show_pdf_page(rect, art[name], keep_proportion=False)
    note(page, (761, 15), (1, 1, 1))


def edit_2015_bath(doc, art):
    page = doc[1]
    rect = image_rect(page, 520, (130, 125))
    page.draw_rect(rect, color=None, fill=(1, 1, 1), width=0)
    page.show_pdf_page(rect, art["2015-bath"], keep_proportion=False)
    note(page, (492, 15), (0.10, 0.22, 0.09))


def build_booklet(path, title, edit, art):
    with fitz.open(path / "tasks.pdf") as doc:
        if len(doc) != 2:
            raise ValueError(f"Expected a two-page booklet in {path}")
        edit(doc, art)
        doc.del_xml_metadata()
        doc.set_metadata({"title": f"British Bulldog {title} - Reading copy",
                          "subject": "Booklet with editorial illustrations",
                          "creator": "Olympiads.pro", "producer": "PyMuPDF"})
        doc.save(path / "tasks-reading.pdf", garbage=4, deflate=True, no_new_id=True)


def main():
    with TemporaryDirectory() as tmp, ExitStack() as stack:
        art = {}
        environment = dict(environ, INKSCAPE_PROFILE_DIR=tmp)
        for svg in sorted(ILLUSTRATIONS.glob("*.svg")):
            pdf = Path(tmp) / svg.with_suffix(".pdf").name
            run(["inkscape", "--export-text-to-path", f"--export-filename={pdf}", str(svg)],
                check=True, env=environment)
            art[svg.stem] = stack.enter_context(fitz.open(pdf))
        for folder, title, editor in [
            ("2008/5-6", "2008 - Grades 5-6", edit_2008),
            ("2010/3-4", "2010 - Grades 3-4", edit_2010),
            ("2012/5-6/variant-540", "2012 - Grades 5-6 - Variant 540", edit_2012),
            ("2012/5-6/variant-780", "2012 - Grades 5-6 - Variant 780", edit_2012),
            ("2012/5-6/variant-980", "2012 - Grades 5-6 - Variant 980", edit_2012),
            ("2015/3-4", "2015 - Grades 3-4", edit_2015_tales),
            ("2015/7-8", "2015 - Grades 7-8", edit_2015_bath),
        ]:
            build_booklet(BOOKLETS / folder, title, editor, art)


if __name__ == "__main__":
    main()
