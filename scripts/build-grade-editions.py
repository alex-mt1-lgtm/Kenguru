"""Build grade catalogues and illustrations from reviewed source data."""

from base64 import b64encode
from hashlib import sha256
from html import escape
from io import BytesIO
from math import floor, hypot
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


def answer_key(edition, task_count):
    year = edition['year']
    grades = edition.get('keyGrades', edition['grades'])
    with fitz.open(SOURCES / str(year) / 'answers.pdf') as document:
        for page in document:
            lines = [line.strip() for line in page.get_text(sort=True).splitlines() if line.strip()]
            for index, line in enumerate(lines):
                label = re.match(r'^(\d+(?:\s*[-–]\s*\d+)*)-?\s+класс\w*\b', line)
                if not label:
                    continue
                ends = [int(value) for value in re.findall(r'\d+', label[1])]
                if list(range(ends[0], ends[-1] + 1)) != grades:
                    continue
                answer_line = line[label.end():].strip()
                if not answer_line and index + 2 < len(lines):
                    answer_line = lines[index + 2]
                key = ''.join(answer_line.split())
                if len(key) == task_count and all(letter in LETTERS for letter in key):
                    return key
    raise ValueError(f"Official key for {edition['id']} does not contain {task_count} letters")


def asset_folder(edition):
    return Path('assets') / ('grades-' + edition['id'].split('-', 1)[1]) / str(edition['year'])


def is_scan(page, region):
    if page.rotation:
        region = region * page.derotation_matrix
    for entry in page.get_image_info():
        overlap = region & fitz.Rect(entry['bbox'])
        if overlap.get_area() >= region.get_area() * .98:
            return True
    return False


def embedded_raster_size(page, region):
    images = []
    for entry in page.get_image_info():
        box = fitz.Rect(entry['bbox']) * page.rotation_matrix
        if (box & region).get_area() >= .4 * region.get_area():
            images.append(entry)
    if len(images) != 1:
        return {}
    image = images[0]
    transform = fitz.Matrix(*image['transform']) * page.rotation_matrix
    # Express the embedded photograph's resolution over the whole SVG viewport,
    # including the margin, so the CSS limit applies to the actual raster.
    points_per_pixel = max(hypot(transform.a, transform.b) / image['width'],
                           hypot(transform.c, transform.d) / image['height'])
    return {'pixelWidth': max(1, floor(region.width / points_per_pixel)),
            'pixelHeight': max(1, floor(region.height / points_per_pixel))}


def crop_art(document, asset_folder, name, page_number, coordinates, force_raster=False, raster_scale=3):
    page = document[page_number]
    regions = [fitz.Rect(region) for region in coordinates]
    if not regions or any(region.is_empty or region not in page.rect for region in regions):
        raise ValueError(f'{asset_folder}/{name}: invalid crop {coordinates} on page {page_number}')
    bounds = fitz.Rect(regions[0])
    for region in regions[1:]:
        bounds |= region

    (DIST / asset_folder).mkdir(parents=True, exist_ok=True)
    if force_raster or any(is_scan(page, region) for region in regions):
        width, height = round(bounds.width * raster_scale), round(bounds.height * raster_scale)
        path = asset_folder / (name + '.webp')
        canvas = Image.new('RGB', (width, height), 'white')
        for region in regions:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(raster_scale, raster_scale), clip=region, alpha=False)
            image = Image.open(BytesIO(pixmap.tobytes('png')))
            canvas.paste(image, (round((region.x0 - bounds.x0) * raster_scale),
                                 round((region.y0 - bounds.y0) * raster_scale)))
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
    return {'src': path.as_posix(), 'width': round(bounds.width * 3), 'height': round(bounds.height * 3)}


