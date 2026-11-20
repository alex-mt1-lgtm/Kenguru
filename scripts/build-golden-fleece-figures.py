import json
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources' / 'golden-fleece'


def render(page, scale, rect=None):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=rect, alpha=False)
    return Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)


def build_figures(manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    figures = manifest.get('figures', manifest)
    pdf_path = manifest_path.with_name(manifest.get('source', 'tasks.pdf'))
    rendered_pages = {}

    with fitz.open(pdf_path) as document:
        for figure in figures.values():
            page = document[figure['page']]
            scale = figure.get('scale', manifest.get('scale'))
            if 'box' in figure:
                # Pixel coordinates refer to an already rendered full page.
                page_key = (page.number, scale)
                if page_key not in rendered_pages:
                    rendered_pages[page_key] = render(page, scale)
                image = rendered_pages[page_key].crop(figure['box'])
            else:
                image = render(page, scale, fitz.Rect(figure['rect']))

            output = ROOT / 'dist' / figure['src']
            output.parent.mkdir(parents=True, exist_ok=True)
            image.save(output, lossless=True)


if __name__ == '__main__':
    for manifest in sorted(SOURCES.glob('*/figures.json')):
        build_figures(manifest)
