"""Rebuild reviewed КИТ figures from zero-indexed pages and PDF-point boxes."""

import json
from pathlib import Path

import fitz
from PIL import Image

from pdf_figure import cropped_svg


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources' / 'kit'
ASSETS = ROOT / 'dist' / 'assets' / 'kit'


def extract_fragment(page, bounds, scale):
    pixels = page.get_pixmap(matrix=scale, clip=fitz.Rect(bounds), alpha=False)
    return Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples)


def combine_fragments(fragments, gap):
    if len(fragments) == 1:
        return fragments[0]

    width = max(fragment.width for fragment in fragments)
    height = sum(fragment.height for fragment in fragments) + gap * (len(fragments) - 1)
    combined = Image.new('RGB', (width, height), 'white')
    offset = 0
    for fragment in fragments:
        combined.paste(fragment, ((width - fragment.width) // 2, offset))
        offset += fragment.height + gap
    return combined


def build_figures(manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    crops = manifest.get('crops', manifest)
    render_scale = manifest.get('renderScale', 2)
    scale = fitz.Matrix(render_scale, render_scale)
    gap = manifest.get('gap', 12)
    webp_method = manifest.get('webpMethod', 4)
    output = ASSETS / manifest_path.parent.name
    output.mkdir(parents=True, exist_ok=True)
    pdf_path = manifest_path.with_name(manifest_path.name.replace('-figures.json', '.pdf'))
    with fitz.open(pdf_path) as document:
        for name, (page_index, bounds) in crops.items():
            if name.endswith('.svg'):
                (box,) = bounds
                graphic = cropped_svg(document, page_index, fitz.Rect(box))
                (output / name).write_text(graphic, encoding='utf-8')
            else:
                fragments = [extract_fragment(document[page_index], rect, scale) for rect in bounds]
                combine_fragments(fragments, gap).save(output / f'{name}.webp', lossless=True, method=webp_method)


if __name__ == '__main__':
    for manifest_path in sorted(SOURCES.glob('*/*-figures.json')):
        build_figures(manifest_path)
