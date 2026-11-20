"""Rebuild the reviewed figures from the official British Bulldog booklets."""

import json
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources' / 'british-bulldog'
ASSETS = ROOT / 'dist' / 'assets' / 'british-bulldog'


def rgb_image(pixmap):
    if pixmap.colorspace != fitz.csRGB:
        pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
    return Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)


def build_figures(manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    output = ASSETS / manifest_path.parent.name
    output.mkdir(parents=True, exist_ok=True)
    rendered_pages = {}

    with fitz.open(manifest_path.parent / manifest['source']) as document:
        for crop in manifest['crops']:
            if 'xref' in crop:
                figure = rgb_image(fitz.Pixmap(document, crop['xref']))
            else:
                page = crop['page']
                if page not in rendered_pages:
                    scale = manifest['renderScale']
                    pixmap = document[page].get_pixmap(matrix=fitz.Matrix(scale, scale))
                    rendered_pages[page] = rgb_image(pixmap)
                figure = rendered_pages[page].crop(crop['box'])
            figure.save(output / crop['file'], lossless=True)


if __name__ == '__main__':
    for manifest_path in sorted(SOURCES.glob('*/figures.json')):
        build_figures(manifest_path)
