"""Copy coherent statements and complete rows of choices from the original PDF text layers.

Scanned pages and uncertain choice rows stay with the original artwork. Small explicit
transcriptions use sources/archive-text-reviewed.json to keep the source auditable.
"""
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
import json
import re
import runpy

import fitz

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources'
LEGACY = runpy.run_path(str(ROOT / 'scripts' / 'build-legacy-editions.py'))
PAPER = runpy.run_path(str(ROOT / 'scripts' / 'build-grades-5-6.py'))
MARKER = re.compile(r'(?<![\w(])\(?\s*([ABCDEАБВГД])\s*\)')
BROKEN = re.compile(r'[\x00-\x08\x0B-\x1F\uFFFC\uFFFD]')
FOOTER = re.compile(r'(?:время\s*,?\s*отвед[её]нное|отводится на решение|'
                    r'задачи\s*,?\s*(?:на|оцениваемые)|правила международной|'
                    r'внимание.*в нашей группе)', re.I)
PLAIN_STATEMENT = re.compile(r'^[А-ЯЁA-Z0-9«„(–—][А-Яа-яЁёA-Za-z0-9 .,!?:–—\-«»„“”()№%/…]*[?]$')
VALUE = re.compile(r'^[−-]?\d+(?:[.,]\d+|:\d{2})?(?:\s*(?:%|[а-яё]{1,9}\.?))?$', re.I)
WORDS = re.compile(r'^[А-ЯЁа-яёA-Za-z]+(?:[ -][А-ЯЁа-яёA-Za-z]+){0,10}[.!]?$', re.I)
CHAR_MAP = {c: i for letters in ('ABCDE', 'АБВГД') for i, c in enumerate(letters)}


