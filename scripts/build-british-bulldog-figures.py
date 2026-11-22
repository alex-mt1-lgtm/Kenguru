"""Rebuild the reviewed figures from the official British Bulldog booklets."""

import json
import sys
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
    output = ASSETS / manifest_path.parent.relative_to(SOURCES)
    output.mkdir(parents=True, exist_ok=True)
    rendered_pages = {}

    with fitz.open(manifest_path.parent / manifest['source']) as document:
        for crop in manifest['crops']:
            target = output / crop['file']
            if target.suffix == '.svg':
                from pdf_figure import cropped_svg

                scale = manifest['renderScale']
                bounds = fitz.Rect(*(coordinate / scale for coordinate in crop['box']))
                target.write_text(cropped_svg(document, crop['page'], bounds), encoding='utf-8')
                continue
            if 'xref' in crop:
                figure = rgb_image(fitz.Pixmap(document, crop['xref']))
            else:
                page = crop['page']
                if page not in rendered_pages:
                    scale = manifest['renderScale']
                    pixmap = document[page].get_pixmap(matrix=fitz.Matrix(scale, scale))
                    rendered_pages[page] = rgb_image(pixmap)
                figure = rendered_pages[page].crop(crop['box'])
            # A few booklets tuck the preceding line between the answer labels.
            for bounds in crop.get('clearBoxes', []):
                figure.paste(figure.getpixel((0, 0)), tuple(bounds))
            figure.save(target, lossless=True)


if __name__ == '__main__':
    manifests = [Path(argument).resolve() for argument in sys.argv[1:]]
    for manifest_path in manifests or sorted(SOURCES.rglob('figures.json')):
        build_figures(manifest_path)
