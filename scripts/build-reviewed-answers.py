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
from typing import NamedTuple

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
CARD_PADDING = 8
CARD_GAP = 10
CARD_IMAGE_HEIGHT = 160
PRINT_IMAGE_MAX_SIDE = 740

PICTURE_LABEL = re.compile(
    r'(?:рисунок|картинка|изображение|схема|вариант|picture|figure|diagram|option)'
    r'\s+(?:№\s*)?(?:[а-яёa-z]|[0-9]+)[.]?',
    re.IGNORECASE,
)
REPEATED_PICTURE_LABEL = re.compile(r'(?:фото(?:графия)?|инструмент|часы|photo(?:graph)?)\s+([а-яёa-z])[.]?', re.I)


class ComparisonEntry(NamedTuple):
    label: str
    caption: str
    picture: tuple | None


class ComparisonCell(NamedTuple):
    label: list[str]
    caption: list[str]
    picture: tuple | None
    width: float
    height: float


class ComparisonRow(NamedTuple):
    cells: list[ComparisonCell]
    label_height: float
    image_height: float
    height: float


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

    accepted = row.get('acceptedAnswers')
    if accepted:
        if answer not in accepted or any(type(i) is not int or not 0 <= i < len(choices) for i in accepted):
            raise ValueError(f'Question {number}: invalid alternative answers')
        return ', '.join(letters[i] for i in accepted), ' или '.join(normalize(choices[i]) for i in accepted)

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


def prepare_figure(figure, use_detail=False):
    path = figure_path(figure['src'])
    if use_detail and figure.get('detailSrc'):
        path = figure_path(figure['detailSrc'])
    if path.suffix.lower() == '.svg':
        with fitz.open(stream=path.read_bytes(), filetype='svg') as svg:
            return svg[0].rect.width, svg[0].rect.height, svg.convert_to_pdf(), True

    with Image.open(path) as image:
        if use_detail and image.format == 'JPEG':
            return image.width, image.height, path.read_bytes(), False
        buffer = BytesIO()
        if use_detail:
            image.thumbnail((PRINT_IMAGE_MAX_SIDE, PRINT_IMAGE_MAX_SIDE), Image.Resampling.LANCZOS)
        # PDF can embed JPEG directly. Preserve lossless line art and transparency as PNG.
        lossy_chip_photo = False
        if image.format == 'WEBP' and path.is_relative_to(ASSETS / 'chip') and not image.has_transparency_data:
            with path.open('rb') as original:
                lossy_chip_photo = original.read(16)[12:16] == b'VP8 '
        if lossy_chip_photo:
            image.convert('RGB').save(buffer, format='JPEG', quality=94, subsampling=0)
        else:
            image.convert('RGBA' if image.has_transparency_data else 'RGB').save(buffer, format='PNG')
        return image.width, image.height, buffer.getvalue(), False


def place_figure(page, rect, art):
    _, _, image, vector = art
    if vector:
        with fitz.open(stream=image, filetype='pdf') as document:
            page.show_pdf_page(rect, document, 0)
    else:
        page.insert_image(rect, stream=image)


def choice_caption(choice, letter, illustrated):
    text = re.sub(rf'^{re.escape(letter)}[.)]\s*', '', normalize(choice), flags=re.I)
    repeated = REPEATED_PICTURE_LABEL.fullmatch(text)
    if illustrated and (text.casefold() == letter.casefold() or PICTURE_LABEL.fullmatch(text) or (
        repeated and repeated[1].casefold() == letter.casefold()
    )):
        return ''
    return text


def comparison_rows(entries, width, regular, bold):
    columns = min(len(entries), 2) if len(entries) < 5 else 3
    cell_width = (width - (columns - 1) * CARD_GAP) / columns
    inner_width = cell_width - 2 * CARD_PADDING
    cells = []
    for label, caption, picture in entries:
        label_lines = wrap(label, bold, BODY_SIZE, inner_width)
        caption_lines = wrap(caption, regular, BODY_SIZE, inner_width) if caption else []
        actual_width = actual_height = 0
        if picture:
            w, h = picture[:2]
            scale = min(1, inner_width / w, CARD_IMAGE_HEIGHT / h)
            actual_width, actual_height = w * scale, h * scale
        cells.append(ComparisonCell(label_lines, caption_lines, picture, actual_width, actual_height))
    rows = []
    for index in range(0, len(cells), columns):
        row = cells[index:index + columns]
        label_height = max(len(cell.label) for cell in row) * LINE_HEIGHT
        image_height = max(cell.height for cell in row)
        caption_height = max(len(cell.caption) for cell in row) * LINE_HEIGHT
        height = 2 * CARD_PADDING + label_height + image_height + caption_height
        rows.append(ComparisonRow(row, label_height, image_height, height + (5 if image_height else 0)))
    return cell_width, rows


