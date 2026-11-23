"""Rebuild illustrations for the 1997–2001 grade 7–8 lessons."""

import json
from pathlib import Path
from xml.etree import ElementTree

import fitz
from PIL import Image

from pdf_figure import cropped_svg, remove_print_marks


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'sources' / 'math-completion' / 'art-1997-2001-7-8.json'


def figure(document, page, region, omit_glyphs=()):
    rect = fitz.Rect(region)
    if rect.is_empty or rect not in document[page].rect:
        raise ValueError(f'Invalid crop on page {page}: {region}')
    return remove_print_marks(
        ElementTree.fromstring(cropped_svg(document, page, rect)),
        clear_watermark=True,
        omit_glyphs=omit_glyphs,
    )


def raster(page, region):
    rect = fitz.Rect(region)
    candidates = page.get_image_info()
    image = max(candidates, key=lambda entry: (fitz.Rect(entry['bbox']) & rect).get_area())
    bounds = fitz.Rect(image['bbox'])
    scale = max(image['width'] / bounds.width, image['height'] / bounds.height)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=rect, alpha=False)
    return Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)


def octagon_grid(page, regions):
    # Keep the printed numbers with their figures. Two rows allow pupils to
    # compare the shaded parts on a phone without shrinking the individual crops.
    crops = [raster(page, region) for region in regions]
    width = max(crop.width for crop in crops)
    height = max(crop.height for crop in crops)
    gap = 12
    grid = Image.new('RGB', (3 * width + 2 * gap, 2 * height + gap), 'white')
    for index, crop in enumerate(crops):
        left = (index % 3) * (width + gap) + (width - crop.width) // 2
        top = (index // 3) * (height + gap) + (height - crop.height) // 2
        grid.paste(crop, (left, top))
    return grid


def build():
    specifications = json.loads(DATA.read_text(encoding='utf-8'))
    for year, tasks in specifications.items():
        source = ROOT / 'sources' / 'grades-7-8' / year / 'tasks.pdf'
        output = ROOT / 'dist' / 'assets' / 'grades-7-8' / year
        output.mkdir(parents=True, exist_ok=True)
        with fitz.open(source) as document:
            for number, task in tasks.items():
                name = f'task-{int(number):02d}'
                if 'condition' in task:
                    page, region, _ = task['condition']
                    if task.get('raster'):
                        raster(document[page], region).save(output / f'{name}.webp', lossless=True)
                    else:
                        markup = figure(document, page, region, task.get('omitConditionGlyphs', ()))
                        (output / f'{name}.svg').write_text(markup, encoding='utf-8')
                if 'conditionParts' in task:
                    page, regions, _ = task['conditionParts']
                    octagon_grid(document[page], regions).save(output / f'{name}.webp', lossless=True)
                if 'options' in task:
                    page, regions, _ = task['options']
                    for index, region in enumerate(regions, 1):
                        file = output / f'{name}-answer-{index}.svg'
                        file.write_text(figure(document, page, region, task.get('omitOptionGlyphs', ())),
                                        encoding='utf-8')


if __name__ == '__main__':
    build()
