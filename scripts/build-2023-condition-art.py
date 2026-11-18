"""Export condition figures and pictured choices from the 2023 3–4 PDF."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import re
import subprocess

import fitz


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'dist' / 'assets' / 'years' / '2023'
VECTOR_SPEC = spec_from_file_location('lesson_vectors', Path(__file__).with_name('build-lesson-vectors.py'))
vectors = module_from_spec(VECTOR_SPEC)
VECTOR_SPEC.loader.exec_module(vectors)

# Each region selects complete paths on a printed page. The second number
# on a fragment is its horizontal displacement after separating it from prose.
FIGURES = {
    1: (0, [((303, 111, 397, 163), 0)]),
    2: (0, [((225, 192, 398, 217), 0)]),
    3: (0, [((202, 256, 396, 323), 0)]),
    4: (0, [((186, 350, 396, 416), 0)]),
    5: (0, [((50, 457, 383, 515), 0)]),
    6: (1, [((324, 19, 402, 63), 0)]),
    7: (1, [((319, 89, 402, 137), 0)]),
    8: (1, [((210, 164, 250, 186), 0), ((255, 164, 276, 186), 0), ((342, 153, 382, 193), -58)]),
    9: (1, [((325, 257, 401, 321), 0)]),
    10: (1, [((232, 364, 402, 403), 0)]),
    13: (2, [((266, 20, 397, 97), 0)]),
    14: (2, [((231, 104, 397, 137), 0)]),
    15: (2, [((329, 196, 396, 256), 0)]),
    17: (2, [((246, 395, 396, 418), 0)]),
    20: (3, [((231, 21, 403, 65), 0)]),
    21: (3, [((178, 122, 404, 175), 0)]),
    22: (3, [((164, 213, 402, 250), 0), ((196, 279, 402, 314), 0)]),
    23: (3, [((331, 338, 404, 414), 0)]),
}

CHOICES = {
    6: (1, [(60, 65, 114, 86), (130, 65, 184, 86), (201, 65, 256, 86),
            (271, 65, 326, 86), (344, 65, 398, 86)]),
    8: (1, [(60, 201, 99, 240), (131, 201, 170, 240), (202, 201, 241, 240),
            (272, 201, 311, 240), (345, 201, 384, 240)]),
    9: (1, [(59, 317, 106, 338), (135, 307, 153, 340), (182, 308, 216, 340),
            (239, 302, 260, 347), (287, 317, 319, 338)]),
    11: (1, [(60, 490, 113, 516), (130, 490, 184, 516), (201, 490, 255, 516),
             (271, 490, 326, 516), (342, 490, 396, 516)]),
    16: (2, [(55, 325, 91, 367), (125, 325, 163, 367), (196, 325, 234, 367),
             (266, 325, 302, 367), (338, 325, 375, 367)]),
    20: (3, [(60, 77, 100, 117), (131, 77, 171, 117), (202, 77, 241, 117),
             (272, 77, 311, 117), (344, 77, 384, 117)]),
    24: (3, [(60, 498, 105, 544), (130, 498, 176, 544), (201, 498, 247, 544),
             (271, 498, 317, 544), (345, 498, 391, 544)]),
}


def svg_path(drawing):
    path = vectors.svg_path(drawing)
    if 's' not in drawing['type']:
        return path

    dash_spec = re.fullmatch(r'\[\s*(.*?)\s*\]\s*(.*)', drawing['dashes'] or '')
    if dash_spec and dash_spec[1]:
        path = path[:-2] + f' stroke-dasharray="{dash_spec[1]}" stroke-dashoffset="{dash_spec[2]}"/>'
    cap = ['butt', 'round', 'square'][max(map(int, drawing['lineCap']))]
    join = ['miter', 'round', 'bevel'][int(drawing['lineJoin'])]
    return path[:-2].replace('stroke-linejoin="round"', f'stroke-linejoin="{join}"') + f' stroke-linecap="{cap}"/>'


def export(drawings, fragments, name):
    shape = []
    inset = fitz.Rect()
    for bounds, shift in fragments:
        region = fitz.Rect(bounds)
        paths = [drawing for drawing in drawings if region.contains(drawing['rect'])]
        if not paths:
            raise ValueError(f'No vector paths for {name} inside {bounds}')
        for path in paths:
            inset |= path['rect'] + (shift, 0, shift, 0)
        markup = '\n'.join(map(svg_path, paths))
        shape.append(f'<g transform="translate({shift} 0)">\n{markup}\n</g>' if shift else markup)

    inset += (-1.8, -1.8, 1.8, 1.8)
    viewbox = ' '.join(map(vectors.number, (inset.x0, inset.y0, inset.width, inset.height)))
    width, height = round(inset.width * 3.5), round(inset.height * 3.5)
    (DESTINATION / f'{name}.svg').write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="{viewbox}">\n'
        + '\n'.join(shape) + '\n</svg>\n',
        encoding='utf-8',
    )


def export_clipped(booklet, page_number, bounds, name):
    # Complex artwork uses nested clipping for road edges and colored boxes.
    # Cairo keeps those clipping paths when converting the cropped PDF page.
    region = fitz.Rect(bounds)
    with fitz.open() as fragment:
        page = fragment.new_page(width=region.width, height=region.height)
        page.show_pdf_page(page.rect, booklet, page_number, clip=region)
        markup = subprocess.run(
            ['pdftocairo', '-svg', '-', '-'], input=fragment.tobytes(),
            stdout=subprocess.PIPE, check=True,
        ).stdout.decode('utf-8')
    width, height = round(region.width * 3.5), round(region.height * 3.5)
    markup = re.sub(r'(<svg[^>]+) width="[^"]+" height="[^"]+"',
                    rf'\1 width="{width}" height="{height}"', markup, count=1)
    (DESTINATION / f'{name}.svg').write_text(markup, encoding='utf-8')


def main():
    with fitz.open(ROOT / 'sources' / '2023' / 'tasks.pdf') as booklet:
        drawings = [page.get_drawings() for page in booklet]
        for number, (page, fragments) in FIGURES.items():
            name = f'condition-{number}'
            if number == 13:
                export_clipped(booklet, page, fragments[0][0], name)
            else:
                export(drawings[page], fragments, name)
        for number, (page, regions) in CHOICES.items():
            for i, bounds in enumerate(regions):
                name = f'condition-{number}-choice-{i}'
                if number == 16:
                    export_clipped(booklet, page, bounds, name)
                else:
                    export(drawings[page], [(bounds, 0)], name)


if __name__ == '__main__':
    main()
