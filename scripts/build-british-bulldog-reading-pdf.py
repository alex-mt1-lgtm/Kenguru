"""Add the 2011 grades 3–4 board pictures to a separate reading copy."""
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'dist' / 'assets' / 'british-bulldog' / '2011' / '3-4'
PHOTOS = ROOT / 'sources' / 'british-bulldog' / '2011' / '3-4'
CLASSROOM_DIGEST = '3d15bcc5afdb184768221d6edf583d32'
BOOKLET_PAGE = 1
LICENSE = 'https://creativecommons.org/licenses/by-sa/3.0/'
INK = (0.12, 0.18, 0.23)
BLUE = (0.04, 0.31, 0.56)
MUTED = (0.29, 0.35, 0.40)
REGULAR = fitz.Font('helv')
BOLD = fitz.Font('hebo')


def link_text(page, x, y, label, size, target, color=BLUE):
    page.insert_text((x, y), label, fontname='ReaderRegular', fontsize=size, color=color)
    right = x + REGULAR.text_length(label, fontsize=size)
    page.draw_line((x, y + 2), (right, y + 2), color=color, width=0.65)
    page.insert_link({'from': fitz.Rect(x - 2, y - size, right + 2, y + 4), **target})


def add_board_pictures(reader, classroom_xref):
    page = reader.new_page(width=520, height=708)
    page.insert_font(fontname='ReaderRegular', fontbuffer=REGULAR.buffer)
    page.insert_font(fontname='ReaderBold', fontbuffer=BOLD.buffer)
    page.insert_text((36, 38), 'British Bulldog 2011   /   Grades 3–4',
                     fontname='ReaderRegular', fontsize=12, color=MUTED)
    page.insert_text((36, 70), 'Board pictures', fontname='ReaderBold', fontsize=28, color=INK)
    page.insert_text((36, 92), 'Use this page with questions 48 and 50 on page 2.',
                     fontname='ReaderRegular', fontsize=13, color=INK)

    scene = fitz.Rect(130, 127, 390, 127 + 260 * 132 / 205)
    page.insert_image(scene, xref=classroom_xref)
    scale = scene.width / 205
    # These rectangles surround the left and right prints in the 205 × 132 original.
    for label, bounds in [('Left', (63, 10, 81, 33)), ('Right', (120, 10, 138, 33))]:
        x0, y0, x1, y1 = bounds
        rect = fitz.Rect(scene.x0 + x0 * scale, scene.y0 + y0 * scale,
                         scene.x0 + x1 * scale, scene.y0 + y1 * scale)
        center = (rect.x0 + rect.x1) / 2
        label_width = BOLD.text_length(label, fontsize=11)
        page.insert_text((center - label_width / 2, 119), label,
                         fontname='ReaderBold', fontsize=11, color=BLUE)
        page.draw_line((center, 123), (center, rect.y0), color=BLUE, width=1)
        page.draw_rect(rect, color=(1, 1, 1), width=3)
        page.draw_rect(rect, color=BLUE, width=1)

    page.insert_text((130, 314), 'Classroom illustration from the original booklet',
                     fontname='ReaderRegular', fontsize=10, color=MUTED)
    page.draw_line((36, 333), (484, 333), color=(0.79, 0.83, 0.87), width=0.7)
    page.insert_text((36, 358), 'Editorial reference photos', fontname='ReaderBold', fontsize=15, color=INK)

    for side, x in [('left', 58), ('right', 282)]:
        page.insert_text((x, 384), f'{side.capitalize()} picture on the board',
                         fontname='ReaderBold', fontsize=12, color=INK)
        page.insert_image(fitz.Rect(x, 393, x + 180, 641),
                          filename=str(PHOTOS / f'board-{side}.jpg'))

    link_text(page, 58, 657, 'David Iliff / Wikimedia Commons (cropped)', 9,
              {'kind': fitz.LINK_URI, 'uri': 'https://commons.wikimedia.org/wiki/Special:PermanentLink/1224806790'})
    link_text(page, 58, 671, LICENSE, 9, {'kind': fitz.LINK_URI, 'uri': LICENSE})
    link_text(page, 282, 657, 'NASA / Bill Ingalls (cropped, mirrored)', 9,
              {'kind': fitz.LINK_URI, 'uri': 'https://commons.wikimedia.org/wiki/Special:PermanentLink/1232690719'})
    page.insert_text((282, 671), 'Public domain in the United States',
                     fontname='ReaderRegular', fontsize=9, color=MUTED)
    link_text(page, 36, 693, 'Back to questions on page 2', 11,
              {'kind': fitz.LINK_GOTO, 'page': BOOKLET_PAGE, 'to': fitz.Point(0, 0)})


def build_reading_copy():
    with fitz.open(ASSETS / 'tasks.pdf') as reader:
        if len(reader) != 2:
            raise ValueError('Expected the two-page 2011 booklet')
        booklet = reader[BOOKLET_PAGE]
        images = [info for info in booklet.get_image_info(xrefs=True)
                  if info['digest'].hex() == CLASSROOM_DIGEST]
        if len(images) != 1 or not images[0]['xref']:
            raise ValueError('Expected the original classroom image on page 2')
        prompts = []
        for text in ('48. In the left picture on the board I see',
                     '50. In the right picture on the board I see'):
            matches = booklet.search_for(text)
            if len(matches) != 1:
                raise ValueError(f'Expected one question matching {text!r}')
            prompts.append(matches[0])

        add_board_pictures(reader, images[0]['xref'])
        booklet = reader[BOOKLET_PAGE]
        booklet.insert_font(fontname='ReaderRegular', fontbuffer=REGULAR.buffer)
        target = {'kind': fitz.LINK_GOTO, 'page': 2, 'to': fitz.Point(0, 0)}
        for prompt in prompts:
            booklet.insert_link({'from': prompt, **target})
        link_text(booklet, 445, 584.5, 'Board pictures on p. 3', 9, target, color=(1, 1, 1))
        reader.set_toc([[1, 'Original booklet', 1], [1, 'Board pictures for 48 and 50', 3]])
        reader.del_xml_metadata()
        reader.set_metadata({'title': 'British Bulldog 2011 – Grades 3–4 – Reading copy',
                             'subject': 'Original booklet with an editorial supplement for questions 48 and 50',
                             'creator': 'Olympiads.pro', 'producer': 'PyMuPDF'})
        output = ASSETS / 'tasks-reading.pdf'
        output.write_bytes(reader.tobytes(garbage=4, deflate=True, no_new_id=True))


if __name__ == '__main__':
    build_reading_copy()
