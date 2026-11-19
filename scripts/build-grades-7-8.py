"""Build the 7–8 class catalogue and illustrations from reviewed source data."""

from base64 import b64encode
from hashlib import sha256
from html import escape
from io import BytesIO
import json
from pathlib import Path
import re

import fitz
from PIL import Image

from pdf_figure import cropped_svg

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources'
DIST = ROOT / 'dist'
LETTERS = 'АБВГД'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def answer_key(year, task_count):
    with fitz.open(SOURCES / str(year) / 'answers.pdf') as document:
        lines = [line.strip() for line in document[0].get_text(sort=True).splitlines() if line.strip()]
    for index, line in enumerate(lines):
        label = re.match(r'^7[-–]8-?\s+класс\b', line)
        if not label:
            continue
        answer_line = line[label.end():].strip() or lines[index + 2]
        key = ''.join(answer_line.split())
        if len(key) == task_count and all(letter in LETTERS for letter in key):
            return key
    raise ValueError(f'Official key for {year} does not contain {task_count} letters')


def is_scan(page, region):
    if page.rotation:
        region = region * page.derotation_matrix
    for entry in page.get_image_info():
        overlap = region & fitz.Rect(entry['bbox'])
        if overlap.get_area() >= region.get_area() * .98:
            return True
    return False


def crop_art(document, asset_folder, name, page_number, coordinates, force_raster=False):
    page = document[page_number]
    regions = [fitz.Rect(region) for region in coordinates]
    if not regions or any(region.is_empty or region not in page.rect for region in regions):
        raise ValueError(f'{asset_folder}/{name}: invalid crop {coordinates} on page {page_number}')
    bounds = fitz.Rect(regions[0])
    for region in regions[1:]:
        bounds |= region

    asset_folder = Path('assets/grades-7-8') / str(asset_folder)
    (DIST / asset_folder).mkdir(parents=True, exist_ok=True)
    width, height = round(bounds.width * 3), round(bounds.height * 3)
    if force_raster or any(is_scan(page, region) for region in regions):
        path = asset_folder / (name + '.webp')
        canvas = Image.new('RGB', (width, height), 'white')
        for region in regions:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=region, alpha=False)
            image = Image.open(BytesIO(pixmap.tobytes('png')))
            canvas.paste(image, (round((region.x0 - bounds.x0) * 3), round((region.y0 - bounds.y0) * 3)))
        canvas.save(DIST / path, lossless=True)
        return {'src': path.as_posix(), 'width': width, 'height': height,
                'pixelWidth': width, 'pixelHeight': height}

    path = asset_folder / (name + '.svg')
    if len(regions) == 1:
        markup = cropped_svg(document, page_number, bounds)
    else:
        markup = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {bounds.width} {bounds.height}">']
        for region in regions:
            fragment = cropped_svg(document, page_number, region)
            data = b64encode(fragment.encode()).decode()
            markup.append(f'<image x="{region.x0 - bounds.x0}" y="{region.y0 - bounds.y0}" '
                          f'width="{region.width}" height="{region.height}" '
                          f'xlink:href="data:image/svg+xml;base64,{data}"/>')
        markup.append('</svg>')
        markup = '\n'.join(markup)
    (DIST / path).write_text(markup, encoding='utf-8')
    return {'src': path.as_posix(), 'width': width, 'height': height}


def task_cards(edition, folder, metadata, solution_steps):
    year = edition['year']
    tasks = metadata['tasks']
    key = metadata.get('answerKey') or answer_key(year, len(tasks))
    if len(key) != len(tasks) or not all(letter in LETTERS + '-' for letter in key):
        raise ValueError(f'Unexpected key for {year}')
    assert len(tasks) in (24, 30) and len({task['title'] for task in tasks}) == len(tasks)
    with fitz.open(folder / 'tasks.pdf') as document:
        for index, task in enumerate(tasks):
            number = index + 1
            name = f'task-{number:02d}'
            title, question, choices, page = (task[field] for field in ('title', 'question', 'choices', 'page'))
            if not title.strip() or not question.strip() or len(choices) != 5 or not all(choice.strip() for choice in choices):
                raise ValueError(f'{year} task {number}: missing title, condition or choices')
            rectangles = task.get('choiceRects', [None] * 5)
            if len(rectangles) != len(choices):
                raise ValueError(f'{year} task {number}: expected one optional crop per answer')
            option_parts = task.get('choiceParts', [None] * 5)
            if len(option_parts) != len(choices):
                raise ValueError(f'{year} task {number}: expected optional regions for each answer')
            options = []
            for choice_index, (choice, rect, parts) in enumerate(zip(choices, rectangles, option_parts)):
                if rect or parts:
                    art = crop_art(document, year, f'{name}-answer-{choice_index + 1}', page, parts or [rect])
                    options.append({'image': art['src'], 'description': choice, **{
                        field: art[field] for field in ('pixelWidth', 'pixelHeight') if field in art
                    }})
                else:
                    options.append({'text': choice})
            figure = task.get('figureParts') or ([task['figure']] if task.get('figure') else [])
            condition = None
            if figure:
                condition = crop_art(document, year, name, page, figure, task.get('figureRaster', False))
                condition['alt'] = task.get('figureAlt') or 'Рисунок из условия задачи'
            explanation = solution_steps.get(str(number), {})
            answer = LETTERS.find(key[index])
            if explanation.get('letter', key[index]) != key[index]:
                raise ValueError(f'{year} task {number}: solution letter differs from the official key')
            yield {
                'number': number, 'title': title, 'question': question, 'options': options,
                'condition': condition, 'answer': None if answer < 0 or explanation.get('ambiguous') else answer,
                'points': 3 + index // (len(tasks) // 3), 'review': explanation.get('steps', []),
                'keyNote': explanation.get('keyNote'),
            }


