"""Extract native grade 5–6 statements and crop their original illustrations.

Run with PyMuPDF, Pillow, NumPy and SciPy. For scans without a verified
transcript, Tesseract needs its Russian and English models. Pass --ocr-cache
to reuse page-level TSV files named YEAR-PAGE.tsv.
"""
import argparse
import csv
from collections import Counter, defaultdict
from contextlib import contextmanager
from dataclasses import dataclass, replace
import io
import json
import re
import runpy
import subprocess
from pathlib import Path

import fitz
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw

BASE = Path(__file__).resolve().parents[1]
CARDS = runpy.run_path(str(BASE / 'scripts' / 'build-grades-5-6.py'))
PUBLIC = BASE / 'dist'
SCALE = 3
OCR_YEARS = CARDS['SCANS'].keys()
DUPLICATED_GLYPHS = {2017, 2018, 2020}
LATIN_OPTIONS = ('АA', 'ВB', 'СC', 'D', 'ЕE')
RUSSIAN_OPTIONS = ('АA', 'БB6', 'ВB', 'ГF', 'ДDАA')
WORD = re.compile(r'[А-Яа-яЁё]{2,}')
FOOTER = re.compile(
    r'^(?:www\.|mathkang\.ru|ipokengu\.ru|ЗАДАЧИ[, ]|Время,? отведе|'
    r'На решение задач|Время решения задач|(?:По )?Правила?м? международной|\d.?\d?\s*[-–]\s*\d\s*КЛАСС)',
    re.IGNORECASE,
)


@dataclass
class Token:
    text: str
    rect: fitz.Rect
    baseline: float
    confidence: float = 100


def pdf_tokens(page, deduplicate=False):
    printed = defaultdict(list)
    flags = fitz.TEXTFLAGS_RAWDICT & ~fitz.TEXT_PRESERVE_IMAGES
    for block in page.get_text('rawdict', flags=flags)['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                chars = []
                for char in span['chars']:
                    if char['c'].isspace():
                        if chars:
                            yield pdf_token(chars, page)
                            chars = []
                    else:
                        if deduplicate:
                            x, y = fitz.Point(char['origin']) * page.rotation_matrix
                            positions = printed[(char['c'], round(y, 1))]
                            if any(abs(x - position) < 0.18 for position in positions):
                                continue
                            positions.append(x)
                        chars.append(char)
                if chars:
                    yield pdf_token(chars, page)


def pdf_token(chars, page):
    rect = fitz.Rect(chars[0]['bbox'])
    for char in chars[1:]:
        rect.include_rect(char['bbox'])
    rect *= page.rotation_matrix
    baseline = fitz.Point(chars[0]['origin']) * page.rotation_matrix
    return Token(''.join(char['c'] for char in chars), rect, baseline.y)


def ocr_tokens(page, year, page_index, cache):
    tsv = cache / f'{year}-{page_index}.tsv' if cache else None
    output = tsv.read_text() if tsv and tsv.exists() else ''
    if not output.startswith('level\tpage_num\t'):
        pix = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), alpha=False)
        output = subprocess.run(
            ['tesseract', 'stdin', 'stdout', '-l', 'rus+eng', '--psm', '11',
             '-c', 'tessedit_create_tsv=1'],
            input=pix.tobytes('png'), stdout=subprocess.PIPE, check=True,
        ).stdout.decode()
        if tsv:
            tsv.write_text(output)
    records = csv.DictReader(io.StringIO(output), delimiter='\t', quoting=csv.QUOTE_NONE)
    dimensions = next(records)
    scale_x = page.rect.width / int(dimensions['width'])
    scale_y = page.rect.height / int(dimensions['height'])
    for word in records:
        if word['level'] != '5' or not word.get('text', '').strip():
            continue
        left, top, width, height = (int(word[key]) for key in ('left', 'top', 'width', 'height'))
        rect = fitz.Rect(left * scale_x, top * scale_y, (left + width) * scale_x,
                         (top + height) * scale_y)
        yield Token(word['text'].strip(), rect, rect.y1, float(word['conf']))


