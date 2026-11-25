"""Rebuild lesson images from registered booklet crops and restored masters."""
import argparse
import json
from pathlib import Path

import fitz
from PIL import Image, ImageDraw

from pdf_figure import cropped_svg


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources/golden-fleece'


def save_image(image, output, max_side=None):
    output.parent.mkdir(parents=True, exist_ok=True)
    image = image.copy()
    if max_side:
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    image.save(output, format='WEBP', lossless=True, method=4)


def from_booklet(year, spec):
    with fitz.open(SOURCES / str(year) / spec['pdf']) as document:
        page = document[spec['page']]
        rect = fitz.Rect(spec['rect'])
        if spec.get('xref'):
            info = [occurrence for occurrence in page.get_image_info(xrefs=True)
                    if occurrence['xref'] == spec['xref']
                    and all(abs(a - b) < 0.02 for a, b in zip(occurrence['bbox'], rect))]
            if len(info) != 1:
                raise ValueError(f'Cannot locate image in {spec["pdf"]}: {spec}')
            pixmap = fitz.Pixmap(document, spec['xref'])
            if pixmap.colorspace != fitz.csRGB:
                pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
            mask_type, mask = document.xref_get_key(spec['xref'], 'SMask')
            if mask_type == 'xref':
                pixmap = fitz.Pixmap(pixmap, fitz.Pixmap(document, int(mask.split()[0])))
            image = Image.frombytes('RGBA' if pixmap.alpha else 'RGB', (pixmap.width, pixmap.height),
                                    pixmap.samples)
            x_scale, x_skew, y_skew, y_scale, _, _ = info[0]['transform']
            if abs(x_skew) > 0.001 or abs(y_skew) > 0.001:
                raise ValueError(f'Use a display crop for a rotated image: {spec}')
            if x_scale < 0:
                image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if y_scale < 0:
                image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            return image
        pixmap = page.get_pixmap(matrix=fitz.Matrix(spec['scale'], spec['scale']), clip=rect)
        return Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)


def build_art(year, spec):
    output = ROOT / 'dist' / spec['src']
    if output.suffix == '.svg':
        with fitz.open(SOURCES / str(year) / spec['pdf']) as document:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(cropped_svg(document, spec['page'], fitz.Rect(spec['rect'])), encoding='utf-8')
        return
    if 'masterFile' in spec:
        with Image.open(SOURCES / 'reading-art' / spec['masterFile']) as original:
            image = original.convert('RGB')
        if 'crop' in spec:
            image = image.crop(spec['crop'])
    else:
        image = from_booklet(year, spec)
    if 'coverInscription' in spec:
        inscription = spec['coverInscription']
        ImageDraw.Draw(image).polygon([tuple(point) for point in inscription['polygon']],
                                      fill=tuple(inscription['fill']))
    if spec.get('detailSrc'):
        save_image(image, ROOT / 'dist' / spec['detailSrc'])
    save_image(image, output, spec.get('previewMaxSide'))
    with Image.open(output) as preview:
        if preview.size != (spec['width'], spec['height']):
            raise ValueError(f'Incorrect output dimensions for {output}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('years', nargs='*', type=int)
    args = parser.parse_args()
    for year in args.years or range(2015, 2023):
        path = SOURCES / str(year) / 'lesson-art.json'
        if args.years or path.exists():
            for spec in json.loads(path.read_text(encoding='utf-8')):
                build_art(year, spec)


if __name__ == '__main__':
    main()
