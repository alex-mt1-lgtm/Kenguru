"""Extract 2012 КИТ artwork from the printer's imposed PDF sheets.

Each crop uses PDF points in an upright quadrant. Quadrants 0 and 1 are
the left half of the original sheet, and 2 and 3 are the right half. The
two halves are rotated in opposite directions in the original.
"""

import json
from pathlib import Path
from xml.etree import ElementTree

import fitz
from PIL import Image

from pdf_figure import SVG, cropped_svg


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'sources' / 'kit' / '2012'
OUTPUT = ROOT / 'dist' / 'assets' / 'kit' / '2012'


def sheet_box(page, quadrant, bounds):
    half_width = page.rect.width / 2
    column_width = page.rect.height / 2
    left, top, right, bottom = bounds
    if quadrant not in range(4) or not (
        0 <= left < right <= column_width and 0 <= top < bottom <= half_width
    ):
        raise ValueError(f'Crop outside quadrant {quadrant}: {bounds}')
    left += column_width * (quadrant % 2)
    right += column_width * (quadrant % 2)
    if quadrant < 2:
        return fitz.Rect(half_width - bottom, left, half_width - top, right), 90
    return fitz.Rect(half_width + top, page.rect.height - right,
                     half_width + bottom, page.rect.height - left), 270


def upright_svg(document, page_index, box, rotation):
    graphic = ElementTree.fromstring(cropped_svg(document, page_index, box))
    _, _, width, height = map(float, graphic.get('viewBox').split())
    graphic.set('viewBox', f'0 0 {height:g} {width:g}')
    graphic.set('width', f'{height:g}')
    graphic.set('height', f'{width:g}')
    content = list(graphic)
    matrix = f'0 -1 1 0 0 {width:g}' if rotation == 90 else f'0 1 -1 0 {height:g} 0'
    rotated = ElementTree.SubElement(graphic, f'{{{SVG}}}g', {'transform': f'matrix({matrix})'})
    for item in content:
        if item.tag != f'{{{SVG}}}defs':
            graphic.remove(item)
            rotated.append(item)
    return ElementTree.tostring(graphic, encoding='unicode') + '\n'


def build_figures(manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    pdf = manifest_path.with_name(manifest_path.name.replace('-interactive-crops.json', '.pdf'))
    with fitz.open(pdf) as document:
        for filename, (page_index, quadrant, bounds) in manifest['crops'].items():
            page = document[page_index]
            box, rotation = sheet_box(page, quadrant, bounds)
            output = OUTPUT / filename
            if output.suffix == '.svg':
                output.write_text(upright_svg(document, page_index, box, rotation), encoding='utf-8')
            elif output.suffix == '.webp':
                scale = manifest['renderScale']
                pixels = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=box)
                figure = Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples)
                figure.rotate(rotation, expand=True).save(output, lossless=True, method=4)
            else:
                raise ValueError(f'Unsupported artwork format: {filename}')


if __name__ == '__main__':
    ElementTree.register_namespace('', SVG)
    ElementTree.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
    for path in sorted(SOURCE.glob('*-interactive-crops.json')):
        build_figures(path)