def tokens_in_region(tokens, region):
    for token in tokens:
        center = (token.rect.tl + token.rect.br) * 0.5
        if region.contains(center) and token.rect.y0 >= region.y0 - 2:
            yield token


def token_rows(tokens, scan):
    rows = []
    for token in sorted(tokens, key=lambda token: token.baseline):
        if not rows or token.baseline - rows[-1][0].baseline > (4.2 if scan else 2.6):
            rows.append([])
        rows[-1].append(token)
    return [sorted(row, key=lambda token: token.rect.x0) for row in rows]


def token_string(tokens):
    text = ''
    previous = None
    for token in tokens:
        is_exponent = token.text[:1] in '⁰¹²³⁴⁵⁶⁷⁸⁹'
        if previous and not is_exponent and (token.confidence < 100 or token.rect.x0 - previous.rect.x1 > 0.7):
            text += ' '
        text += token.text
        previous = token
    # Different font runs may introduce spacing inside parentheses.
    text = re.sub(r'\(\((?=[АБВГД]\))', '(', text)
    text = re.sub(r'(?<=\d):\s+(?=\d{2}\b)', ':', text)
    return re.sub(r'\s+([.,?!;:»)])', r'\1', re.sub(r'([«(])\s+', r'\1', text)).strip()


def marker_expression(year):
    symbols = LATIN_OPTIONS if year <= 2007 else RUSSIAN_OPTIONS
    return re.compile(r'(?<![\w(])\(?([' + ''.join(symbols) + r'])\)\s*')


def join_lines(lines):
    text = '\n'.join(lines)
    text = re.sub(r'(?<=[А-Яа-яЁё])[-‐\xad]\n(?=[а-яё])', '', text).replace('\xad', '')
    return re.sub(r'\s+', ' ', text).strip()


def regions_for_choice_labels(rows, year):
    pattern = marker_expression(year)
    for index, row in enumerate(rows):
        if pattern.match(token_string(row)):
            return index
    return None


def statement_rows(rows, year, region, scan):
    selected = []
    if year >= 2022:
        left_limit = region.x0 + 21
        start_limit = region.x0 + (90 if year == 2024 else 39)
    else:
        left_limit = region.x0 - 3
        start_limit = region.x0 + 35
    for row in rows:
        row = [token for token in row if token.rect.x0 >= left_limit]
        if not row or row[0].rect.x0 > start_limit:
            continue
        first_run = [row[0]]
        for token in row[1:]:
            if token.rect.x0 - first_run[-1].rect.x1 > 24:
                break
            first_run.append(token)
        line = token_string(first_run)
        if FOOTER.match(line):
            continue
        selected.append((line, first_run))
    return selected


def parse_choices(rows, year, scan):
    if not rows:
        return None, []
    relevant_rows = []
    for row in rows:
        line = token_string(row)
        if FOOTER.match(line):
            break
        if not marker_expression(year).search(line):
            if relevant_rows and len(WORD.findall(line)) >= 2 and row[0].rect.x0 < relevant_rows[0][0].rect.x0 + 70:
                relevant_rows.append(row)
            continue
        if re.search(r'\s[А-ЯA-Z]\s[А-ЯA-Z]$', line) and len(WORD.findall(line)) >= 2:
            return None, []
        relevant_rows.append(row)
    if not relevant_rows:
        return None, []
    pattern = marker_expression(year)
    text = join_lines([token_string(row) for row in relevant_rows])
    marks = list(pattern.finditer(text))
    symbols = LATIN_OPTIONS if year <= 2007 else RUSSIAN_OPTIONS
    if len(marks) != 5 or marks[0].start() != 0:
        return None, []
    if any(match[1] not in option for match, option in zip(marks, symbols)):
        return None, []
    choices = [text[mark.end():following.start()].strip() for mark, following in zip(marks, marks[1:])]
    choices.append(text[marks[-1].end():].strip())
    tokens = [token for row in relevant_rows for token in row]
    if len(set(choices)) != 5 or any(not choice or len(choice) > 240 or '�' in choice for choice in choices):
        return None, []
    if scan and not confident(tokens):
        return None, []
    return choices, tokens


