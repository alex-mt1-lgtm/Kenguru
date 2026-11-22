"""Export official lesson figures as vector-only SVGs (PyMuPDF)."""

from pathlib import Path
from xml.etree import ElementTree

import fitz

from pdf_figure import cropped_svg, remove_print_marks


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources' / '2026'
OUTPUT = ROOT / 'dist' / 'assets' / 'years' / '2026'
TASK_REGIONS = {
    'puzzle-start': (325, 80, 399, 152),
    'puzzle-choice-0': (56, 107, 117, 140),
    'puzzle-choice-1': (144, 105, 191, 151),
    'puzzle-choice-2': (224, 105, 270, 151),
    'puzzle-choice-3': (56, 137, 117, 172),
    'puzzle-choice-4': (152, 138, 210, 172),
}


def number(value):
    return f'{value:.3f}'.rstrip('0').rstrip('.')


def point(position):
    return f'{number(position.x)},{number(position.y)}'


def color(rgb):
    return '#' + ''.join(f'{round(component * 255):02x}' for component in rgb) if rgb else 'none'


def svg_path(drawing):
    segments = []
    end = None
    for kind, *parts in drawing['items']:
        if kind == 're':
            rect, orientation = parts
            points = [rect.tl, rect.tr, rect.br, rect.bl]
            if orientation < 0:
                points.reverse()
            segments.append(f'M{point(points[0])}L' + ' '.join(map(point, points[1:])) + 'Z')
            end = None
            continue
        if kind == 'qu':
            (quad,) = parts
            points = [quad.ul, quad.ur, quad.lr, quad.ll]
            segments.append(f'M{point(points[0])}L' + ' '.join(map(point, points[1:])) + 'Z')
            end = None
            continue
        if kind not in {'c', 'l'}:
            raise ValueError(f'Unexpected path segment {kind}')
        start, *controls, new_end = parts
        if start != end:
            segments.append('M' + point(start))
        segments.append(kind.upper() + ' '.join(map(point, [*controls, new_end])))
        end = new_end
    if drawing.get('closePath') and end is not None:
        segments.append('Z')

    paint = []
    if drawing.get('even_odd'):
        paint.append('fill-rule="evenodd"')
    if drawing.get('fill_opacity') not in (None, 1):
        paint.append(f'fill-opacity="{number(drawing["fill_opacity"])}"')
    if 's' in drawing['type']:
        paint.extend([
            f'stroke="{color(drawing["color"])}"',
            f'stroke-width="{number(drawing["width"])}"',
            f'stroke-opacity="{number(drawing["stroke_opacity"])}"',
            'stroke-linejoin="round"',
        ])
    return '<path d="' + ''.join(segments) + '" fill="' + color(drawing.get('fill')) + '" ' + ' '.join(paint) + '/>'


def export(page, bounds, destination):
    region = fitz.Rect(bounds)
    drawings = [drawing for drawing in page.get_drawings() if region.contains(drawing['rect'])]
    if not drawings:
        raise ValueError(f'No vector paths for {destination.name}')
    inset = fitz.Rect()
    for drawing in drawings:
        inset |= drawing['rect']
    inset += (-.38, -.38, .38, .38)
    viewbox = ' '.join(map(number, (inset.x0, inset.y0, inset.width, inset.height)))
    paths = '\n'.join(map(svg_path, drawings))
    destination.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">\n{paths}\n</svg>\n',
        encoding='utf-8',
    )


def export_cookie_choices(book):
    page = 3
    regions = [
        (38.9, 439.4, 79, 454), (95.1, 439.4, 176, 454),
        (190.3, 439.4, 262, 454), (276.6, 439.4, 351.2, 454),
        (368.2, 439.4, 399.85, 454),
    ]
    frame_width = max(region[2] - region[0] for region in regions) + 1
    frame_height = regions[0][3] - regions[0][1]
    for index, bounds in enumerate(regions):
        region = fitz.Rect(bounds)
        svg = remove_print_marks(ElementTree.fromstring(cropped_svg(book, page, region)), omit_glyphs=('(', ')'))
        horizontal_padding = (frame_width - region.width) / 2
        # Use one scale for all five buttons so small and large cookies remain comparable.
        width, height = number(frame_width), number(frame_height)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
               f'viewBox="{number(-horizontal_padding)} 0 {width} {height}">\n{svg}</svg>\n')
        destination = ROOT / 'dist' / 'assets' / f'five-cookie-choice-{index}.svg'
        destination.write_text(svg, encoding='utf-8')
    region = fitz.Rect(368.2, 442.9, 399.85, 453.8)
    book[page].get_pixmap(matrix=fitz.Matrix(8, 8), clip=region).save(
        str(ROOT / 'dist' / 'assets' / 'five-cookie-choice-4.png'))


def main():
    with fitz.open(SOURCES / 'tasks.pdf') as tasks, fitz.open(SOURCES / 'solutions.pdf') as solutions:
        for name, region in TASK_REGIONS.items():
            export(tasks[0], region, OUTPUT / f'{name}.svg')
        export(solutions[3], (172, 51, 251, 129), OUTPUT / 'puzzle-complete.svg')
        # All scoops, their outlines and highlights belong to the choice.
        desserts = [(51.8, 327.6, 77.5, 365.4), (124.5, 327, 142, 365.5),
                    (193.4, 325.7, 221.8, 367.55), (263.6, 327.5, 291.7, 365.5),
                    (336.8, 324.65, 365.75, 367.55)]
        for index, region in enumerate(desserts):
            export(tasks[2], region, OUTPUT / f'ice-cream-choice-{index}.svg')

    cube_regions = {
        'remaining': (321, 13, 371, 57),
        'target': (321, 13, 401, 57),
        '0': (60, 49, 108, 104),
        '1': (130, 50, 180, 105),
        '2': (202, 61, 252, 105),
        '3': (272, 60, 322, 105),
        '4': (344, 54, 390, 105),
    }
    with fitz.open(ROOT / 'sources' / 'kenguru_2024_class_3-4.pdf') as book:
        for name, region in cube_regions.items():
            export(book[1], region, ROOT / 'dist' / 'assets' / f'cubes-{name}.svg')
        export_cookie_choices(book)

    with fitz.open(ROOT / 'sources' / 'grades-7-8' / '2022' / 'tasks.pdf') as book:
        # Export the native circle paths together, without adjoining letters.
        for option, region in enumerate([(50, 410, 90.7, 432), (122.9, 403.5, 154.9, 438.5)], 1):
            export(book[0], region, ROOT / 'dist' / 'assets' / 'grades-7-8' / '2022' /
                   f'task-05-answer-{option}.svg')


if __name__ == '__main__':
    main()