def task_cards(edition, folder, metadata, solution_steps):
    identifier = edition['id']
    assets = asset_folder(edition)
    tasks = metadata['tasks']
    alphabet = metadata.get('answerLetters', LETTERS)
    if alphabet not in (LETTERS, 'ABCDE'):
        raise ValueError(f'Unexpected answer alphabet for {identifier}')
    key = metadata.get('answerKey')
    if edition['year'] >= 2021:
        published_key = answer_key(edition, len(tasks))
        if key and key != published_key:
            raise ValueError(f'Answer key differs from the organizer’s PDF for {identifier}')
        key = published_key
    if not key or len(key) != len(tasks) or not all(letter in alphabet + '-' for letter in key):
        raise ValueError(f'Unexpected key for {identifier}')
    counts = metadata.get('pointsPerGroup')
    if counts is None and len(tasks) in (18, 24, 30):
        counts = [len(tasks) // 3] * 3
    if not counts or len(counts) != 3 or min(counts) < 1 or sum(counts) != len(tasks):
        raise ValueError(f'Unexpected point groups for {identifier}')
    point_values = [points for points, count in enumerate(counts, 3) for _ in range(count)]
    if len({task['title'] for task in tasks}) != len(tasks):
        raise ValueError(f'Duplicate titles for {identifier}')
    with fitz.open(folder / 'tasks.pdf') as document:
        for index, task in enumerate(tasks):
            number = index + 1
            name = f'task-{number:02d}'
            title, question, choices, page = (task[field] for field in ('title', 'question', 'choices', 'page'))
            if not 1 <= len(title.strip()) <= 30 or not question.strip() or len(choices) != 5 or not all(choice.strip() for choice in choices):
                raise ValueError(f'{identifier} task {number}: missing title, condition or choices')
            rectangles = task.get('choiceRects', [None] * 5)
            if len(rectangles) != len(choices):
                raise ValueError(f'{identifier} task {number}: expected one optional crop per answer')
            option_parts = task.get('choiceParts', [None] * 5)
            if len(option_parts) != len(choices):
                raise ValueError(f'{identifier} task {number}: expected optional regions for each answer')
            reviewed_options = task.get('choiceAssets', [None] * 5)
            if len(reviewed_options) != len(choices):
                raise ValueError(f'{identifier} task {number}: expected one optional reviewed asset per answer')
            raster_options = task.get('choiceRaster', False)
            if isinstance(raster_options, bool):
                raster_options = [raster_options] * len(choices)
            if len(raster_options) != len(choices):
                raise ValueError(f'{identifier} task {number}: expected one raster flag per answer')
            options = []
            choices_and_art = zip(choices, rectangles, option_parts, raster_options, reviewed_options)
            for choice_index, (choice, rect, parts, raster, asset) in enumerate(choices_and_art):
                if asset:
                    if not (DIST / asset).is_file():
                        raise ValueError(f'{identifier} task {number}: missing reviewed option {choice_index + 1}')
                    options.append({'image': asset, 'description': choice})
                elif rect or parts:
                    regions = parts or [rect]
                    art = crop_art(document, assets, f'{name}-answer-{choice_index + 1}', page,
                                   regions, raster, task.get('choiceRasterScale', 3))
                    if 'pixelWidth' not in art and len(regions) == 1:
                        art.update(embedded_raster_size(document[page], fitz.Rect(regions[0])))
                    options.append({'image': art['src'], 'description': choice, **{
                        field: art[field] for field in ('pixelWidth', 'pixelHeight') if field in art
                    }})
                else:
                    options.append({'text': choice})
            figure = task.get('figureParts') or ([task['figure']] if task.get('figure') else [])
            condition = None
            asset = task.get('figureAsset')
            if asset:
                if not (DIST / asset['src']).is_file():
                    raise ValueError(f'{identifier} task {number}: missing reviewed figure')
                condition = dict(asset)
            elif figure:
                condition = crop_art(document, assets, name, page, figure, task.get('figureRaster', False))
            if condition:
                condition['alt'] = task.get('figureAlt') or 'Рисунок из условия задачи'
            explanation = solution_steps.get(str(number), {})
            answer = alphabet.find(key[index])
            if explanation.get('letter', key[index]) != key[index]:
                raise ValueError(f'{identifier} task {number}: solution letter differs from the official key')
            yield {
                'number': number, 'title': title, 'question': question, 'options': options,
                'condition': condition, 'answer': None if answer < 0 or explanation.get('ambiguous') else answer,
                'points': point_values[index], 'review': explanation.get('steps', []),
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
                coordinates = entry.get('figureParts') or [entry['rect']]
                art = crop_art(document, asset_folder(edition), f'solution-{int(number):02d}-{index + 1}', entry['page'], coordinates)
                for step in entry.get('steps', [entry.get('step', len(steps) - 1)]):
                    steps[step].update(image=art['src'], imageWidth=art['width'], imageHeight=art['height'])
    return solutions


def archive_section(group, summary, datasets, active_editions):
    section = [f'    <!-- grades-{group}:start -->',
               f'    <details class="archive-grade" id="grades-{group}">',
               f'      <summary>{summary}</summary>']
    for first, last in [(2020, 2026), (2010, 2019), (2000, 2009), (1997, 1999)]:
        entries = [edition for edition in reversed(datasets) if first <= edition['year'] <= last]
        if not entries:
            continue
        opened = ' open' if last == 2026 else ''
        section.extend([f'      <details class="archive-decade" id="years-{first}-{group}"{opened}>',
                        f'        <summary>{first}–{last}</summary>', '        <ul class="archive-editions">'])
        for edition in entries:
            links = []
            for field, label in [('tasksUrl', 'Задания PDF'), ('answersUrl', 'Ответы PDF'), ('solutionUrl', 'Решения PDF')]:
                if edition[field]:
                    links.append(f'<a href="{escape(edition[field])}" target="_blank" rel="noopener">{label}</a>')
            interactive = (f'<a class="archive-open" href="./#zadacha={edition["id"]}/1">Решать вариант</a>'
                           if edition['id'] in active_editions else '')
            heading = str(edition['year'])
            if edition['label'] != summary:
                heading += ' · ' + edition['label']
            section.append(f'          <li class="archive-card"><h3>{heading}</h3>{interactive}<div class="archive-files">'
                           + ' '.join(links) + '</div></li>')
        section.extend(['        </ul>', '      </details>'])
    section.extend(['    </details>', f'    <!-- grades-{group}:end -->'])
    return '\n'.join(section)


def update_archive(groups, active_editions):
    path = DIST / 'archive.html'
    archive = path.read_text(encoding='utf-8')
    for identifier, summary, datasets in groups:
        section = archive_section(identifier, summary, datasets, active_editions)
        marker = f'    <!-- grades-{identifier}:start -->'
        if marker in archive:
            pattern = re.escape(marker) + r'.*?' + re.escape(f'    <!-- grades-{identifier}:end -->')
            archive = re.sub(pattern, lambda _: section, archive, flags=re.S)
        else:
            anchor = '    <details class="archive-grade" id="grades-3-4"' if identifier == '1-2' else '  </main>'
            archive = archive.replace(anchor, section + '\n' + anchor, 1)
    archive = archive.replace('для 3–8 классов', 'для 1–11 классов')
    path.write_text(archive, encoding='utf-8')


def compile_editions(datasets, filename, name):
    editions = []
    for edition in datasets:
        folder = SOURCES / edition.get('sourceDir', f'grades-7-8/{edition["year"]}')
        metadata_file = folder / 'edition.json'
        if not metadata_file.exists():
            continue
        metadata = read_json(metadata_file)
        cards = list(task_cards(edition, folder, metadata, solution_data(edition, folder)))
        sources = {field: edition[field] for field in ('id', 'year', 'grades', 'label', 'tasksUrl', 'answersUrl', 'solutionUrl')}
        editions.append({**sources, 'answerLetters': metadata.get('answerLetters', LETTERS), 'cards': cards})
    payload = f'globalThis.{name} = ' + json.dumps(editions, ensure_ascii=False, separators=(',', ':')) + ';\n'
    (DIST / 'years' / filename).write_text(payload, encoding='utf-8')
    page = DIST / 'index.html'
    page.write_text(re.sub(r'years/' + re.escape(filename) + r'\?v=[a-z0-9]+',
                           'years/' + filename + '?v=' + sha256(payload.encode()).hexdigest()[:10],
                           page.read_text(encoding='utf-8')), encoding='utf-8')
    return {edition['id'] for edition in editions}


def main():
    middle = read_json(SOURCES / 'grade-7-8-manifest.json')['datasets']
    extra = read_json(SOURCES / 'grade-junior-senior-manifest.json')['datasets']
    junior = [edition for edition in extra if max(edition['grades']) <= 2]
    senior = [edition for edition in extra if min(edition['grades']) >= 9]
    active = compile_editions(middle, 'grades-7-8-data.js', 'KENGURU_GRADES_7_8')
    active |= compile_editions(extra, 'grade-junior-senior-data.js', 'KENGURU_JUNIOR_SENIOR')
    update_archive([('1-2', '1–2 классы', junior), ('7-8', '7–8 классы', middle),
                    ('9-11', '9–11 классы', senior)], active)


if __name__ == '__main__':
    main()