def confident(tokens):
    words = [token for token in tokens if re.search(r'[\w]', token.text)]
    if not words:
        return False
    return min(token.confidence for token in words) >= 55 and (
        sum(token.confidence for token in words) / len(words) >= 88
    )


def render_card(page, region):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=region, alpha=False)
    return Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples), (pixmap.x, pixmap.y)


def remove_tokens(image, offset, tokens):
    draw = ImageDraw.Draw(image)
    for token in tokens:
        x0, y0, x1, y1 = token.rect
        left, top = round(x0 * SCALE) - offset[0] - 1, round(y0 * SCALE) - offset[1] - 1
        right, bottom = round(x1 * SCALE) - offset[0] + 1, round(y1 * SCALE) - offset[1] + 1
        draw.rectangle((left, top, right, bottom), fill='white')


def content_mask(image, year):
    colors = np.asarray(image)
    # The archive watermark in early PDFs is light orange.
    darkness = colors[:, :, 0] if year <= 2000 else colors.min(axis=2)
    return darkness < 184


def clean_visual(image, year):
    mask = content_mask(image, year)
    labels, _ = ndimage.label(mask, structure=np.ones((3, 3), dtype=bool))
    counts = np.bincount(labels.ravel())
    draw = ImageDraw.Draw(image)
    clipped = False
    for index, bounds in enumerate(ndimage.find_objects(labels), start=1):
        rows, cols = bounds
        height, width = rows.stop - rows.start, cols.stop - cols.start
        if counts[index] < 8 or width < 2 or height < 2:
            continue
        if cols.start >= image.width - 12 or (
            rows.start >= image.height - 22 and rows.stop >= image.height - 2
        ):
            draw.rectangle((cols.start, rows.start, cols.stop - 1, rows.stop - 1), fill='white')
        elif height > 8 and (rows.start < 2 or rows.stop >= image.height - 1):
            clipped = True
    return clipped


def crop_visual(image, year):
    mask = content_mask(image, year)
    if np.count_nonzero(mask) < 85:
        return None
    labels, _ = ndimage.label(mask, structure=np.ones((3, 3), dtype=bool))
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    mask &= counts[labels] >= 8
    rows, cols = np.where(mask)
    if not len(rows):
        return None
    height, width = max(rows) - min(rows), max(cols) - min(cols)
    if height < 12 or width < 12:
        return None
    return image.crop((max(0, min(cols) - 7), max(0, min(rows) - 7),
                       min(image.width, max(cols) + 8), min(image.height, max(rows) + 8)))


def has_inline_ink(image, offset, question_rows, year):
    mask = content_mask(image, year)
    for _, tokens in question_rows:
        x0 = max(0, round(tokens[0].rect.x0 * SCALE) - offset[0])
        x1 = min(image.width, round(tokens[-1].rect.x1 * SCALE) - offset[0])
        y0 = max(0, round(min(token.rect.y0 for token in tokens) * SCALE) - offset[1] - 4)
        y1 = min(image.height, round(max(token.rect.y1 for token in tokens) * SCALE) - offset[1])
        if np.count_nonzero(mask[y0:y1, x0:x1]) > 32:
            return True
    return False


SUPERSCRIPTS = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')


def join_superscripts(tokens):
    for token in tokens:
        if token.text.isascii() and token.text.isdigit() and len(token.text) <= 3:
            candidates = [
                base for base in tokens
                if (
                    base.text[-1:].isalnum()
                    and -0.3 <= token.rect.x0 - base.rect.x1 <= 1.25
                    and 2 <= base.baseline - token.baseline <= 7
                    and token.rect.height <= base.rect.height * 0.84
                )
            ]
            if candidates:
                base = max(candidates, key=lambda candidate: candidate.rect.x1)
                token = replace(token, text=token.text.translate(SUPERSCRIPTS), baseline=base.baseline)
        yield token