def solution_data(edition, folder):
    editorial = folder / 'solutions.json'
    if not editorial.exists():
        return {}
    solutions = read_json(editorial)
    figures_file = folder / 'solution-figures.json'
    if not figures_file.exists():
        return solutions
    figures = read_json(figures_file)
    year = edition['year']
    source = SOURCES / str(year) / 'solutions.pdf' if year != 2024 else SOURCES / 'kenguru_2024_solution.pdf'
    with fitz.open(source) as document:
        for number, figure in figures.items():
            steps = solutions.get(number, {}).get('steps', [])
            if not steps:
                continue
            for index, entry in enumerate(figure if isinstance(figure, list) else [figure]):
                stage = steps[entry.get('step', len(steps) - 1)]
                coordinates = entry.get('figureParts') or [entry['rect']]
                art = crop_art(document, year, f'solution-{int(number):02d}-{index + 1}', entry['page'], coordinates)
                stage.update(image=art['src'], imageWidth=art['width'], imageHeight=art['height'])
    return solutions


def update_archive(datasets, active_editions):
    path = DIST / 'archive.html'
    archive = path.read_text(encoding='utf-8')
    heading = '    <details class="archive-grade" id="grades-7-8">'
    section = ['    <!-- grades-7-8:start -->', heading, '      <summary>7–8 классы</summary>']
    for first, last in [(2020, 2026), (2010, 2019), (2000, 2009), (1997, 1999)]:
        opened = ' open' if last == 2026 else ''
        section.extend([f'      <details class="archive-decade" id="years-{first}-7-8"{opened}>',
                        f'        <summary>{first}–{last}</summary>', '        <ul class="archive-editions">'])
        for edition in reversed(datasets):
            year = edition['year']
            if not first <= year <= last:
                continue
            links = []
            for field, label in [('tasksUrl', 'Задания PDF'), ('answersUrl', 'Ответы PDF'), ('solutionUrl', 'Решения PDF')]:
                if edition[field]:
                    links.append(f'<a href="{escape(edition[field])}" target="_blank" rel="noopener">{label}</a>')
            interactive = (f'<a class="archive-open" href="./#zadacha={edition["id"]}/1">Решать вариант</a>'
                           if edition['id'] in active_editions else '')
            section.append(f'          <li class="archive-card"><h3>{year}</h3>{interactive}<div class="archive-files">'
                           + ' '.join(links) + '</div></li>')
        section.extend(['        </ul>', '      </details>'])
    section.extend(['    </details>', '    <!-- grades-7-8:end -->'])
    block = '\n'.join(section)
    if heading in archive:
        archive = re.sub(r'    <!-- grades-7-8:start -->.*?    <!-- grades-7-8:end -->', lambda _: block, archive, flags=re.S)
    else:
        archive = archive.replace('  </main>', block + '\n  </main>')
    archive = archive.replace('для 3–4 и 5–6 классов', 'для 3–8 классов')
    path.write_text(archive, encoding='utf-8')


def main():
    manifest = read_json(SOURCES / 'grade-7-8-manifest.json')
    datasets = manifest['datasets']
    editions = []
    for edition in datasets:
        folder = SOURCES / 'grades-7-8' / str(edition['year'])
        metadata = folder / 'edition.json'
        if not metadata.exists():
            continue
        cards = list(task_cards(edition, folder, read_json(metadata), solution_data(edition, folder)))
        editions.append({**edition, 'cards': cards})
    payload = ('globalThis.KENGURU_GRADES_7_8 = ' + json.dumps(editions, ensure_ascii=False, separators=(',', ':')) + ';\n')
    (DIST / 'years/grades-7-8-data.js').write_text(payload, encoding='utf-8')
    page = DIST / 'index.html'
    page.write_text(re.sub(r'years/grades-7-8-data\.js\?v=[a-z0-9]+',
                           'years/grades-7-8-data.js?v=' + sha256(payload.encode()).hexdigest()[:10],
                           page.read_text(encoding='utf-8')), encoding='utf-8')
    update_archive(datasets, {edition['id'] for edition in editions})


if __name__ == '__main__':
    main()
