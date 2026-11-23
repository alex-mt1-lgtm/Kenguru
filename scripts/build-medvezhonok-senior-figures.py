"""Build original artwork for the senior Russian Bear editions."""

from io import BytesIO
import json
from pathlib import Path
from xml.etree import ElementTree

import fitz
from PIL import Image

from pdf_figure import cropped_svg, remove_print_marks

ROOT = Path(__file__).resolve().parents[1]


def vector_asset(document, record, destination):
    rect = fitz.Rect(record['box'])
    svg = cropped_svg(document, record['page'], rect)
    if record.get('excludeRects'):
        svg = remove_print_marks(ElementTree.fromstring(svg), exclude_rects=record['excludeRects'])
    destination.write_text(svg, encoding='utf-8')


def photo_assets(document, record, directory):
    images = []
    for panel in record['panels']:
        embedded = document.extract_image(panel['xref'])
        with Image.open(BytesIO(embedded['image'])) as image:
            original = image.convert('RGB')
        if list(original.size) != panel['size']:
            raise ValueError(f'Image size changed for {panel["file"]}')
        original.save(directory / panel['file'], 'WEBP', lossless=True, method=6)
        images.append(original)
    gap = 14
    width = sum(photo.width for photo in images) + gap * (len(images) - 1)
    height = max(photo.height for photo in images)
    composite = Image.new('RGB', (width, height), 'white')
    x = 0
    for photo in images:
        composite.paste(photo, (x, (height - photo.height) // 2))
        x += photo.width + gap
    if [width, height] != record['size']:
        raise ValueError(f'Composite size changed for {record["file"]}')
    composite.save(directory / record['file'], 'WEBP', lossless=True, method=6)


def raster_strips(document, record, directory):
    width, height = record['size']
    composite = Image.new('RGB', (width, height))
    top = 0
    for xref in record['strips']:
        embedded = document.extract_image(xref)
        with Image.open(BytesIO(embedded['image'])) as image:
            if image.width != width:
                raise ValueError(f'Unexpected strip width in {record["file"]}')
            composite.paste(image.convert('RGB'), (0, top))
            top += image.height
    if top != height:
        raise ValueError(f'Unexpected total strip height in {record["file"]}')
    composite.save(directory / record['file'], 'WEBP', lossless=True, method=6)
    preview_width = record['previewWidth']
    preview_size = (preview_width, round(height * preview_width / width))
    preview = composite.resize(preview_size, Image.Resampling.LANCZOS)
    preview.save(directory / record['preview'], 'WEBP', lossless=True, method=6)


def build():
    for registry in sorted((ROOT / 'sources' / 'medvezhonok').glob('*/senior-art.json')):
        source = registry.parent
        target = ROOT / 'dist' / 'assets' / 'medvezhonok' / source.name
        target.mkdir(parents=True, exist_ok=True)
        for record in json.loads(registry.read_text(encoding='utf-8')):
            with fitz.open(source / record['pdf']) as document:
                if 'panels' in record:
                    photo_assets(document, record, target)
                elif 'strips' in record:
                    raster_strips(document, record, target)
                else:
                    vector_asset(document, record, target / record['file'])


if __name__ == '__main__':
    build()
