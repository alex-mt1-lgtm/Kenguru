"""Extract native conditions for the 2001–2019 grade 3–4 archives.

Keep the existing source card when the wording or its drawing cannot be
isolated reliably. Run from the repository with PyMuPDF, Pillow, NumPy
and SciPy. The scanned years also require Tesseract with rus and eng.
"""
import argparse
from collections import Counter
from dataclasses import dataclass
import json
from pathlib import Path
import re
import runpy

import fitz

from archive_condition_art import replace_condition_figure

BASE = Path(__file__).resolve().parents[1]
LEGACY = runpy.run_path(str(BASE / 'scripts' / 'build-legacy-editions.py'))
CONDITIONS = runpy.run_path(str(BASE / 'scripts' / 'build-grade-conditions.py'))

YEARS = list(LEGACY['YEARS'])
SCANS = {2011}
SCALE = CONDITIONS['SCALE']
TARGET = BASE / 'dist' / 'years' / 'legacy-conditions.js'
MARKER = 'globalThis.KENGURU_LEGACY_CONDITIONS = '
BAD_TEXT = re.compile(r'[�\u0000-\u001f\ue000-\uf8ff]')
WORD = CONDITIONS['WORD']
FOOTER = CONDITIONS['FOOTER']


@dataclass
class TaskRegion:
    page: int
    number: int
    rect: fitz.Rect
    marker_x: float
    marker_y: float
    top: list
    bottom: list

    def contains(self, token):
        center = (token.rect.tl + token.rect.br) * .5
        if not self.rect.contains(center):
            return False
        for x0, x1, y in self.top:
            if x0 <= center.x < x1 and center.y < y:
                return False
        for x0, x1, y in self.bottom:
            if x0 <= center.x < x1 and center.y >= y:
                return False
        return True


def task_regions(document, year):
    layout = json.loads((BASE / 'sources' / 'legacy-layout' / f'{year}.json').read_text())
    seams, overrides = layout.get('seams', {}), layout.get('regions', {})
    for page_index, x, markers in LEGACY['printed_columns'](document, year):
        page = document[page_index]
        left = x - 5
        right = 478 if len(document) == 4 else 813 if x > 420 else 401
        limit = LEGACY['final_boundary'](page, year, x)
        starts = [(number, LEGACY['TOP_OVERRIDES'].get((year, number), y - 3))
                  for number, y in markers]
        for i, ((number, top), (_, marker_y)) in enumerate(zip(starts, markers)):
            final = i + 1 == len(starts)
            next_number, bottom = (None, limit) if final else starts[i + 1]
            bottom = LEGACY['crop_bottom'](page, left, right, top, bottom,
                                           final=final, scanned=year == 2011)
            if number == 26:
                bottom = LEGACY['closing_rule'](page, left, right, top, bottom)
            top_cuts = list(LEGACY['cut_segments'](left, right, top, seams.get(str(number), [])))
            bottom_cuts = list(LEGACY['cut_segments'](left, right, bottom,
                                                     seams.get(str(next_number), [])))
            bounds = [left, min(y for _, _, y in top_cuts),
                      right, max(y for _, _, y in bottom_cuts)]
            custom = overrides.get(str(number))
            yield TaskRegion(page_index, number, fitz.Rect(custom or bounds), x, marker_y,
                             [] if custom else top_cuts, [] if custom else bottom_cuts)


def render_task(page, task):
    result, offset = CONDITIONS['render_card'](page, task.rect)
    pixels = fitz.Point(*offset)
    trim_masks = LEGACY['trim_masks']
    # The checked layout is in PDF points. Render both the clips and the
    # masks at the same scale used by the native condition extractor.
    legacy_scale = trim_masks.__globals__['SCALE']
    trim_masks.__globals__['SCALE'] = SCALE
    try:
        trim_masks(result, pixels, task.rect, task.top, True)
        trim_masks(result, pixels, task.rect, task.bottom, False)
    finally:
        trim_masks.__globals__['SCALE'] = legacy_scale
    return result, offset


def custom_font_maps(page):
    # The 2019 PDF omits the Cyrillic alphabet from its ToUnicode maps.
    # Its font encodings name contiguous А–Я and а–я glyphs g570–g633.
    maps = {}
    for xref, _, _, font, *_ in page.get_fonts():
        kind, encoding = page.parent.xref_get_key(xref, 'Encoding')
        if kind != 'xref':
            continue
        dictionary = page.parent.xref_object(int(encoding.split()[0]))
        match = re.search(r'/Differences\s*\[(.*?)\]', dictionary, re.S)
        if not match:
            continue
        position = 0
        table = {}
        for item in re.findall(r'/[^\s/]+|\d+', match[1]):
            if not item.startswith('/'):
                position = int(item)
                continue
            if item.startswith('/g') and item[2:].isdigit():
                code = int(item[2:])
                if 570 <= code <= 633:
                    table[chr(position)] = chr(ord('А') + code - 570)
            position += 1
        if table:
            maps[font.split('+')[-1]] = table
    return maps


