"""Rebuild figures from the original and marked Russian Bear booklets."""
import json
from pathlib import Path

import fitz
from PIL import Image, ImageDraw

from pdf_figure import cropped_svg


ROOT = Path(__file__).resolve().parents[1]


def bitmap(document, page, xref):
    _, mask, *_ = next(item for item in document[page].get_images() if item[0] == xref)
    pixels = fitz.Pixmap(document, xref)
    if mask:
        pixels = fitz.Pixmap(pixels, fitz.Pixmap(document, mask))
    if pixels.colorspace.n > 3:
        pixels = fitz.Pixmap(fitz.csRGB, pixels)
    mode = {1: 'L', 2: 'LA', 3: 'RGB', 4: 'RGBA'}[pixels.n]
    return Image.frombytes(mode, (pixels.width, pixels.height), pixels.samples)


def main():
    for manifest in sorted((ROOT / 'sources' / 'medvezhonok').glob('*/edition-art-*.json')):
        year = manifest.parent.name
        output = ROOT / 'dist' / 'assets' / 'medvezhonok' / year
        output.mkdir(parents=True, exist_ok=True)
        for filename, record in json.loads(manifest.read_text(encoding='utf-8')).items():
            with fitz.open(manifest.parent / record['source']) as document:
                page = record['page']
                destination = output / filename
                if 'xref' in record:
                    image = bitmap(document, page, record['xref'])
                    if 'imageClip' in record:
                        image = image.crop(tuple(record['imageClip']))
                    for rectangle in record.get('whiteout', []):
                        ImageDraw.Draw(image).rectangle(rectangle, fill='white')
                    image.save(destination, lossless=True)
                elif 'scale' in record:
                    scale = record['scale']
                    pixels = document[page].get_pixmap(
                        matrix=fitz.Matrix(scale, scale), clip=fitz.Rect(record['clip']),
                        alpha=False,
                    )
                    Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples).save(
                        destination, lossless=True,
                    )
                else:
                    if document[page].rotation:
                        document[page].remove_rotation()
                    svg = cropped_svg(document, page, fitz.Rect(record['clip']))
                    destination.write_text(svg, encoding='utf-8')


if __name__ == '__main__':
    main()
