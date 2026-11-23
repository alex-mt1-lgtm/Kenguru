"""Rebuild the 1997–1999 grades 3–4 figures from the original task PDFs."""

import json
from collections import defaultdict
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree

import fitz
from PIL import Image

from pdf_figure import SVG, cropped_svg, remove_print_marks


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'sources/math-completion/illustrations/early-34.json'


def extract_image(booklet, page, xref, bounds):
    info = next(item for item in page.get_image_info(xrefs=True) if item['xref'] == xref)
    if booklet.xref_get_key(xref, 'ImageMask') == ('bool', 'true'):
        mask = fitz.Pixmap(booklet, xref)
        opacity = Image.frombytes('L', (mask.width, mask.height), mask.samples)
        picture = Image.new('RGB', opacity.size, 'white')
        picture.paste('black', (0, 0), opacity)
    else:
        raw = booklet.extract_image(xref)
        picture = Image.open(BytesIO(raw['image'])).convert('RGB')
    if bounds is None:
        return picture
    source = fitz.Rect(info['bbox']) * page.rotation_matrix
    left, top, right, bottom = source & bounds
    scale_x, scale_y = picture.width / source.width, picture.height / source.height
    return picture.crop(tuple(round(value) for value in (
        (left - source.x0) * scale_x, (top - source.y0) * scale_y,
        (right - source.x0) * scale_x, (bottom - source.y0) * scale_y,
    )))


def build():
    groups = defaultdict(list)
    for relative, spec in json.loads(MANIFEST.read_text(encoding='utf-8')).items():
        year = Path(relative).parent.name.split('-')[0]
        groups[year].append((ROOT / 'dist' / relative, spec))

    for year, records in groups.items():
        with fitz.open(ROOT / 'sources' / year / 'tasks.pdf') as booklet:
            for path, spec in records:
                page = booklet[spec['page']]
                bounds = fitz.Rect(spec['bounds']) if 'bounds' in spec else None
                if bounds is not None and (bounds.is_empty or not page.rect.contains(bounds)):
                    raise ValueError(f'{path}: invalid crop {bounds}')
                path.parent.mkdir(parents=True, exist_ok=True)
                if 'xref' in spec:
                    picture = extract_image(booklet, page, spec['xref'], bounds)
                    picture.save(path, 'WEBP', lossless=True, method=6)
                    continue

                svg = ElementTree.fromstring(cropped_svg(booklet, page.number, bounds))
                if any(node.tag == f'{{{SVG}}}image' for node in svg.iter()):
                    raise ValueError(f'{path}: a source bitmap intersects the vector crop')
                path.write_text(remove_print_marks(svg, clear_watermark=True,
                                                   omit_glyphs=spec.get('omitGlyphs', ())),
                                encoding='utf-8')


if __name__ == '__main__':
    build()
