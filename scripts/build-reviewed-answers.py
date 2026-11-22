"""Build the checked answer keys for the interactive contest editions."""

import argparse
import json
import re
import subprocess
import tempfile
import unicodedata
from io import BytesIO
from itertools import groupby
from pathlib import Path, PurePosixPath

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'dist/assets'
INK = (0.09, 0.18, 0.20)
MUTED = (0.25, 0.35, 0.37)
RULE = (0.82, 0.86, 0.86)
TABLE_HEADER = (0.91, 0.95, 0.94)
MARGIN = 46
NUMBER_X = MARGIN + 10
LETTER_X = MARGIN + 62
ANSWER_X = MARGIN + 140
BODY_SIZE = 11
LINE_HEIGHT = 14
ROW_PADDING = 3
REVISION_NOTE = 'Редакция сайта, см. приложение'

PICTURE_LABEL = re.compile(
    r'(?:рисунок|картинка|изображение|схема|вариант|picture|figure|diagram|option)'
    r'\s+(?:№\s*)?(?:[а-яёa-z]|[0-9]+)[.]?',
    re.IGNORECASE,
)


def normalize(text):
    return ' '.join(unicodedata.normalize('NFC', re.sub(r'</?(?:em|strong|u)>', '', text, flags=re.I)).split())


def wrap(text, font, size, width):
    lines = []
    line = ''
    for word in normalize(text).split():
        joined = f'{line} {word}' if line else word
        if font.text_length(joined, fontsize=size) <= width:
            line = joined
            continue

        if line:
            lines.append(line)
        line = ''
        # A long unbroken string still has to fit inside the answer column.
        for character in word:
            if font.text_length(line + character, fontsize=size) > width:
                lines.append(line)
                line = ''
            line += character
    return [*lines, line]


def question_ranges(numbers):
    groups = groupby(enumerate(numbers), key=lambda position: position[1] - position[0])
    labels = []
    for _, group in groups:
        first, *rest = [number for _, number in group]
        labels.append(f'{first}–{rest[-1]}' if rest else str(first))
    return ', '.join(labels)


def answer_parts(row, letters):
    number = row['number']
    if type(number) is not int or number < 1:
        raise ValueError(f'Invalid question number {number!r}')

    if row.get('numericAnswer') is not None:
        if type(row['numericAnswer']) is not int:
            raise ValueError(f'Question {number}: numericAnswer must be an integer')
        return '—', str(row['numericAnswer'])

    answer = row['answer']
    choices = row.get('revisedChoices', row['choices'])
    if type(answer) is not int or not 0 <= answer < len(letters) or (choices and answer >= len(choices)):
        raise ValueError(f'Question {number}: missing or invalid answer')

    if 'answerText' in row:
        answer_text = normalize(row['answerText'])
    else:
        answer_text = normalize(choices[answer] or '') if choices else ''
        if PICTURE_LABEL.fullmatch(answer_text):
            answer_text = ''

    matching = row.get('matching')
    if matching:
        label = row.get('label')
        if not label:
            first = matching.get('start', 1) if isinstance(matching, dict) else 1
            label = f'Рисунок {number - first + 1}'
        answer_text = ' — '.join(part for part in (str(label), answer_text) if part)
    return letters[answer], answer_text


def draw_text(page, font, x, y, value, size=BODY_SIZE, color=INK):
    if value:
        writer = fitz.TextWriter(page.rect)
        writer.append((x, y), value, font=font, fontsize=size)
        writer.write_text(page, color=color)


def document_header(pdf, heading, title, description, regular, bold):
    page = pdf.new_page(width=595.28, height=841.89)
    right = page.rect.width - MARGIN
    width = right - MARGIN
    draw_text(page, bold, MARGIN, 47, 'OLYMPIADS.PRO', 9, MUTED)
    draw_text(page, bold, MARGIN, 81, heading, 23)
    y = 107
    for line in wrap(title, bold, 14, width):
        draw_text(page, bold, MARGIN, y, line, 14)
        y += 17
    for line in wrap(description, regular, 10, width):
        draw_text(page, regular, MARGIN, y, line, 10, MUTED)
        y += 13
    return page, y