def native_condition(page, year, number, region, tokens):
    scan = year in OCR_YEARS
    tokens = list(tokens_in_region(tokens, region))
    rows = token_rows(tokens if scan else join_superscripts(tokens), scan)
    choice_start = regions_for_choice_labels(rows, year)
    question_rows = rows if choice_start is None else rows[:choice_start]
    if choice_start is None and scan:
        # Picture alternatives do not always have OCR-readable labels. Find the end
        # of the question by its punctuation, and preserve everything below it.
        for index, row in enumerate(question_rows):
            if '?' in token_string(row) and row[0].rect.x0 < region.x0 + 40:
                question_rows = question_rows[:index + 1]
                break
        else:
            return None, None, 'unreadable alternatives'
    if choice_start is None and not scan:
        return None, None, 'unreadable alternatives'

    selected = statement_rows(question_rows, year, region, scan)
    if not selected:
        return None, None, 'empty statement'
    text = join_lines([line for line, _ in selected])
    if year >= 2022:
        question = text
    else:
        numbered = re.match(rf'^{number}(?:[.:]\s*|\s+)(.*)', text)
        if not numbered and not scan:
            return None, None, 'missing number'
        question = numbered[1] if numbered else text
    if re.search(r'\bвместо\s+подстав', question):
        return None, None, 'inline formula or illustration'
    if len(WORD.findall(question)) < 3 or re.search(r'[�\u0000-\u001f\ue000-\uf8ff]', question):
        return None, None, 'unreadable text'
    question_tokens = [token for _, tokens_in_line in selected for token in tokens_in_line]
    used_tokens = {id(token) for token in question_tokens}
    for row in question_rows:
        unused_text = token_string([token for token in row if id(token) not in used_tokens])
        if len(WORD.findall(unused_text)) >= 3 and not FOOTER.match(unused_text):
            return None, None, 'unassigned statement text'
    if '?' not in question and re.search(r'[,—–]$', question):
        return None, None, 'incomplete statement'
    if scan and not confident(question_tokens):
        return None, None, 'low confidence'
    if scan and re.search(r'\b[A-Za-z]{2,}\b|\w[а-яё][0-9]\b|[а-яё][А-ЯЁ]', question):
        return None, None, 'ambiguous OCR'
    if not re.match(r'[«(]?[А-ЯЁA-Z0-9]', question):
        return None, None, 'unreadable beginning'

    choices, choice_tokens = parse_choices(rows[choice_start:], year, scan) if choice_start is not None else (None, [])
    image, offset = render_card(page, region)
    non_content = [
        token for row in rows if FOOTER.match(token_string(row)) for token in row
    ]
    if year >= 2022:
        width = 22 if year == 2024 else 19
        ImageDraw.Draw(image).rectangle((0, 0, round(width * SCALE), round(17 * SCALE)), fill='white')
    elif scan and not re.match(rf'^{number}(?:[.:]\s*|\s+)', text):
        ImageDraw.Draw(image).rectangle((0, 0, round(16 * SCALE), round(15 * SCALE)), fill='white')

    remove_tokens(image, offset, question_tokens + non_content)
    clipped = clean_visual(image, year)
    if has_inline_ink(image, offset, selected, year):
        return None, None, 'inline formula or illustration'
    if choices:
        native_choices_image = image.copy()
        remove_tokens(native_choices_image, offset, choice_tokens)
        visual = crop_visual(native_choices_image, year)
        if visual:
            # Keep original alternatives together when a label shares a row
            # with a picture or a mathematical expression.
            if has_inline_ink(native_choices_image, offset, [(token_string(row), row) for row in rows[choice_start:]
                                                           if any(token in choice_tokens for token in row)], year):
                choices = None
                visual = crop_visual(image, year)
    else:
        visual = crop_visual(image, year)

    if visual and clipped:
        return None, None, 'illustration intersects task boundary'
    if scan and (not choices or visual):
        return None, None, 'scan needs visual review'
    if not choices and visual is None:
        return None, None, 'missing alternatives'
    result = {'question': question}
    if choices:
        result['choices'] = choices
    return result, visual, None