def repaired_pdf_tokens(page, year):
    tables = custom_font_maps(page) if year == 2019 else {}
    flags = fitz.TEXTFLAGS_RAWDICT & ~fitz.TEXT_PRESERVE_IMAGES
    matrix = page.rotation_matrix
    characters = []
    for block in page.get_text('rawdict', flags=flags)['blocks']:
        for line in block.get('lines', []):
            end = fitz.Point(line['dir']) * matrix
            start = fitz.Point(0, 0) * matrix
            if abs(end.y - start.y) > .15:
                continue
            for span in line['spans']:
                table = tables.get(span['font'], {})
                for char in span['chars']:
                    value = table.get(char['c'], char['c'])
                    origin = fitz.Point(char['origin']) * matrix
                    characters.append((origin.y, origin.x, {**char, 'c': value}))

    rows = []
    for y, x, char in sorted(characters, key=lambda item: item[0]):
        if not rows or y - rows[-1][0][0] > .62:
            rows.append([])
        rows[-1].append((y, x, char))

    # In 2017 and 2018 many words are physically assembled with a letter
    # printed twice at a span boundary. Keep one copy of each such glyph.
    for row in rows:
        previous_x = None
        previous_char = None
        chars = []
        for _, x, char in sorted(row, key=lambda item: item[1]):
            if previous_x is not None and abs(x - previous_x) < .62 and char['c'] == previous_char:
                continue
            previous_x = x
            previous_char = char['c']
            if char['c'].isspace():
                if chars:
                    yield CONDITIONS['pdf_token'](chars, page)
                    chars = []
                continue
            if chars:
                previous = fitz.Rect(chars[-1]['bbox']) * matrix
                if x - previous.x1 > .8:
                    yield CONDITIONS['pdf_token'](chars, page)
                    chars = []
            chars.append(char)
        if chars:
            yield CONDITIONS['pdf_token'](chars, page)


def source_tokens(page, year, index, cache):
    if year in SCANS:
        return CONDITIONS['ocr_tokens'](page, year, index, cache)
    if year >= 2017:
        return repaired_pdf_tokens(page, year)
    return CONDITIONS['pdf_tokens'](page)


def reading_rows(tokens, task, scan):
    tokens = [token for token in tokens if task.contains(token)]
    if not scan:
        tokens = CONDITIONS['join_superscripts'](tokens)
    return CONDITIONS['token_rows'](tokens, scan)


def read_condition(task, rows, year, scan):
    token_string = CONDITIONS['token_string']
    options = CONDITIONS['marker_expression'](year)
    first_letter = CONDITIONS['LATIN_OPTIONS' if year <= 2007 else 'RUSSIAN_OPTIONS'][0]
    number = re.compile(rf'^{task.number}(?:[.)]|\b)')
    for start, row in enumerate(rows):
        left = row[0]
        if left.rect.x0 <= task.marker_x + 10 and number.match(left.text):
            break
    else:
        return None, 'missing task number'

    printable = [token for token in rows[start] if token.rect.x0 > task.marker_x + 6]
    text_x = printable[0].rect.x0 if printable else task.marker_x + 17
    used_rows = []
    question_tokens = [token for token in rows[start] if token.rect.x0 <= task.marker_x + 6]
    end = None
    for index, row in enumerate(rows[start:], start):
        content = token_string(row)
        match = options.match(content)
        if match and match[1] in first_letter:
            end = index
            break
        if FOOTER.match(content):
            break

        if index == start:
            row = printable
        else:
            row = [token for token in row if token.rect.x0 >= max(task.marker_x + 6, text_x - 18)]
        if not row or row[0].rect.x0 > text_x + 18:
            if len(WORD.findall(content)) >= 3:
                return None, 'unassigned text'
            continue

        run = [row[0]]
        for token in row[1:]:
            if token.rect.x0 - run[-1].rect.x1 > 21:
                break
            run.append(token)
        content = token_string(run)
        if options.search(content):
            return None, 'choices share prose row'
        remainder = token_string(row[len(run):])
        if len(WORD.findall(remainder)) >= 3:
            return None, 'unassigned text'
        used_rows.append((content, run))
        question_tokens.extend(run)

    if end is None or not used_rows:
        return None, 'unreadable alternatives'
    question = CONDITIONS['join_lines']([text for text, _ in used_rows])
    is_calculation = bool(re.fullmatch(r'[0-9(][0-9\s()×·*+÷:−–=/.,?]+[=?]', question))
    if (not is_calculation and len(WORD.findall(question)) < 3 or BAD_TEXT.search(question)
            or not re.match(r'[«(]?[А-ЯЁA-Z0-9]', question)):
        return None, 'unreadable statement'
    if re.search(r'\b[A-Za-z]{2,}[а-яё]|[а-яё]{2,}[A-Za-z]|[а-яё][А-ЯЁ]', question):
        return None, 'ambiguous text'
    if re.search(r'\bвместо\s+подстав', question) or not re.search(r'[?.!:…=»]$', question):
        return None, 'incomplete statement'
    if scan and (not CONDITIONS['confident'](question_tokens) or re.search(r'\b[A-Za-z]{2,}\b', question)):
        return None, 'low OCR confidence'
    return (question, question_tokens, used_rows, end), None


