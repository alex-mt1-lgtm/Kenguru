"""Rebuild reviewed КИТ figures from zero-indexed pages and PDF-point boxes."""

import io
import json
from pathlib import Path

import fitz
from PIL import Image, ImageOps

from pdf_figure import cropped_svg
from kit_restored_figures import build_interactive


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources' / 'kit'
ASSETS = ROOT / 'dist' / 'assets' / 'kit'


def extract_fragment(page, bounds, scale, clear=()):
    clip = fitz.Rect(bounds)
    pixels = page.get_pixmap(matrix=scale, clip=clip, alpha=False)
    image = Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples)
    for region in clear:
        rect = clip & fitz.Rect(region)
        if not rect.is_empty:
            x0, y0, x1, y1 = (rect * scale).irect
            image.paste('white', (x0 - pixels.x, y0 - pixels.y, x1 - pixels.x, y1 - pixels.y))
    return image


def extract_original(document, page, bounds, xref=None):
    rect = fitz.Rect(bounds)
    images = [image for image in page.get_image_info(xrefs=True)
              if rect.contains(fitz.Rect(image['bbox'])) and (xref is None or image['xref'] == xref)]
    if len(images) != 1 or not images[0]['xref'] or images[0]['has-mask']:
        raise ValueError(f'Expected one unmasked image in {document.name}, page {page.number + 1}, {rect}')
    image_xref = images[0]['xref']
    pixmap = fitz.Pixmap(document, image_xref)
    if pixmap.colorspace and pixmap.colorspace.name.startswith('Separation('):
        # The source's ink values need the PDF colour space to render correctly.
        rgb = fitz.Pixmap(fitz.csRGB, pixmap)
        return Image.frombytes('RGB', (rgb.width, rgb.height), rgb.samples)
    original = document.extract_image(image_xref)
    return Image.open(io.BytesIO(original['image'])).convert('RGB')


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
        for name, (page_index, bounds, *options) in crops.items():
            if name.endswith('.svg'):
                (box,) = bounds
                graphic = cropped_svg(document, page_index, fitz.Rect(box))
                (output / name).write_text(graphic, encoding='utf-8')
            else:
                page = document[page_index]
                if options and options[0].get('original'):
                    # Image inspection can affect subsequent renderings in the same PDF instance.
                    with fitz.open(pdf_path) as original:
                        fragments = [extract_original(original, original[page_index], rect, options[0].get('xref'))
                                     for rect in bounds]
                    padding = options[0].get('padding', 0)
                    if padding:
                        fragments = [ImageOps.expand(fragment, padding, fill='white') for fragment in fragments]
                elif not options or options[0].get('clear'):
                    clear = options[0]['clear'] if options else ()
                    fragments = [extract_fragment(page, rect, scale, clear) for rect in bounds]
                else:
                    raise ValueError(f'Unknown figure extraction options: {options}')
                combine_fragments(fragments, gap).save(output / f'{name}.webp', lossless=True, method=webp_method)


def display_segments():
    # Traced from the identical 262 × 42 raster in the 2022 booklets for grades 4–5, 6–7 and 8–9.
    segments = [
        'M0 0H18', 'M0 16H18', 'M0 32H18',
        'M0 0V16', 'M18 0V16', 'M0 16V32', 'M18 16V32',
        'M0 16L18 0', 'M0 32L18 16',
    ]
    lit = [
        (0,2,3,4,5,6), (4,6,7), (0,2,4,8), (0,1,7,8), (1,3,4,6),
        (0,1,2,3,6), (1,2,5,6,7), (0,5,7), (0,1,2,3,4,5,6), (0,1,3,4,8),
    ]
    digits = []
    for index, active in enumerate(lit):
        bold = ''.join(segments[i] for i in active)
        digits.append(f'<g transform="translate({5 + 26*index} 5)">'
                      f'<use href="#segments"/><path d="{bold}" stroke-width="4.5"/></g>')
    graphic = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 262 42" width="262" height="42">'
               f'<defs><path id="segments" d="{"".join(segments)}"/></defs>'
               '<rect width="262" height="42" fill="white"/>'
               f'<g fill="none" stroke="black" stroke-width="0.85" stroke-linecap="square">{"".join(digits)}</g></svg>\n')
    (ASSETS / '2022' / 'display-segments.svg').write_text(graphic, encoding='utf-8')


if __name__ == '__main__':
    for manifest_path in sorted(SOURCES.glob('*/*-figures.json')):
        build_figures(manifest_path)
    display_segments()
    build_interactive()
