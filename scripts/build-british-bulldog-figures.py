"""Rebuild the reviewed figures from the official British Bulldog booklets."""

import json
import sys
from pathlib import Path

import fitz
from PIL import Image

from pdf_figure import cropped_svg


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources' / 'british-bulldog'
ASSETS = ROOT / 'dist' / 'assets' / 'british-bulldog'


def rgb_image(pixmap):
    if pixmap.colorspace != fitz.csRGB:
        pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
    return Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)


def export_svg(document, page_number, bounds):
    page = document[page_number]
    cropbox = page.cropbox
    offset = page.cropbox_position
    # The manifest coordinates start at the visible page, while PDF crop boxes
    # are relative to the media box. The 2019 and 2025 booklets include trim margins.
    page.set_cropbox(page.mediabox)
    try:
        return cropped_svg(document, page_number, bounds + (offset.x, offset.y, offset.x, offset.y))
    finally:
        page.set_cropbox(cropbox)


def build_figures(manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    output = ASSETS / manifest_path.parent.relative_to(SOURCES)
    output.mkdir(parents=True, exist_ok=True)
    rendered_pages = {}

    with fitz.open(manifest_path.parent / manifest['source']) as document:
        for crop in manifest['crops']:
            targets = [crop]
            if 'detail' in crop:
                targets.append({**crop, **crop['detail']})
            for spec in targets:
                write_figure(document, output / spec['file'], spec, manifest.get('renderScale'), rendered_pages)


def write_figure(document, target, crop, base_scale, rendered_pages):
    scale = crop.get('renderScale', base_scale)
    scale_ratio = 1
    if 'xref' in crop:
        figure = rgb_image(fitz.Pixmap(document, crop['xref']))
    else:
        page_number = crop['page']
        if target.suffix == '.svg' or scale != base_scale:
            bounds = fitz.Rect(*(coordinate / base_scale for coordinate in crop['box']))
            if target.suffix == '.svg':
                target.write_text(export_svg(document, page_number, bounds), encoding='utf-8')
                return
            pixmap = document[page_number].get_pixmap(matrix=fitz.Matrix(scale, scale), clip=bounds)
            figure = rgb_image(pixmap)
            scale_ratio = scale / base_scale
        else:
            if page_number not in rendered_pages:
                pixmap = document[page_number].get_pixmap(matrix=fitz.Matrix(scale, scale))
                rendered_pages[page_number] = rgb_image(pixmap)
            figure = rendered_pages[page_number].crop(crop['box'])
    # Preserve the page background where material from a neighboring task overlaps the crop.
    for bounds in crop.get('clearBoxes', []):
        figure.paste(figure.getpixel((0, 0)), tuple(round(coordinate * scale_ratio) for coordinate in bounds))
    figure.save(target, lossless=True)


if __name__ == '__main__':
    manifests = [Path(argument).resolve() for argument in sys.argv[1:]]
    for manifest_path in manifests or sorted(SOURCES.rglob('figures.json')):
        build_figures(manifest_path)