def verified_condition(page, entry):
    entry = entry.copy()
    # Source rectangles use the page's unmodified three-times raster coordinates.
    rows = entry.pop('illustrationRows', [])
    if not rows:
        return entry, None
    pixmap = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), alpha=False)
    source = Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)
    strips = []
    for rectangles in rows:
        left = min(rect[0] for rect in rectangles)
        top = min(rect[1] for rect in rectangles)
        right = max(rect[2] for rect in rectangles)
        bottom = max(rect[3] for rect in rectangles)
        # Widely separated pieces of one figure can share a compact row.
        if len(rectangles) == 2 and rectangles[1][0] - rectangles[0][2] > 200:
            first, second = (source.crop(rect) for rect in rectangles)
            strip = Image.new('RGB', (first.width + second.width + 28, max(first.height, second.height)), 'white')
            strip.paste(first, (0, 0))
            strip.paste(second, (first.width + 28, 0))
        else:
            strip = Image.new('RGB', (right - left, bottom - top), 'white')
            for rect in rectangles:
                strip.paste(source.crop(rect), (rect[0] - left, rect[1] - top))
        strips.append(strip)
    visual = Image.new('RGB', (max(strip.width for strip in strips),
                               sum(strip.height for strip in strips) + 14 * (len(strips) - 1)), 'white')
    y = 0
    for strip in strips:
        visual.paste(strip, (0, y))
        y += strip.height + 14
    return entry, visual


def cyrillic_mapping(pdf, font_xref):
    encoding = pdf.xref_get_key(font_xref, 'Encoding')
    if encoding[0] != 'xref':
        return {}
    dictionary = pdf.xref_object(int(encoding[1].split()[0]))
    differences = re.search(r'/Differences\s*\[(.*?)\]', dictionary, re.S)
    if not differences:
        return {}
    mapping = {}
    source = 0
    for item in re.findall(r'/[\w.]+|\d+', differences[1]):
        if item.isdigit():
            source = int(item)
            continue
        glyph = re.fullmatch(r'/g(\d+)', item)
        if glyph:
            index = int(glyph[1])
            if 570 <= index <= 633:
                mapping[source] = ord('А') + index - 570
            elif index in {569, 634}:
                mapping[source] = ord('Ё' if index == 569 else 'ё')
            elif index == 152:
                mapping[source] = ord('·')
        source += 1
    return mapping


def recover_font_encoding(pdf):
    seen = set()
    for page in pdf:
        for font_xref, _, _, name, *_ in page.get_fonts(full=True):
            if font_xref in seen or not re.search(r'Arial|Symbol', name):
                continue
            seen.add(font_xref)
            mapping = cyrillic_mapping(pdf, font_xref)
            if not mapping:
                continue
            key = pdf.xref_get_key(font_xref, 'ToUnicode')
            if key[0] == 'xref':
                cmap = int(key[1].split()[0])
                original = pdf.xref_stream(cmap).decode('ascii')
            else:
                cmap = pdf.get_new_xref()
                pdf.update_object(cmap, '<<>>')
                pdf.xref_set_key(font_xref, 'ToUnicode', f'{cmap} 0 R')
                original = (
                    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap '
                    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def '
                    '/CMapName /Decoded def /CMapType 2 def '
                    '1 begincodespacerange <00> <ff> endcodespacerange '
                    'endcmap CMapName currentdict /CMap defineresource pop end end'
                )
            original = re.sub(r'begincodespacerange\s*<\w+>\s*<\w+>', 'begincodespacerange <00> <ff>', original)
            added = '\n'.join(f'<{code:02x}> <{char:04x}>' for code, char in mapping.items())
            augmented = original.replace('endcmap', f'{len(mapping)} beginbfchar\n{added}\nendbfchar\nendcmap')
            pdf.update_stream(cmap, augmented.encode('ascii'))