@lru_cache(maxsize=8)
def printed_glyphs(page):
    matrix = page.rotation_matrix
    flags = (fitz.TEXTFLAGS_RAWDICT & ~fitz.TEXT_PRESERVE_IMAGES) | fitz.TEXT_INHIBIT_SPACES
    glyphs = []
    for block in page.get_text('rawdict', flags=flags)['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                for char in span['chars']:
                    origin = fitz.Point(char['origin']) * matrix
                    box = fitz.Rect(char['bbox']) * matrix
                    glyphs.append((origin.x, origin.y, box, span['size'], char['c']))
    return sorted(glyphs, key=lambda char: (char[1], char[0]))


@lru_cache(maxsize=8)
def page_artwork(page):
    matrix = page.rotation_matrix
    return [fitz.Rect(item['rect']) * matrix for item in page.get_drawings()] + [
        fitz.Rect(item['bbox']) * matrix for item in page.get_image_info()
    ]


def plain_layout(page, rect):
    for b in page_artwork(page):
        if b.width < 0.6 and b.height < 0.6:
            continue
        if b.x1 < rect.x0 + 24 and b.width < 23 and b.height < 17:
            # Small boxes around printed task numbers in recent booklets.
            continue
        area = b + (-0.25, -0.25, 0.25, 0.25)
        if rect.intersects(area):
            return False
    glyphs = [(y, size, ch) for _, y, box, size, ch in printed_glyphs(page)
              if ch.isalnum() and rect.contains(box)]
    if not glyphs:
        return False
    # Shifted numbers in formulas and superscripts require a separate transcription.
    base = max((size for _, size, _ in glyphs), default=0)
    if any(ch.isdigit() and size < 0.84 * base for _, size, ch in glyphs):
        return False
    baselines = []
    for y, _, _ in glyphs:
        if not baselines or y - baselines[-1] >= 1.6:
            if baselines and y - baselines[-1] < 4.5:
                return False
            baselines.append(y)
    return True


def value_kind(value):
    if VALUE.fullmatch(value):
        return 'value'
    if WORDS.fullmatch(value):
        return 'words'
    return ''


def line_text(page, rect):
    rows = defaultdict(list)
    for x, y, box, size, char in printed_glyphs(page):
        if not rect.contains(box):
            continue
        row = min((known for known in rows if abs(known - y) < 1.6),
                  key=lambda known: abs(known - y), default=y)
        rows[row].append((x, box.x1, size, char))
    lines = []
    for _, row in sorted(rows.items()):
        parts = []
        end = -1.0
        previous_x = -1.0
        for x, right, size, char in sorted(row):
            if parts and char == parts[-1] and abs(x - previous_x) < 0.3:
                # Some PDFs print the same glyph twice at a line-fragment boundary.
                continue
            if parts and x - end > .22 * size and not parts[-1].isspace() and not char.isspace():
                parts.append(' ')
            parts.append(char)
            end = right
            previous_x = x
        if line := ''.join(parts).strip():
            lines.append(line)
    return lines


def normalize(text):
    # Remove the discretionary hyphen from the PDF, while keeping printed minus signs.
    text = text.replace('\u00AD', '').replace('\u00A0', ' ')
    return re.sub(r'\s+([,.;?!])', r'\1', re.sub(r'\s+', ' ', text)).strip()


def card_text(page, rect, number):
    if not plain_layout(page, rect):
        return {}
    lines = line_text(page, rect)
    if len(lines) > 1 and re.fullmatch(r'[1-6]', lines[-1].strip()):
        lines = lines[:-1]
    text = normalize(re.sub(r'([А-Яа-яЁё])-\n(?=[а-яё])', r'\1', '\n'.join(lines)))
    footer = FOOTER.search(text)
    if footer:
        text = text[:footer.start()].rstrip()
    if not text or BROKEN.search(text):
        return {}
    number_match = re.match(rf'^{number}(?:[. ]\s*)', text)
    if not number_match:
        return {}
    text = text[number_match.end():]
    options = list(MARKER.finditer(text))
    if [CHAR_MAP[m[1]] for m in options] != list(range(5)):
        return {}
    question = text[:options[0].start()].strip()
    if (not PLAIN_STATEMENT.fullmatch(question) or question.count('(') != question.count(')')
            or len(re.findall(r'[а-яё]', question, re.I)) < 18 or len(question) > 1350
            or re.search(r'рисун|\bрис\.|черт[её]ж|диаграмм|схем|вместо\s+(?:подстав|бумажк)|'
                         r'равн[аоы]?\s+\d*\s*от\b|как[,.;]|дроб[ьи]', question, re.I)):
        return {}
    choices = [text[m.end():options[i + 1].start() if i + 1 < len(options) else len(text)].strip()
               for i, m in enumerate(options)]
    kinds = {value_kind(value) for value in choices}
    result = {'question': question}
    if len(kinds) == 1 and '' not in kinds and len(set(choices)) == 5:
        result['choices'] = choices
    return result


def legacy_regions(pdf, year):
    layout = json.loads((SOURCES / 'legacy-layout' / f'{year}.json').read_text())
    seams = layout.get('seams', {})
    overrides = layout.get('regions', {})
    pages = list(pdf)
    for page_index, x, numbers in LEGACY['printed_columns'](pdf, year):
        page = pages[page_index]
        left, right = x - 5, 478 if len(pdf) == 4 else (813 if x > 420 else 401)
        starts = [(n, LEGACY['TOP_OVERRIDES'].get((year, n), y - 3)) for n, y in numbers]
        for i, (number, top) in enumerate(starts):
            last = i + 1 == len(starts)
            following, bottom = (None, LEGACY['final_boundary'](page, year, x)) if last else starts[i + 1]
            bottom = LEGACY['crop_bottom'](page, left, right, top, bottom, final=last, scanned=year == 2011)
            if number == 26:
                bottom = LEGACY['closing_rule'](page, left, right, top, bottom)
            # Horizontal text stays in the ordinary card limits. Only artwork can extend beyond these seams.
            if str(number) in seams or str(following) in seams:
                if str(number) not in overrides:
                    yield number, page, fitz.Rect(left, top, right, bottom)
                    continue
            yield number, page, fitz.Rect(overrides.get(str(number), (left, top, right, bottom)))


def answer_text(page, number, rect):
    if not plain_layout(page, rect):
        return ''
    lines = line_text(page, rect)
    if len(lines) != 1:
        return ''
    text = normalize(lines[0])
    match = re.match(rf'^{number}\s*\.\s*(.+)$', text)
    if not match or not VALUE.fullmatch(match[1]):
        return ''
    return match[1]


def main():
    editions = {}
    for year in range(1997, 2027):
        cards = {}
        with fitz.open(SOURCES / 'grades-5-6' / str(year) / 'tasks.pdf') as pdf:
            pages = list(pdf)
            for number, (index, rect) in PAPER['task_regions'](pdf, year, 24 if year == 2021 else 30).items():
                entry = card_text(pages[index], rect, number)
                if entry:
                    cards[str(number)] = entry
        if 2010 <= year <= 2020 and year not in (2011, 2019):
            with fitz.open(PAPER['answer_file'](year)) as pdf:
                page = pdf[0]
                for number, rect in enumerate(PAPER['answer_regions'](page, year), 1):
                    text = answer_text(page, number, rect)
                    if text:
                        cards.setdefault(str(number), {})['answerText'] = text
        editions[f'{year}-5-6'] = cards
    for year in range(2001, 2020):
        if year in (2010, 2011, 2019):
            editions[f'{year}-3-4'] = {}
            continue
        with fitz.open(SOURCES / str(year) / 'tasks.pdf') as pdf:
            editions[f'{year}-3-4'] = {
                str(number): data for number, page, rect in legacy_regions(pdf, year)
                if (data := card_text(page, rect, number))
            }
    reviewed = json.loads((SOURCES / 'archive-text-reviewed.json').read_text())
    for edition, cards in reviewed.items():
        for number, data in cards.items():
            editions[edition].setdefault(number, {}).update(data)
    for edition, cards in sorted(editions.items()):
        counts = [sum(key in card for card in cards.values()) for key in ('question', 'choices', 'answerText')]
        print(edition, *counts)
    target = ROOT / 'dist/years/archive-text.js'
    target.write_text("'use strict';\n// Generated by scripts/build-archive-text.py.\n"
                      'globalThis.KENGURU_ARCHIVE_TEXT = ' +
                      json.dumps(editions, ensure_ascii=False, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    main()
