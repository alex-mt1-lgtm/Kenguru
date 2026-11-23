"""Extract illustration and answer crops for the 2016–2019 grade 7–8 booklets."""

import argparse
import json
from pathlib import Path
from xml.etree import ElementTree

import fitz
from PIL import Image, ImageDraw

from archive_condition_art import vector_figure
from pdf_figure import SVG


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / 'sources' / 'kenguru-2016-2019-7-8-art.json'
RASTER_SCALE = 4.2


def build_year(year, figures):
    directory = ROOT / 'dist' / 'assets' / 'grades-7-8' / year
    directory.mkdir(parents=True, exist_ok=True)
    with fitz.open(ROOT / 'sources' / 'grades-7-8' / year / 'tasks.pdf') as document:
        for name, record in figures.items():
            page = record['page']
            rectangle = fitz.Rect(record['rectangle'])
            width, height = record['size']
            image_format = record.get('format', 'svg')
            destination = directory / f'{name}.{image_format}'
            exclude = [fitz.Rect(box) for box in record.get('exclude', [])]
            if image_format == 'webp':
                pixels = document[page].get_pixmap(
                    matrix=fitz.Matrix(RASTER_SCALE, RASTER_SCALE), clip=rectangle, alpha=False,
                )
                image = Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples)
                for box in exclude:
                    scaled = box * RASTER_SCALE - (pixels.x, pixels.y, pixels.x, pixels.y)
                    ImageDraw.Draw(image).rectangle(scaled, fill='white')
                image.save(destination, 'WEBP', lossless=True, method=6)
            else:
                drawing = vector_figure(document, page, rectangle, width, height)
                if exclude:
                    svg = ElementTree.fromstring(drawing)
                    for box in exclude:
                        ElementTree.SubElement(svg, f'{{{SVG}}}rect', {
                            'x': str(box.x0 - rectangle.x0),
                            'y': str(box.y0 - rectangle.y0),
                            'width': str(box.width),
                            'height': str(box.height),
                            'fill': 'white',
                        })
                    ElementTree.register_namespace('', SVG)
                    ElementTree.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
                    drawing = ElementTree.tostring(svg, encoding='unicode') + '\n'
                destination.write_text(drawing, encoding='utf-8')


def main():
    figures = json.loads(REGISTRY.read_text(encoding='utf-8'))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('years', nargs='*', choices=tuple(figures))
    options = parser.parse_args()
    for year in options.years or figures:
        build_year(year, figures[year])


if __name__ == '__main__':
    main()