def page_header(pdf, title, coverage, regular, bold):
    page, y = document_header(pdf, 'Проверенные ответы', title, coverage, regular, bold)
    table_top = y + 1
    right = page.rect.width - MARGIN
    page.draw_rect((MARGIN, table_top, right, table_top + 23), color=None, fill=TABLE_HEADER)
    draw_text(page, bold, NUMBER_X, table_top + 15, '№')
    draw_text(page, bold, LETTER_X, table_top + 15, 'Вариант')
    draw_text(page, bold, ANSWER_X, table_top + 15, 'Ответ')
    return page, table_top + 23


def page_footer(page, count, regular):
    y = page.rect.height - 42
    right = page.rect.width - MARGIN
    page.draw_line((MARGIN, y), (right, y), color=RULE, width=0.5)
    label = f'{page.number + 1} / {count}'
    label_width = regular.text_length(label, fontsize=9)
    draw_text(page, regular, right - label_width, y + 15, label, 9, MUTED)


def sorted_rows(edition):
    rows = sorted(edition['rows'], key=lambda row: row['number'])
    if not rows:
        raise ValueError('The reviewed key has no verified questions')
    if len({row['number'] for row in rows}) != len(rows):
        raise ValueError('Duplicate question numbers in the reviewed key')
    return rows


def question_rows(edition):
    return [(row['number'], *answer_parts(row, edition['letters'])) for row in sorted_rows(edition)]


def has_revision(row):
    return 'revisedQuestion' in row or 'revisedChoices' in row


def figure_path(src):
    location = PurePosixPath(src)
    if not location.parts or location.parts[0] != 'assets' or '..' in location.parts:
        raise ValueError(f'Illustration is outside dist/assets: {src!r}')
    path = ASSETS.joinpath(*location.parts[1:]).resolve()
    if not path.is_relative_to(ASSETS.resolve()) or not path.is_file():
        raise ValueError(f'Missing or invalid illustration under dist/assets: {src!r}')
    return path


def prepare_figure(figure):
    path = figure_path(figure['src'])
    if path.suffix.lower() == '.svg':
        with fitz.open(stream=path.read_bytes(), filetype='svg') as svg:
            return svg[0].rect.width, svg[0].rect.height, svg.convert_to_pdf(), True

    with Image.open(path) as image:
        # Keep the decoded pixels of formats such as WebP, which PDF cannot embed directly.
        buffer = BytesIO()
        image.convert('RGBA' if image.has_transparency_data else 'RGB').save(buffer, format='PNG')
        return image.width, image.height, buffer.getvalue(), False


