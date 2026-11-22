"""Publish PDF vector artwork for checked archive illustrations."""

import json
from pathlib import Path
import re
from xml.etree import ElementTree

import fitz
from PIL import Image

from pdf_figure import cropped_svg, remove_print_marks


ROOT = Path(__file__).resolve().parents[1]
REGIONS = json.loads((ROOT / 'sources' / 'archive-condition-art.json').read_text())
SVG_DIMENSIONS = re.compile(r'(<svg[^>]+) width="[^"]+" height="[^"]+"')
AUTHORED_2000_FIGURES = {
    22: ((732.5, 137.5, 773, 213.5), (90, 163)),
    25: ((671.5, 339, 778, 385), (226, 98)),
}


def vector_display_size(width, height):
    """Allow small vector figures enough room in the task's opening scene."""
    scale = max(1, 220 / max(width, height))
    return round(width * scale), round(height * scale)


def vector_figure(document, page_number, region, width, height, *, clear_watermark=False):
    """Crop in printed coordinates, keeping the illustration's display size."""
    if document[page_number].rotation:
        with fitz.open() as upright:
            upright.insert_pdf(document, from_page=page_number, to_page=page_number)
            upright[0].remove_rotation()
            svg = cropped_svg(upright, 0, region)
    else:
        svg = cropped_svg(document, page_number, region)
    if '<image' in svg:
        raise ValueError(f'Unexpected bitmap in checked vector artwork {region}')
    if clear_watermark:
        svg = remove_print_marks(ElementTree.fromstring(svg), clear_watermark=True)
    return SVG_DIMENSIONS.sub(rf'\1 width="{width}" height="{height}"', svg, count=1)


def replace_condition_figure(document, collection, year, number, entry, checked=None):
    """Apply a vetted PDF crop to the normal output of a condition builder."""
    records = REGIONS.get(f'{collection}/{year}', {})
    record = records.get(str(number))
    if record is None:
        return False
    page, rectangle, *flags = record
    settings = flags[0] if flags else {}
    if not isinstance(settings, dict):
        settings = {'rasterScale': settings}
    if asset := settings.get('editorialAsset'):
        path = Path('assets/kenguru/illustrations') / f'{asset}.svg'
        svg = ElementTree.parse(ROOT / 'dist' / path).getroot()
        entry.update(image=path.as_posix(), imageWidth=int(svg.get('width')), imageHeight=int(svg.get('height')),
                     figureAlt=settings['alt'])
        return True
    raster_scale = settings.get('rasterScale')
    if rectangle is None:
        (row,) = checked['illustrationRows']
        (rectangle,) = row
    left, top, right, bottom = rectangle
    width, height = right - left, bottom - top
    region = fitz.Rect(left / 3, top / 3, right / 3, bottom / 3)
    path = Path(entry['image']).with_suffix('.webp' if raster_scale else '.svg')
    destination = ROOT / 'dist' / path
    destination.parent.mkdir(parents=True, exist_ok=True)
    if raster_scale:
        pixels = document[page].get_pixmap(matrix=fitz.Matrix(raster_scale, raster_scale), clip=region, alpha=False)
        width, height = pixels.width, pixels.height
        image = Image.frombytes('RGB', (width, height), pixels.samples)
        image.save(destination, 'WEBP', lossless=True, method=6)
    else:
        width, height = vector_display_size(width, height)
        svg = vector_figure(document, page, region, width, height,
                            clear_watermark=settings.get('clearWatermark', False))
        destination.write_text(svg, encoding='utf-8')
    entry.update(image=path.as_posix(), imageWidth=width, imageHeight=height)
    return True


if __name__ == '__main__':
    with fitz.open(ROOT / 'sources' / '2000' / 'tasks.pdf') as document:
        folder = ROOT / 'dist' / 'assets' / 'years' / '2000'
        for number, (bounds, dimensions) in AUTHORED_2000_FIGURES.items():
            drawing = vector_figure(document, 1, fitz.Rect(bounds), *dimensions)
            (folder / f'q{number}-figure.svg').write_text(drawing, encoding='utf-8')
