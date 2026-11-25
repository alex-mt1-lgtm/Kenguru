"""Check the new British Bulldog lessons against their archived files and official keys."""

import hashlib
import json
from pathlib import Path
import re

import fitz


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'sources' / 'british-bulldog'
ASSETS = ROOT / 'dist' / 'assets' / 'british-bulldog'
YEAR_RANGE = range(2014, 2020)
LETTERS = 'ABCD'
# The organizer accepted every answer for these questions. The lesson wording
# or choices were refined to make a single answer possible.
REVISED_QUESTIONS = {(2014, '3-4', 37), (2016, '5-6', 28)}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def archive_id(form):
    return form['year'], form['tasksFile']


def official_answers(path, grade):
    with fitz.open(path) as pdf:
        text = pdf[0].get_text(sort=True).replace('‐', '-').replace('–', '-')
    header = grade + ' классы'
    section = re.split(r'\b\d+-\d+\s+классы', text.split(header, 1)[1], maxsplit=1)[0]
    return {
        int(number): letter.translate(str.maketrans('АВС', 'ABC'))
        for number, letter in re.findall(r'\b(\d{1,2})\s*([ABCDАВС*])(?=\s|$)', section)
    }


def check_material(path, source_record):
    assert path.is_file(), path
    assert hashlib.sha256(path.read_bytes()).hexdigest() == source_record['sha256'], path


def check_edition(edition, original):
    year = edition['year']
    source_dir = SOURCE / str(year)
    asset_dir = ASSETS / str(year)
    for field in ('tasks', 'answers', 'listening'):
        filename = edition[field + 'File']
        check_material(source_dir / filename, original[field])
        check_material(asset_dir / filename, original[field])

    rows = read_json(ROOT / edition['sourceFile'])
    official = official_answers(source_dir / edition['answersFile'], edition['grade'])
    assert len(rows) == edition['count'] == len(official) == 60, edition
    for number, row in enumerate(rows, 1):
        identifier = (year, edition['grade'], number)
        assert row['question'].strip() and 0 < len(row['title']) <= 30, identifier
        assert len(row['choices']) == len(LETTERS) and all(row['choices']), identifier
        assert len(row['steps']) >= 2 and all(step.strip() for step in row['steps']), identifier
        assert bool(row.get('audio')) == (number <= 10), identifier
        if identifier in REVISED_QUESTIONS:
            assert official[number] == '*' and row.get('adaptation'), identifier
        else:
            assert LETTERS[row['answer']] == official[number], identifier

        figures = [*row.get('figures', []), *row.get('optionFigures', [])]
        if row.get('figure'):
            figures.append(row['figure'])
        for figure in filter(None, figures):
            assert figure['alt'].strip(), identifier
            for field in ('src', 'detailSrc'):
                if figure.get(field):
                    assert (ROOT / 'dist' / figure[field]).is_file(), (identifier, figure[field])


def main():
    archive = read_json(SOURCE / 'archive-materials.json')
    existing = read_json(ROOT / 'sources' / 'subject-editions.json')
    editions = read_json(SOURCE / 'interactive-2014-2019.json')
    expected = {archive_id(row) for row in archive if row['year'] in YEAR_RANGE}
    expected.difference_update(archive_id(row) for row in existing if row['subject'] == 'british-bulldog')
    assert len(editions) == len(expected) and {archive_id(row) for row in editions} == expected

    provenance = read_json(SOURCE / 'archive-sources.json')
    originals = {
        package['tasks']['localFile']: package
        for season in provenance['seasons']
        for package in season['packages']
        if package.get('tasks', {}).get('localFile')
    }
    for edition in editions:
        check_edition(edition, originals[f"{edition['year']}/{edition['tasksFile']}"])
    print(f'Checked {len(editions)} editions and {sum(row["count"] for row in editions)} lessons.')


if __name__ == '__main__':
    main()