@contextmanager
def source_pdf(path, year):
    with fitz.open(path) as pdf:
        if year != 2019:
            yield pdf
        else:
            # The 2019 Type 1 fonts name their Russian glyphs but omit them
            # from ToUnicode. Fix the in-memory text layer, never the source.
            recover_font_encoding(pdf)
            with fitz.open('pdf', pdf.tobytes()) as repaired:
                yield repaired


def cached_regions(pdf, year, size):
    # The task crop builder reads the same PDF text once per task. Cache each
    # page's text for this document while retaining the source region rules.
    reader = CARDS['task_regions'].__globals__
    page_lines = reader['page_lines']
    pages = {}

    def cached_page_lines(page):
        if page.number not in pages:
            pages[page.number] = list(page_lines(page))
        return iter(pages[page.number])

    reader['page_lines'] = cached_page_lines
    try:
        return CARDS['task_regions'](pdf, year, size)
    finally:
        reader['page_lines'] = page_lines


def build(years, cache, preview):
    target = PUBLIC / 'years' / 'grade-conditions.js'
    years = list(years)
    conditions = {}
    if not preview and target.exists() and years != list(range(1997, 2027)):
        contents = target.read_text().strip()
        marker = 'globalThis.KENGURU_GRADE_CONDITIONS = '
        conditions.update(json.loads(contents.split(marker, 1)[1].removesuffix(';')))
    for year in years:
        entries = {}
        failures = Counter()
        scans = year in OCR_YEARS
        verified_path = CARDS['TASKS'] / str(year) / 'native-conditions.json'
        verified = json.loads(verified_path.read_text()) if verified_path.exists() else {}
        size = 24 if year == 2021 else 30
        assets = PUBLIC / 'assets' / 'grade-conditions' / str(year)
        with source_pdf(CARDS['TASKS'] / str(year) / 'tasks.pdf', year) as pdf:
            regions = cached_regions(pdf, year, size)
            tokens = {
                index: list(ocr_tokens(page, year, index, cache) if scans else pdf_tokens(page, year in DUPLICATED_GLYPHS))
                for index, page in enumerate(pdf)
                if any(index == page_index and str(number) not in verified
                       for number, (page_index, _) in regions.items())
            }
            for number, (page_index, rect) in sorted(regions.items()):
                if str(number) in verified:
                    entry, visual = verified_condition(pdf[page_index], verified[str(number)])
                    failure = None
                else:
                    entry, visual, failure = native_condition(pdf[page_index], year, number, rect, tokens[page_index])
                if failure:
                    failures[failure] += 1
                    if preview:
                        print(f'{year}/{number} SKIPPED {failure}')
                    continue
                if visual:
                    name = f'task-{number:02d}.webp'
                    if not preview:
                        assets.mkdir(parents=True, exist_ok=True)
                        visual.save(assets / name, 'WEBP', quality=92, method=4)
                    entry.update(image=f'assets/grade-conditions/{year}/{name}',
                                 imageWidth=visual.width, imageHeight=visual.height)
                if preview:
                    print(f'{year}/{number}', entry)
                entries[number] = entry
        conditions[str(year)] = entries
        images = sum('image' in condition for condition in entries.values())
        choices = sum('choices' in condition for condition in entries.values())
        print(f'{year}: {len(entries)}/{size} statements, {choices} text choices, {images} illustrations', failures,
              flush=True)
    if not preview:
        encoded = json.dumps(conditions, ensure_ascii=False, separators=(',', ':'))
        target.write_text("'use strict';\n// Generated by scripts/build-grade-conditions.py.\n"
                          "globalThis.KENGURU_GRADE_CONDITIONS = " + encoded + ";\n")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ocr-cache', type=Path)
    parser.add_argument('--preview', action='store_true')
    parser.add_argument('years', type=int, nargs='*')
    options = parser.parse_args()
    if options.ocr_cache:
        options.ocr_cache.mkdir(parents=True, exist_ok=True)
    build(options.years or range(1997, 2027), options.ocr_cache, options.preview)
