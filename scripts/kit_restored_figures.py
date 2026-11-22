"""Restore selected KIT illustrations without changing the archived booklets."""

import json
from base64 import b64encode
from pathlib import Path
from xml.etree import ElementTree

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources/kit'
ASSETS = ROOT / 'dist/assets/kit'
MASTERS = SOURCES / 'restored-figures'
MANIFEST = SOURCES / 'restored-figures.json'
SVG_NAMESPACE = 'http://www.w3.org/2000/svg'


def load_manifest():
    return json.loads(MANIFEST.read_text(encoding='utf-8'))


def build_interactive():
    manifest = load_manifest()
    for path, drawing in manifest['interactive'].items():
        target = ASSETS / path
        if target.suffix == '.svg':
            target.write_bytes((MASTERS / f'{drawing}.svg').read_bytes())
        else:
            with Image.open(MASTERS / f'{drawing}.png') as image:
                image.save(target, lossless=True, method=6)

    ElementTree.register_namespace('', SVG_NAMESPACE)
    for path, shelf in manifest['shelves'].items():
        with fitz.open(SOURCES / f'{path}.pdf') as booklet:
            art = shelf_image(booklet[shelf['page']], shelf)
            source = fitz.Pixmap(booklet, art['xref'])
            width, height = source.width, source.height
            if source.colorspace.n not in (1, 3):
                source = fitz.Pixmap(fitz.csRGB, source)
            image = b64encode(source.tobytes('png')).decode('ascii')
        svg = [
            f'<svg xmlns="{SVG_NAMESPACE}" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
            f'<image href="data:image/png;base64,{image}" width="{width}" height="{height}"/>',
        ]
        for drawing, bounds in zip((shelf['high'], 'shoe-low'), manifest['shelfChips']):
            rect = fitz.Rect(bounds)
            art = ElementTree.parse(MASTERS / f'{drawing}.svg').getroot()
            art.attrib.update(x=str(rect.x0), y=str(rect.y0), width=str(rect.width),
                              height=str(rect.height), preserveAspectRatio='none')
            svg.extend([f'<rect x="{rect.x0}" y="{rect.y0}" width="{rect.width}" height="{rect.height}" fill="white"/>',
                        ElementTree.tostring(art, encoding='unicode')])
        svg.append('</svg>')
        (ASSETS / shelf['asset']).write_text('\n'.join(svg) + '\n', encoding='utf-8')



def shelf_image(page, shelf):
    return next(image for image in page.get_image_info(xrefs=True)
                if image['digest'].hex() == shelf['imageDigest'])


def restore_shelf(page, shelf, chips):
    image = shelf_image(page, shelf)
    bounds = fitz.Rect(image['bbox'])
    placement = fitz.Matrix(bounds.width / image['width'], 0, 0,
                            bounds.height / image['height'], bounds.x0, bounds.y0)
    for drawing, clip in zip((shelf['high'], 'shoe-low'), chips):
        rect = fitz.Rect(clip) * placement
        page.draw_rect(rect, color=None, fill=(1, 1, 1))
        with figure_pdf(drawing) as figure:
            page.show_pdf_page(rect, figure, keep_proportion=False)


def figure_pdf(name):
    path = (ASSETS / '2022/display-segments.svg' if name == 'display'
            else MASTERS / f'{name}.svg')
    with fitz.open(path) as svg:
        return fitz.open('pdf', svg.convert_to_pdf())


def restore_pdf(document, figures, stamp_clip, overlay_pages):
    pending = dict(figures)
    for page in document:
        matches = []
        for image in page.get_image_info(hashes=True):
            digest = image['digest'].hex()
            rect = fitz.Rect(image['bbox'])
            if digest in pending and rect.intersects(page.rect * page.derotation_matrix):
                matches.append((pending.pop(digest), rect, 90 if image['transform'][1] < -1 else 0))

        stamp_box = None
        if stamp_clip and stamp_clip[0] == page.number:
            stamp_box = fitz.Rect(stamp_clip[1])
            page.add_redact_annot(stamp_box, fill=(1, 1, 1), cross_out=False)

        if matches or stamp_box:
            if page.number in overlay_pages:
                # Redacting this page rewrites the palette of an indexed
                # picture in the adjacent column. Preserve its original stream.
                for _, rect, _ in matches:
                    page.draw_rect(rect, color=None, fill=(1, 1, 1))
            else:
                for _, rect, _ in matches:
                    page.add_redact_annot(rect, fill=(1, 1, 1), cross_out=False)
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE,
                                      graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                                      text=fitz.PDF_REDACT_TEXT_NONE)
            for name, rect, rotation in matches:
                with figure_pdf(name) as figure:
                    page.show_pdf_page(rect, figure, keep_proportion=False, rotate=rotation)
            if stamp_box:
                page.insert_image(stamp_box, filename=MASTERS / 'khwarizmi.png')
    if pending:
        raise ValueError(f'Missing illustrations in {document.name}: {pending}')


def build_reading_copies():
    manifest = load_manifest()
    for path, figures in manifest['pdfs'].items():
        output = ASSETS / f'{path}-reading.pdf'
        year = Path(path).parent.name
        # These copies are reordered from the printer's spreads by the caller.
        source = output if year == '2011' else SOURCES / f'{path}.pdf'
        with fitz.open(stream=source.read_bytes(), filetype='pdf') as booklet:
            restore_pdf(booklet, {digest: name for name, digest in figures.items()},
                        manifest['stampClips'].get(path),
                        manifest['overlayPages'].get(path, ()))
            if path in manifest['shelves']:
                shelf = manifest['shelves'][path]
                restore_shelf(booklet[shelf['page']], shelf, manifest['shelfChips'])
            output.write_bytes(booklet.tobytes(garbage=4, deflate=True, no_new_id=True))