def native_condition(page, task, tokens, year, scan):
    rows = reading_rows(tokens, task, scan)
    result, failure = read_condition(task, rows, year, scan)
    if failure:
        return None, None, failure
    question, question_tokens, prose_rows, choice_start = result
    choices, choice_tokens = CONDITIONS['parse_choices'](rows[choice_start:], year, scan)
    if scan and not choices:
        return None, None, 'scan needs visual review'

    image, offset = render_task(page, task)
    remove_tokens = CONDITIONS['remove_tokens']
    footer = [token for row in rows if FOOTER.match(CONDITIONS['token_string'](row)) for token in row]
    remove_tokens(image, offset, question_tokens + footer)
    clipped = CONDITIONS['clean_visual'](image, year)
    if CONDITIONS['has_inline_ink'](image, offset, prose_rows, year):
        return None, None, 'inline formula or illustration'

    visual = CONDITIONS['crop_visual'](image, year)
    if choices:
        figures_only = image.copy()
        remove_tokens(figures_only, offset, choice_tokens)
        choice_ids = {id(token) for token in choice_tokens}
        answer_rows = [(CONDITIONS['token_string'](row), row) for row in rows[choice_start:]
                       if any(id(token) in choice_ids for token in row)]
        if CONDITIONS['has_inline_ink'](figures_only, offset, answer_rows, year):
            choices = None
        else:
            visual = CONDITIONS['crop_visual'](figures_only, year)
    if visual and clipped:
        return None, None, 'illustration intersects task boundary'
    if scan and (not choices or visual):
        return None, None, 'scan needs visual review'
    if not choices and visual is None:
        return None, None, 'missing alternatives'
    entry = {'question': question}
    if choices:
        entry['choices'] = choices
    return entry, visual, None


def build(years, cache, preview):
    catalog = {}
    if not preview and TARGET.exists() and years != YEARS:
        catalog = json.loads(TARGET.read_text().strip().split(MARKER, 1)[1].removesuffix(';'))
    for year in years:
        entries = {}
        failures = Counter()
        folder = BASE / 'dist' / 'assets' / 'legacy-conditions' / str(year)
        scan = year in SCANS
        manual_path = BASE / 'sources' / str(year) / 'native-conditions.json'
        manual = json.loads(manual_path.read_text()) if manual_path.is_file() else {}
        with fitz.open(BASE / 'sources' / str(year) / 'tasks.pdf') as pdf:
            try:
                tokens = [list(source_tokens(page, year, i, cache)) for i, page in enumerate(pdf)]
            except (FileNotFoundError, CONDITIONS['subprocess'].CalledProcessError):
                print(f'{year}: OCR unavailable, retaining checked conditions', flush=True)
                tokens = None
            if tokens is None:
                entries.update({int(number): entry for number, entry in catalog.get(str(year), {}).items()})
            for task in task_regions(pdf, year):
                if str(task.number) in manual or tokens is None:
                    continue
                entry, visual, failure = native_condition(pdf[task.page], task, tokens[task.page], year, scan)
                if failure:
                    failures[failure] += 1
                    if preview:
                        print(f'{year}/{task.number} skipped: {failure}')
                    continue
                if visual:
                    name = f'task-{task.number:02d}.webp'
                    entry.update(image=f'assets/legacy-conditions/{year}/{name}',
                                 imageWidth=visual.width, imageHeight=visual.height)
                    if not preview and not replace_condition_figure(pdf, 'legacy-conditions', year, task.number, entry):
                        folder.mkdir(parents=True, exist_ok=True)
                        visual.save(folder / name, 'WEBP', quality=91, method=4)
                entries[task.number] = entry
                if preview:
                    print(f'{year}/{task.number}: {entry}')
            for number, entry in manual.items():
                if not entry.get('question') or ('choices' in entry and len(entry['choices']) != 5):
                    raise ValueError(f'{year}/{number}: invalid checked condition')
                if not preview:
                    replace_condition_figure(pdf, 'legacy-conditions', year, int(number), entry)
                entries[int(number)] = entry
        images = sum('image' in item for item in entries.values())
        choices = sum('choices' in item for item in entries.values())
        print(f'{year}: {len(entries)}/26 statements, {choices} text choices, {images} illustrations {failures}', flush=True)
        catalog[str(year)] = dict(sorted(entries.items()))
    if not preview:
        encoded = json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))
        TARGET.write_text("'use strict';\n// Generated by scripts/build-legacy-conditions.py.\n" + MARKER + encoded + ';\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ocr-cache', type=Path)
    parser.add_argument('--preview', action='store_true')
    parser.add_argument('years', nargs='*', type=int, choices=YEARS, metavar='YEAR')
    args = parser.parse_args()
    if args.ocr_cache:
        args.ocr_cache.mkdir(parents=True, exist_ok=True)
    build(args.years or YEARS, args.ocr_cache, args.preview)