def draw_appendix(pdf, title, revisions, letters, regular, bold):
    def start_page():
        return document_header(pdf, 'Приложение. Уточнённые задания', title,
                               'Условия и варианты ответов в редакции Olympiads.pro.', regular, bold)

    page, y = start_page()
    top = y
    right = page.rect.width - MARGIN
    bottom = page.rect.height - 55
    width = right - MARGIN

    for row in revisions:
        number = row['number']
        question = row.get('revisedQuestion', row.get('question'))
        choices = row.get('revisedChoices', row['choices'])
        if not isinstance(question, str) or not question.strip():
            raise ValueError(f'Question {number}: missing revised wording')
        if not isinstance(choices, list) or len(choices) > len(letters) or (not choices and row.get('numericAnswer') is None):
            raise ValueError(f'Question {number}: invalid revised choices')

        question_lines = [line for paragraph in question.splitlines() for line in wrap(paragraph, regular, BODY_SIZE, width)]
        options = [wrap(choice, regular, BODY_SIZE, width - 25) for choice in choices]
        figure = row.get('figure')
        caption = []
        image_height = 0
        if figure:
            original_width, original_height, image, vector = prepare_figure(figure)
            scale = min(1, width / original_width, 220 / original_height)
            image_width, image_height = original_width * scale, original_height * scale
            caption = wrap(figure['alt'], regular, 9, width) if figure.get('alt') else []

        height = 42 + 14 * (len(question_lines) + sum(map(len, options)))
        for item in row.get('optionFigures') or []:
            if item:
                item_width, item_height = item.get('width', 150), item.get('height', 105)
                height += item_height * min(1, 150 / item_width, 105 / item_height) + 8
        if figure:
            height += image_height + 14 + 12 * len(caption)
        if y > top and y + min(height, bottom - top) > bottom:
            page, y = start_page()

        draw_text(page, bold, MARGIN, y + 14, f'Задание № {number}', 13)
        y += 21

        def reserve(space):
            nonlocal page, y
            if y + space > bottom:
                page, y = start_page()
                draw_text(page, bold, MARGIN, y + 14, f'Задание № {number} (прод.)', 13)
                y += 21

        for line in question_lines:
            reserve(14)
            draw_text(page, regular, MARGIN, y + BODY_SIZE, line)
            y += 14

        if figure:
            reserve(image_height + 14 + 12 * len(caption))
            y += 7
            rect = fitz.Rect(MARGIN, y, MARGIN + image_width, y + image_height)
            if vector:
                with fitz.open(stream=image, filetype='pdf') as art:
                    page.show_pdf_page(rect, art, 0)
            else:
                page.insert_image(rect, stream=image)
            y += image_height + 7
            for line in caption:
                draw_text(page, regular, MARGIN, y + 9, line, 9, MUTED)
                y += 12

        y += 5
        for index, lines in enumerate(options):
            pictures = row.get('optionFigures') or []
            if index < len(pictures) and pictures[index]:
                w, h, pixels, is_vector = prepare_figure(pictures[index])
                scale = min(1, 150 / w, 105 / h)
                reserve(h * scale + 22)
                draw_text(page, bold, MARGIN, y + BODY_SIZE, f'{letters[index]})')
                frame = fitz.Rect(MARGIN + 25, y, MARGIN + 25 + w * scale, y + h * scale)
                if is_vector:
                    with fitz.open(stream=pixels, filetype='pdf') as art:
                        page.show_pdf_page(frame, art, 0)
                else:
                    page.insert_image(frame, stream=pixels)
                y += h * scale + 4
                if not row['revisedChoices'][index].strip() or PICTURE_LABEL.fullmatch(row['revisedChoices'][index]):
                    continue
            for line_index, line in enumerate(lines):
                reserve(14)
                if line_index == 0:
                    draw_text(page, bold, MARGIN, y + BODY_SIZE, f'{letters[index]})')
                draw_text(page, regular, MARGIN + 25, y + BODY_SIZE, line)
                y += 14

        if y + 4 <= bottom:
            page.draw_line((MARGIN, y + 4), (right, y + 4), color=RULE, width=0.5)
        y += 13


