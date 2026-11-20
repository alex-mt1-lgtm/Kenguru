import json
from pathlib import Path

import fitz
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources' / 'chip'
ASSETS = ROOT / 'dist' / 'assets' / 'chip'


def build_figures(manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    output = ASSETS / manifest_path.parent.name
    output.mkdir(parents=True, exist_ok=True)
    with fitz.open(manifest_path.with_name(manifest['source'])) as document:
        for name, figure in manifest['figures'].items():
            page = document[figure['page']]
            if 'xref' in figure:
                pixels = fitz.Pixmap(document, figure['xref'])
            else:
                scale = manifest['renderScale']
                pixels = page.get_pixmap(
                    matrix=fitz.Matrix(scale, scale),
                    clip=fitz.Rect(figure['box']),
                    alpha=False,
                )
            image = Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples)
            if figure.get('flipVertical'):
                image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            if 'badge' in figure:
                badge = fitz.Rect(figure['badge']) * fitz.Matrix(scale, scale)
                pixel_box = badge.irect - (pixels.x, pixels.y, pixels.x, pixels.y)
                ImageDraw.Draw(image).rectangle(tuple(pixel_box), fill=image.getpixel((0, 0)))
            if 'imageBox' in figure:
                image = image.crop(figure['imageBox'])
            image.save(output / f'{name}.webp', lossless=True)


if __name__ == '__main__':
    for manifest_path in sorted(SOURCES.glob('*/figures.json')):
        build_figures(manifest_path)
