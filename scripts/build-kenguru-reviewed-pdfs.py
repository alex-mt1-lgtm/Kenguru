"""Rebuild editorial Kenguru PDFs from the original archive files."""

from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'dist' / 'assets' / 'kenguru'
FONT_DIRECTORY = Path('/usr/share/fonts/truetype/liberation')
FONTS = {
    'ReviewRegular': FONT_DIRECTORY / 'LiberationSans-Regular.ttf',
    'ReviewBold': FONT_DIRECTORY / 'LiberationSans-Bold.ttf',
}
EDITOR_NOTE = 'Исправлено редакцией'
NOTE_COLOR = (0.18, 0.28, 0.41)


def erase(page, *boxes):
    for box in boxes:
        rect = fitz.Rect(box) * page.derotation_matrix
        page.add_redact_annot(rect, fill=(1, 1, 1), cross_out=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_NONE,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )


def write_line(page, x, y, text, size, *, bold=False, color=(0, 0, 0)):
    font_name = 'ReviewBold' if bold else 'ReviewRegular'
    page.insert_text(
        fitz.Point(x, y) * page.derotation_matrix,
        text,
        fontname=font_name,
        fontfile=str(FONTS[font_name]),
        fontsize=size,
        rotate=page.rotation,
        color=color,
    )


def reviewed_2017_answers(page):
    matches = page.search_for('или 4')
    if len(matches) != 1 or not fitz.Rect(95, 190, 145, 210).contains(matches[0]):
        raise ValueError('The 2017 answer to task 6 is outside its expected cell')
    old_answer = matches[0]
    erase(page, (old_answer.x0 - 0.15, old_answer.y0 - 0.15,
                 old_answer.x1 + 0.2, old_answer.y1 + 0.15))
    write_line(page, 115, 205.4, EDITOR_NOTE, 8.4, color=NOTE_COLOR)


def reviewed_2018_answers(page):
    matches = page.search_for('x3', clip=fitz.Rect(338, 280, 362, 305))
    if len(matches) != 2:
        raise ValueError('The 2018 answer to task 11 is outside its expected cell')
    old_answer = matches[0] | matches[1]
    erase(page, (old_answer.x0 - 0.2, old_answer.y0 - 0.2,
                 old_answer.x1 + 0.2, old_answer.y1 + 0.2))
    write_line(page, 335.2, 300.42, '√(x³)', 12)
    write_line(page, 387, 300.42, EDITOR_NOTE, 8.4, color=NOTE_COLOR)


def reviewed_2021_tasks(page):
    # The original booklet uses outlined text and has a rotated spread.
    erase(page, (458.8, 456, 677, 509.3), (458.8, 510, 789, 531))
    lines = (
        'Велосипедный замок состоит из четырёх',
        'колёсиков. На каждом колёсике цифры от 0 до 9',
        'расположены по порядку по кругу. После',
        'установки кода велосипедист повернул каждое',
        'колёсико на 180°. Теперь на замке виден код 6348.',
        'Какой код был установлен сначала?',
    )
    for index, line in enumerate(lines):
        write_line(page, 459.6, 463.4 + index * 10.75, line, 8.8)
    write_line(page, 459.6, 528.4, EDITOR_NOTE, 7.6, color=NOTE_COLOR)


def reviewed_2022_tasks(page):
    # Mask only the outlined digits in option В and keep the adjacent label.
    erase(page, (150.3, 563.3, 174, 571))
    write_line(page, 150.45, 570.2, '15:20', 9.5, bold=True)
    write_line(page, 282, 570.2, EDITOR_NOTE, 7.6, color=NOTE_COLOR)


def reviewed_2022_solutions(page):
    matches = page.search_for('15 : 40')
    if len(matches) != 1 or not fitz.Rect(19, 37, 398, 86).contains(matches[0]):
        raise ValueError('The 2022 solution to task 15 is outside its expected block')
    erase(page, (19.2, 37.5, 397, 85.7))
    write_line(page, 173, 33.16, EDITOR_NOTE, 8.1, color=NOTE_COLOR)
    lines = (
        'Наручные часы отстают на 1 минуту в час, а телефон спешит на 2 минуты.',
        'Разница растёт на 3 минуты в час. Показания 11:00 и 12:00 разошлись',
        'на 60 минут за 20 часов. Телефон показывает 12:00 и спешит на 40 минут.',
        'Сейчас 11:20. Отсчитаем 20 часов назад и получим 15:20 предыдущего дня.',
    )
    for index, line in enumerate(lines):
        write_line(page, 19.85, 46.58 + index * 12, line, 9.2)


def build(name, page_index, edit, *, original=None):
    original = original or ARCHIVE / f'{name}.pdf'
    reviewed = ARCHIVE / f'{name}-reviewed.pdf'
    with fitz.open(original) as document:
        edit(document[page_index])
        document.save(reviewed, garbage=3, deflate=True, no_new_id=True)


if __name__ == '__main__':
    build('kenguru_2017_answers', 0, reviewed_2017_answers)
    build('kenguru_2018_answers', 1, reviewed_2018_answers,
          original=ROOT / 'sources' / '2018' / 'answers.pdf')
    build('kenguru_2021_class_7-8', 0, reviewed_2021_tasks)
    build('kenguru_2022_class_7-8', 1, reviewed_2022_tasks)
    build('kenguru_2022_solution', 14, reviewed_2022_solutions)
