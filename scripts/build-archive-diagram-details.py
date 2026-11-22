"""Extract the reviewed Kenguru diagram series from their printed booklets."""
from base64 import b64encode
from io import BytesIO
import json
from pathlib import Path

import fitz
from PIL import Image, ImageOps

from pdf_figure import cropped_svg

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'dist/assets'
SOURCES = ROOT / 'sources'


def vector(path, document, page_number, region):
    path.write_text(cropped_svg(document, page_number, fitz.Rect(region)), encoding='utf-8')


def stacked_figure(document, page_number, regions, path):
    # The printed diagrams surround paragraphs which are already accessible as text.
    regions = list(map(fitz.Rect, regions))
    width = max(region.width for region in regions)
    height = sum(region.height for region in regions) + 5 * (len(regions) - 1)
    images = []
    top = 0
    for region in regions:
        svg = cropped_svg(document, page_number, region)
        data = b64encode(svg.encode()).decode()
        left = (width - region.width) / 2
        images.append(f'<image x="{left:g}" y="{top:g}" width="{region.width:g}" height="{region.height:g}" '
                      f'xlink:href="data:image/svg+xml;base64,{data}"/>')
        top += region.height + 5
    path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                    f'viewBox="0 0 {width:g} {height:g}">\n' + '\n'.join(images) + '\n</svg>\n')


def printed_rings(page, region, destination):
    # The closing parenthesis beside each option is a separate printed path.
    # Only the five filled, concentric discs belong to the actual option.
    circles = []
    for shape in page.get_drawings():
        rect = shape['rect']
        if shape['type'] != 'f' or not region.contains(rect) or abs(rect.width - rect.height) > .05:
            continue
        colour = '#' + ''.join(f'{round(value * 255):02x}' for value in shape['fill'])
        circles.append((rect.width / 2, colour))
    if len(circles) != 5:
        raise ValueError(f'Expected five printed rings, found {len(circles)}')
    content = [f'<circle cx="21" cy="21" r="{r:.2f}" fill="{colour}"/>' for r, colour in sorted(circles, reverse=True)]
    destination.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 42" '
                           'stroke="#231f20" stroke-width=".18">\n' + '\n'.join(content) + '\n</svg>\n')


def main():
    # These monochrome illustrations are complete embedded images. Taking the object
    # itself excludes the coloured lettering and hairline borders of the printed page.
    drawings = [(1998, 11, 8, (98, 149)), (2001, 24, 9, (313, 316)),
                (2001, 26, 10, (529, 229)), (2001, 30, 13, (564, 493))]
    for year, number, xref, size in drawings:
        folder = SOURCES / 'grades-9-10' / str(year)
        with fitz.open(folder / 'tasks.pdf') as document:
            data = document.extract_image(xref)
            with Image.open(BytesIO(data['image'])) as source:
                if source.size != size:
                    raise ValueError(f'Unexpected source for {year} task {number}: {source.size}')
                padded = ImageOps.expand(source.convert('RGB'), border=3, fill='white')
                padded.save(ASSETS / f'grades-9-10/{year}/original-{number}.webp', lossless=True)

    for year, number in [(2017, 21), (2021, 17)]:
        folder = SOURCES / 'grades-2' / str(year)
        task = json.loads((folder / 'edition.json').read_text())['tasks'][number - 1]
        with fitz.open(folder / 'tasks.pdf') as document:
            stacked_figure(document, task['page'], task['figureParts'],
                           ASSETS / f'grades-2/{year}/stacked-{number}.svg')

    with fitz.open(SOURCES / '2019/tasks.pdf') as document:
        stacked_figure(document, 1, [(730, 82, 797, 155), (476, 147.5, 666, 168)],
                       ASSETS / 'legacy-conditions/2019/dominoes.svg')

    with fitz.open(ASSETS / 'kenguru/kenguru_2020_class_3-4.pdf') as document:
        for i, (left, right) in enumerate([(463, 510), (535, 582), (608, 656), (680, 706), (729, 744)], 1):
            vector(ASSETS / f'years/2020/fold-{i}.svg', document, 0, (left, 405.5, right, 459.5))

    folder = SOURCES / 'grades-2/2022'
    task = json.loads((folder / 'edition.json').read_text())['tasks'][12]
    with fitz.open(folder / 'tasks.pdf') as document:
        for i, region in enumerate(task['choiceRects'], 1):
            printed_rings(document[task['page']], fitz.Rect(region), ASSETS / f'grades-2/2022/rings-{i}.svg')


if __name__ == '__main__':
    main()
