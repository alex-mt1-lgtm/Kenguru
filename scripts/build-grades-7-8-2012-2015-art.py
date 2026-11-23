"""Rebuild the checked illustrations for the 2012–2015 grade 7–8 editions."""
import json
from pathlib import Path
from xml.etree import ElementTree

import fitz
from PIL import Image

from archive_condition_art import vector_display_size, vector_figure
from pdf_figure import cropped_svg, remove_print_marks


ROOT = Path(__file__).resolve().parents[1]


def output_image(document, record, target):
    page = record['page']
    if 'xref' in record:
        xref = record['xref']
        mask = next(mask for image, mask, *_ in document[page].get_images() if image == xref)
        pixels = fitz.Pixmap(document, xref)
        if mask:
            pixels = fitz.Pixmap(pixels, fitz.Pixmap(document, mask))
        if pixels.colorspace is None or pixels.colorspace.n > 3:
            pixels = fitz.Pixmap(fitz.csRGB, pixels)
        mode = {1: 'L', 2: 'LA', 3: 'RGB', 4: 'RGBA'}[pixels.n]
        image = Image.frombytes(mode, (pixels.width, pixels.height), pixels.samples)
        image.save(target.with_suffix('.webp'), lossless=True)
    else:
        region = fitz.Rect(record['clip'])
        width, height = vector_display_size(region.width, region.height)
        if unwanted := record.get('eraseArtwork'):
            with fitz.open() as isolated:
                isolated.insert_pdf(document, from_page=page, to_page=page)
                upright = isolated[0]
                if upright.rotation:
                    upright.remove_rotation()
                for rectangle in unwanted:
                    upright.add_redact_annot(fitz.Rect(rectangle), fill=False, cross_out=False)
                upright.apply_redactions(images=0, graphics=2, text=0)
                svg = vector_figure(isolated, 0, region, width, height)
        elif record.get('embeddedImage'):
            svg = cropped_svg(document, page, region)
        else:
            svg = vector_figure(document, page, region, width, height)
        if 'omitGlyphs' in record:
            svg = remove_print_marks(ElementTree.fromstring(svg), omit_glyphs=record['omitGlyphs'])
        target.with_suffix('.svg').write_text(svg, encoding='utf-8')


def main():
    for year in range(2012, 2016):
        manifest = ROOT / 'sources' / 'math-completion' / f'{year}-7-8-art.json'
        if not manifest.exists():
            continue
        records = json.loads(manifest.read_text(encoding='utf-8'))
        folder = ROOT / 'dist' / 'assets' / 'grades-7-8' / str(year)
        folder.mkdir(parents=True, exist_ok=True)
        with fitz.open(ROOT / 'sources' / 'grades-7-8' / str(year) / 'tasks.pdf') as document:
            for label, record in records.items():
                number, _, answer = label.partition('-')
                name = f'task-{int(number):02d}'
                if answer:
                    name += f'-answer-{answer}'
                output_image(document, record, folder / name)


if __name__ == '__main__':
    main()