def render_key(edition, regular, bold):
    rows = question_rows(edition)
    revisions = [row for row in sorted_rows(edition) if has_revision(row)]
    revised_numbers = {row['number'] for row in revisions}
    title = normalize(edition['title'])
    coverage = 'Ответы ко всем заданиям выпуска.'
    if edition['partial']:
        ranges = question_ranges([number for number, _, _ in rows])
        coverage = f'Частичный ключ. Проверены задания № {ranges}.'

    with fitz.open() as pdf:
        page, y = page_header(pdf, title, coverage, regular, bold)
        page_top = y
        right = page.rect.width - MARGIN
        bottom = page.rect.height - 55
        for number, letter, text in rows:
            lines = [(line, BODY_SIZE, INK) for line in wrap(text, regular, BODY_SIZE, right - ANSWER_X - 10)]
            if number in revised_numbers:
                lines = [entry for entry in lines if entry[0]]
                lines.append((REVISION_NOTE, 9, MUTED))
            row_height = len(lines) * LINE_HEIGHT + 2 * ROW_PADDING
            if y > page_top and y + row_height > bottom:
                page, y = page_header(pdf, title, coverage, regular, bold)

            first_line = True
            while lines:
                capacity = int((bottom - y - 2 * ROW_PADDING) // LINE_HEIGHT)
                if capacity < 1:
                    raise ValueError('Edition title or coverage leaves no room for answers')
                block, lines = lines[:capacity], lines[capacity:]
                baseline = y + ROW_PADDING + BODY_SIZE
                if first_line:
                    draw_text(page, regular, NUMBER_X, baseline, str(number))
                    draw_text(page, bold, LETTER_X, baseline, letter)
                    first_line = False
                else:
                    draw_text(page, regular, NUMBER_X, baseline, f'{number} (прод.)', 9, MUTED)
                for index, (line, size, color) in enumerate(block):
                    draw_text(page, regular, ANSWER_X, baseline + index * LINE_HEIGHT, line, size, color)
                y += len(block) * LINE_HEIGHT + 2 * ROW_PADDING
                page.draw_line((MARGIN, y), (right, y), color=RULE, width=0.5)
                if lines:
                    page, y = page_header(pdf, title, coverage, regular, bold)

        if revisions:
            draw_appendix(pdf, title, revisions, edition['letters'], regular, bold)
        for page in pdf:
            page_footer(page, len(pdf), regular)
        pdf.set_metadata({'title': f'Проверенные ответы — {title}', 'author': 'Olympiads.pro'})
        pdf.subset_fonts()
        return pdf.tobytes(garbage=4, deflate=True, no_new_id=True)


def destination(edition, output):
    subject = edition['subject']
    year = str(edition['year'])
    filename = edition['filename']
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', subject) or not re.fullmatch(r'[0-9]{4}', year):
        raise ValueError(f'Invalid subject or year: {subject!r}, {year!r}')
    if not re.fullmatch(r'reviewed-[a-z0-9][a-z0-9_-]*\.pdf', filename):
        raise ValueError(f'Invalid reviewed key filename: {filename!r}')
    return output / subject / year / filename


def write_key(path, content):
    if path.is_file() and path.read_bytes() == content:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.reviewed-', delete=False) as pending:
        temporary = Path(pending.name)
        try:
            pending.write(content)
            pending.close()
            temporary.chmod(0o644)
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)


def load_font(pattern):
    filename = subprocess.check_output(['fc-match', '-f', '%{file}', pattern], text=True).strip()
    return fitz.Font(fontfile=filename)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--manifest', type=Path, help='Read answer data from a JSON file instead of the catalogue')
    cli.add_argument('--output-dir', type=Path, default=ROOT / 'dist/assets', help='Root of the generated asset tree')
    args = cli.parse_args()

    manifest = args.manifest.read_text(encoding='utf-8') if args.manifest else subprocess.check_output(
        ['node', 'scripts/reviewed-answer-data.cjs'], cwd=ROOT, text=True, encoding='utf-8',
    )
    editions = json.loads(manifest)
    try:
        paths = [destination(edition, args.output_dir) for edition in editions]
    except (KeyError, TypeError, ValueError) as error:
        cli.error(str(error))
    if len(set(paths)) != len(paths):
        cli.error('Multiple editions would write the same reviewed key')

    regular = load_font('DejaVu Sans:style=Book')
    bold = load_font('DejaVu Sans:style=Bold')
    for edition, path in zip(editions, paths):
        try:
            write_key(path, render_key(edition, regular, bold))
        except (KeyError, TypeError, ValueError) as error:
            cli.error(f'{path}: {error}')
    print(f'Built {len(paths)} reviewed answer PDFs')


if __name__ == '__main__':
    main()
