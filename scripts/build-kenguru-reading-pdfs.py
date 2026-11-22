"""Build editorial reading copies for checked Kenguru illustrations."""

from collections import defaultdict
from pathlib import Path

import fitz


ARCHIVE = Path(__file__).resolve().parents[1] / 'dist' / 'assets' / 'kenguru'
ILLUSTRATIONS = ARCHIVE / 'illustrations'
FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
NOTE_COLOR = (0.18, 0.28, 0.41)

# Each entry gives the zero-based page, task number, and figure rectangle in
# points on the archived upright page. The SVG is an editorial reconstruction.
BOOKLETS = {
    '1997_class_5-6': (
        (0, 2, '1997-five-shapes', (264, 194, 398, 278.5)),
    ),
    '1997_class_7-8': (
        (2, 18, '1997-pyramid-cut', (298, 196, 395, 296)),
        (4, 28, '1997-eight-cell-board', (310, 108.5, 395, 191)),
    ),
    '1997_class_9-10': (
        (0, 3, '1997-square-acfe', (305.29, 211.18, 394.12, 302.94)),
        (1, 10, '1997-angle-algebra', (274.12, 199.41, 394.12, 255.29)),
        (2, 17, '1997-eight-cell-board', (310, 233.53, 395.29, 318.24)),
    ),
    '1998_class_5-6': (
        (1, 10, '1998-mittens', (283, 192, 395, 270)),
        (3, 25, '1998-four-portraits', (78, 256, 373, 313)),
    ),
    '1998_class_7-8': (
        (1, 13, '1998-four-portraits', (75, 398, 369, 455.5)),
    ),
    '1998_class_9-10': (
        (0, 3, '1998-fold-diagonal', (328.82, 203.53, 394.71, 271.76)),
        (2, 19, '1998-function-shape', (277.06, 219.41, 397.06, 284.71)),
    ),
    '1999_class_5-6': (
        (0, 3, '1999-square-midpoint', (327, 215.2, 395, 279)),
    ),
    '1999_class_7-8': (
        (2, 16, '1999-directed-paths', (272.5, 101, 395.5, 168)),
    ),
    '1999_class_9-10': (
        (2, 18, '1999-directed-paths', (273.5, 221.5, 398, 291.5)),
        (3, 23, '1999-modulus-graph', (279, 180, 396.5, 261.5)),
    ),
}

# The lower-left corner of the pyramid's bounding box includes task 19.
PYRAMID_MASK = (
    (338, 196), (351, 196), (395, 255), (395, 296), (378, 296),
    (337, 275), (328, 272), (297.5, 257), (297.5, 253), (338, 196),
)


def draw_note(page, x, y, message, size=8.2):
    page.insert_text((x, y), message, fontname='ReadingNote', fontfile=FONT,
                     fontsize=size, color=NOTE_COLOR)


def place_figure(page, name, bounds):
    rectangle = fitz.Rect(bounds)
    if not page.rect.contains(rectangle):
        raise ValueError(f'{name} is outside page {page.number + 1}')
    if name == '1997-pyramid-cut':
        page.draw_polyline(PYRAMID_MASK, color=None, fill=(1, 1, 1))
    else:
        page.draw_rect(rectangle, color=None, fill=(1, 1, 1))
    drawing = ILLUSTRATIONS / f'{name}.svg'
    with fitz.open(drawing) as vector:
        with fitz.open('pdf', vector.convert_to_pdf()) as figure:
            page.show_pdf_page(rectangle, figure)


def annotate_booklet(document, entries):
    tasks_by_page = defaultdict(list)
    for page_number, task_number, name, bounds in entries:
        place_figure(document[page_number], name, bounds)
        tasks_by_page[page_number].append(task_number)
    for page_number, tasks in tasks_by_page.items():
        page = document[page_number]
        numbers = ', '.join(map(str, tasks))
        draw_note(page, 74, page.rect.height - 21,
                  f'Версия для чтения · редакционная перерисовка к № {numbers}')


def build(name, entries):
    original = ARCHIVE / f'kenguru_{name}.pdf'
    destination = original.with_name(f'{original.stem}-reading.pdf')
    with fitz.open(original) as booklet:
        annotate_booklet(booklet, entries)
        metadata = booklet.metadata
        metadata['title'] = f'Кенгуру {name[:4]} · версия для чтения'
        booklet.set_metadata(metadata)
        booklet.save(destination, garbage=3, deflate=True, no_new_id=True)


if __name__ == '__main__':
    for name, entries in BOOKLETS.items():
        build(name, entries)