def comparison_height(rows):
    return sum(row.height + CARD_GAP for row in rows)


def draw_comparison_row(page, y, width, row, regular, bold):
    for column, cell in enumerate(row.cells):
        x = MARGIN + column * (width + CARD_GAP)
        page.draw_rect(fitz.Rect(x, y, x + width, y + row.height), color=RULE, width=0.5)
        text_x = x + CARD_PADDING
        label_top = y + CARD_PADDING
        for line_number, line in enumerate(cell.label):
            draw_text(page, bold, text_x, label_top + BODY_SIZE + LINE_HEIGHT * line_number, line)
        caption_top = label_top + row.label_height
        if cell.picture:
            image_x = x + (width - cell.width) / 2
            image_y = caption_top + (row.image_height - cell.height) / 2
            place_figure(page, fitz.Rect(image_x, image_y, image_x + cell.width, image_y + cell.height), cell.picture)
            caption_top += row.image_height + 5
        for line_number, line in enumerate(cell.caption):
            draw_text(page, regular, text_x, caption_top + BODY_SIZE + LINE_HEIGHT * line_number, line)


def draw_appendix(pdf, title, revisions, letters, regular, bold):
    def start_page():
        return document_header(pdf, 'Приложение. Уточнённые задания', title,
                               'Условия и варианты ответов в редакции Olympiads.pro.', regular, bold)

    page, y = start_page()
    top = y
    right = page.rect.width - MARGIN
    bottom = page.rect.height - 55
    width = right - MARGIN
    gallery_locations = {}

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
        pictures = row.get('optionFigures') or []
        if any(pictures[len(choices):]):
            raise ValueError(f'Question {number}: illustration has no corresponding answer option')
        graphical_options = []
        if any(pictures):
            for index, (letter, choice) in enumerate(zip(letters, choices)):
                picture = pictures[index] if index < len(pictures) else None
                caption = choice_caption(choice, letter, picture)
                if picture and picture.get('caption'):
                    figure_caption = choice_caption(picture['caption'], letter, True)
                    if figure_caption and figure_caption != caption:
                        caption = ' '.join(filter(None, (caption, figure_caption)))
                graphical_options.append(ComparisonEntry(f'{letter})', caption, prepare_figure(picture, True) if picture else None))
        figures = row.get('figures') or ([row['figure']] if row.get('figure') else [])
        gallery = []
        gallery_key = None
        gallery_location = None
        if len(figures) > 1:
            labels = [figure.get('caption') or f'Рисунок {index}' for index, figure in enumerate(figures, 1)]
            gallery_key = tuple((figure['src'], figure.get('detailSrc'), label) for figure, label in zip(figures, labels))
            gallery_location = gallery_locations.get(gallery_key)
            if gallery_location is None:
                gallery = [ComparisonEntry(label, '', prepare_figure(figure, True)) for label, figure in zip(labels, figures)]
        illustrations = []
        for figure in figures[:1] if len(figures) == 1 else []:
            art = prepare_figure(figure)
            original_width, original_height = art[:2]
            scale = min(1, width / original_width, 220 / original_height)
            label = '. '.join(str(figure[key]) for key in ('caption', 'alt') if figure.get(key))
            caption = wrap(label, regular, 9, width) if label else []
            illustrations.append((original_width * scale, original_height * scale, art, caption))

        # Grid rows are measured before deciding whether to start the entire question on a new page.
        gallery_layout = comparison_rows(gallery, width, regular, bold) if gallery else (0, [])
        choice_layout = comparison_rows(graphical_options, width, regular, bold) if graphical_options else (0, [])
        option_column_width = (width - CARD_GAP) / 2
        pair_options = bool(gallery_key and len(options) > 1 and all(
            len(lines) == 1 and regular.text_length(lines[0], fontsize=BODY_SIZE) <= option_column_width - 25
            for lines in options
        ))
        option_line_count = (len(options) + 1) // 2 if pair_options else sum(map(len, options))
        height = 42 + LINE_HEIGHT * len(question_lines)
        height += comparison_height(choice_layout[1]) if graphical_options else LINE_HEIGHT * option_line_count
        height += LINE_HEIGHT + 5 if gallery_location else comparison_height(gallery_layout[1])
        for _, image_height, _, caption in illustrations:
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

        def render_comparison(entries, layout):
            nonlocal y
            cell_width, grid = layout
            page_capacity = bottom - top - 21
            if comparison_height(grid) <= page_capacity:
                reserve(comparison_height(grid))
            location = None
            if any(line.height + CARD_GAP > page_capacity for line in grid):
                # An exceptionally long caption can span pages without reducing its font size.
                for label, caption, picture in entries:
                    reserve(2 * LINE_HEIGHT + (CARD_IMAGE_HEIGHT + 5 if picture else 0))
                    if location is None:
                        location = (page.number, y, number)
                    for line in wrap(label, bold, BODY_SIZE, width):
                        reserve(LINE_HEIGHT)
                        draw_text(page, bold, MARGIN, y + BODY_SIZE, line)
                        y += LINE_HEIGHT
                    if picture:
                        w, h = picture[:2]
                        scale = min(1, width / w, CARD_IMAGE_HEIGHT / h)
                        reserve(h * scale + 5)
                        place_figure(page, fitz.Rect(MARGIN, y, MARGIN + w * scale, y + h * scale), picture)
                        y += h * scale + 5
                    for line in wrap(caption, regular, BODY_SIZE, width) if caption else []:
                        reserve(LINE_HEIGHT)
                        draw_text(page, regular, MARGIN, y + BODY_SIZE, line)
                        y += LINE_HEIGHT
                    y += CARD_GAP
            else:
                for line in grid:
                    reserve(line.height + CARD_GAP)
                    if location is None:
                        location = (page.number, y, number)
                    draw_comparison_row(page, y, cell_width, line, regular, bold)
                    y += line.height + CARD_GAP
            return location

        for line in question_lines:
            reserve(14)
            draw_text(page, regular, MARGIN, y + BODY_SIZE, line)
            y += 14

        for image_width, image_height, art, caption in illustrations:
            reserve(image_height + 14 + 12 * len(caption))
            y += 7
            rect = fitz.Rect(MARGIN, y, MARGIN + image_width, y + image_height)
            place_figure(page, rect, art)
            y += image_height + 7
            for line in caption:
                draw_text(page, regular, MARGIN, y + 9, line, 9, MUTED)
                y += 12

        if gallery:
            gallery_locations[gallery_key] = render_comparison(gallery, gallery_layout)
        elif gallery_location:
            reserve(LINE_HEIGHT + 5)
            page_index, gallery_top, first_question = gallery_location
            reference = f'Иллюстрации — на стр. {page_index + 1} (задание № {first_question}).'
            draw_text(page, regular, MARGIN, y + BODY_SIZE, reference, color=MUTED)
            link_width = regular.text_length(reference, fontsize=BODY_SIZE)
            page.insert_link({'kind': fitz.LINK_GOTO, 'from': fitz.Rect(MARGIN, y, MARGIN + link_width, y + LINE_HEIGHT),
                              'page': page_index, 'to': fitz.Point(0, gallery_top)})
            y += LINE_HEIGHT + 5

        y += 5
        if graphical_options:
            render_comparison(graphical_options, choice_layout)
        elif pair_options:
            for index in range(0, len(options), 2):
                reserve(LINE_HEIGHT)
                for column, (line,) in enumerate(options[index:index + 2]):
                    x = MARGIN + column * (option_column_width + CARD_GAP)
                    draw_text(page, bold, x, y + BODY_SIZE, f'{letters[index + column]})')
                    draw_text(page, regular, x + 25, y + BODY_SIZE, line)
                y += LINE_HEIGHT
        else:
            for index, lines in enumerate(options):
                for line_index, line in enumerate(lines):
                    reserve(LINE_HEIGHT)
                    if line_index == 0:
                        draw_text(page, bold, MARGIN, y + BODY_SIZE, f'{letters[index]})')
                    draw_text(page, regular, MARGIN + 25, y + BODY_SIZE, line)
                    y += LINE_HEIGHT

        for paragraph in [*row.get('solution', []), row.get('keyNote')]:
            if paragraph:
                y += 5
                for line in wrap(normalize(paragraph), regular, BODY_SIZE, width):
                    reserve(LINE_HEIGHT)
                    draw_text(page, regular, MARGIN, y + BODY_SIZE, line)
                    y += LINE_HEIGHT
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
