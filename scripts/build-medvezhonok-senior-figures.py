"""Build original artwork for the senior Russian Bear editions."""

from io import BytesIO
import json
from pathlib import Path

import fitz
from PIL import Image

from pdf_figure import cropped_svg

ROOT = Path(__file__).resolve().parents[1]


def vector_asset(document, record, destination):
    rect = fitz.Rect(record['box'])
    destination.write_text(cropped_svg(document, record['page'], rect), encoding='utf-8')


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


def build():
    for registry in sorted((ROOT / 'sources' / 'medvezhonok').glob('*/senior-art.json')):
        source = registry.parent
        target = ROOT / 'dist' / 'assets' / 'medvezhonok' / source.name
        target.mkdir(parents=True, exist_ok=True)
        for record in json.loads(registry.read_text(encoding='utf-8')):
            with fitz.open(source / record['pdf']) as document:
                if 'panels' in record:
                    photo_assets(document, record, target)
                else:
                    vector_asset(document, record, target / record['file'])


if __name__ == '__main__':
    build()
