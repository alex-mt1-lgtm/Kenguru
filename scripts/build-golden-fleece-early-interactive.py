"""Transcribe the 2009–2014 Golden Fleece booklets and render the original illustrations."""

from collections import defaultdict
import argparse
import json
from math import log
from pathlib import Path
import re
import runpy
import subprocess
import unicodedata

import fitz
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'sources/golden-fleece'
START = re.compile(r'^(\d{1,2})\s*\.\s*(.*)')
CHOICE = re.compile(r'(?<![\w])([AАBВБCСГ])\s*\)\s*')
RUSSIAN = 'АБВГ'
LATIN = 'ABC'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, values):
    path.write_text(json.dumps(values, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def restore_kazakh_encoding(document):
    glyphs = {'g3': ' ', 'g4': '!', 'g11': '(', 'g12': ')', 'g15': ',', 'g16': '-', 'g17': '.',
              'g34': '?', 'g36': 'A', 'g37': 'B', 'g38': 'C', 'g116': '–', 'g136': '«', 'g152': '»',
              'g448': 'І', 'g521': 'ё', 'g526': 'і', 'space': ' ', 'hyphen': '-',
              'period': '.', 'one': '1', 'three': '3', 'four': '4'}
    glyphs.update({f'g{i}': char for i, char in enumerate('0123456789', 19)})
    glyphs.update({f'g{i}': char for i, char in enumerate('әӘғҒқҚңҢөӨұҰүҮһ', 221)})
    alphabet = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
    glyphs.update({f'g{i}': char for i, char in enumerate(alphabet + alphabet.lower(), 457)})
    glyphs.update({'g71': 'd', 'g74': 'g', 'g81': 'n', 'g82': 'o', 'g85': 'r', 'g88': 'u', 'g90': 'w'})
    fonts = {xref for page in document for xref, _, _, name, *_ in page.get_fonts()
             if 'TimesNewRomanKZ' in name}
    for xref in fonts:
        _, reference = document.xref_get_key(xref, 'Encoding')
        differences = document.xref_get_key(int(reference.split()[0]), 'Differences')[1]
        codes = {}
        for part in re.findall(r'/[^/\s\[\]]+|\d+', differences):
            if part[0] != '/':
                code = int(part)
                continue
            codes[code] = glyphs[part[1:]]
            code += 1
        mappings = '\n'.join(f'<{code:02x}> <{ord(char):04x}>' for code, char in codes.items())
        cmap = ('/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n'
                '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n'
                '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n'
                '1 begincodespacerange\n<00> <ff>\nendcodespacerange\n'
                f'{len(codes)} beginbfchar\n{mappings}\nendbfchar\n'
                'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n')
        stream = document.get_new_xref()
        document.update_object(stream, '<< >>')
        document.update_stream(stream, cmap.encode('ascii'))
        document.xref_set_key(xref, 'ToUnicode', f'{stream} 0 R')


def normalized(text):
    text = unicodedata.normalize('NFC', text).rstrip()
    if text.endswith('\u00ad'):
        text = text[:-1] + '-'
    return ' '.join(text.replace('\u00ad', '').split())


def join_lines(lines):
    text = ''
    for line in lines:
        line = normalized(line)
        if re.search(r'[a-zа-яёәіңғүұқөһ]-$', text, re.I) and re.match(r'[a-zа-яёәіңғүұқөһ]', line):
            last = text.split()[-1]
            if last.count('-') == 1 and not re.match(r'^(?:[IVXLCDM]+|какой|кто|что|Санкт|Сент|Нью|Жан)-$', last):
                text = text[:-1] + line
            else:
                text += line
        else:
            text = f'{text} {line}'.strip()
    return re.sub(r'\s+([,?!;:])', r'\1', text)


def page_lines(page):
    columns = 4 if page.rect.width > 1100 else 3
    sections = defaultdict(list)
    for block in page.get_text('dict', flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)['blocks']:
        for line in block['lines']:
            rect = fitz.Rect(line['bbox']) * page.rotation_matrix
            content = ''.join(span['text'] for span in line['spans'])
            if not normalized(content):
                continue
            column = min(columns - 1, int((rect.x0 + 2) / page.rect.width * columns))
            sections[column].append((rect, content))
    for column, lines in sorted(sections.items()):
        rows = []
        for rect, content in sorted(lines, key=lambda line: (line[0].y0, line[0].x0)):
            previous = rows[-1] if rows else []
            if previous and abs(previous[0][0].y1 - rect.y1) < 2.5 and all(
                    old.x1 <= rect.x0 + 0.6 or rect.x1 <= old.x0 + 0.6 for old, _ in previous):
                previous.append((rect, content))
            else:
                rows.append([(rect, content)])
        yield column, [[(rect, content) for rect, content in sorted(row, key=lambda item: item[0].x0)] for row in rows]


def heading_label(text):
    text = normalized(text)
    return bool(re.match(r'^[А-ЯЁӘІҢҒҮҰҚӨҺа-яёәіңғүұқөһ ]{3,48}$', text)
                and text.lower() in HEADINGS)


HEADINGS = {'мифология', 'литература', 'интересные факты', 'наука', 'история', 'искусство', 'архитектура',
            'музыка', 'география', 'живопись', 'традиции', 'мәдениет', 'тарих', 'әдебиет', 'өнер',
            'қалалар және аймақтар', 'қалалар мен аймақтар', 'қызықты деректер', 'салт-дәстүрлер',
            'иберия в мировой', 'художественной культуре', 'города и регионы', 'географические открытия',
            'культура повседневности', 'города и замки', 'художественная культура',
            'общие сведения', 'достопримечательности', 'памятники', 'лондон', 'выдающиеся личности',
            'история науки', 'музеи европы', 'знаменитые жители', 'храмы и соборы', 'имена городов',
            'қалалар мен өңірлер', 'күнделікті мәдениет', 'географиялық ашулар',
            'әлемдік көркем мәдениеттегі иберия', 'қалалар мен қамалдар', 'көркем мәдениет',
            'жалпы мәліметтер', 'қызықты фактілер', 'назар аударарлық орындар', 'кескіндеме',
            'ескерткіштер', 'көрнекті тұлғалар', 'ғылым тарихы', 'ғылым',
            'символы городов', 'скульптура', 'горизонты европы', 'международные организации'}


def parse_booklet(document, year):
    questions = {}
    sections = {}
    figures = defaultdict(list)
    number = None
    pending_heading = None
    for page in document:
        for column, lines in page_lines(page):
            if column >= (3 if page.rect.width > 1100 else 2) and page.number == 1:
                continue
            for line in lines:
                cleaned = [(rect, normalized(content)) for rect, content in line]
                labels = [(rect, content) for rect, content in cleaned if re.fullmatch(r'\d{1,2}', content)]
                for rect, content in labels:
                    figures[int(content)].append((page.number, rect))
                # Picture numbers are in small isolated text boxes. Large inline numbers can be dates.
                cleaned = [(rect, content) for rect, content in cleaned if (rect, content) not in labels]
                if not cleaned:
                    continue
                rect, _ = cleaned[0]
                text = ' '.join(content for _, content in cleaned)
                if re.fullmatch(r'(?i)(?:[0-9– -]+\s*)?(?:классы|сыныптар)(?:\s*[0-9– -]+\s*(?:классы|сыныптар))*', text) or '.indd' in text:
                    continue
                match = START.match(text)
                if match and 1 <= int(match[1]) <= 60:
                    next_number = int(match[1])
                    if next_number in questions:
                        raise ValueError(f'{document.name}: duplicate question {next_number}')
                    if pending_heading:
                        sections[next_number] = pending_heading
                    pending_heading = None
                    number = next_number
                    questions[number] = {'page': page.number, 'column': column,
                                         'start': tuple(rect), 'lines': [match[2]]}
                elif heading_label(text):
                    pending_heading = text.capitalize()
                    number = None
                elif number:
                    questions[number]['lines'].append(text)
    return questions, sections, figures


def splits(line):
    marks = list(CHOICE.finditer(line))
    if marks:
        return marks
    # The 2012 Kazakh booklet prints the choices with dots and puts each on its own line.
    dot = re.match(r'^([AАBВCС])\.\s*', line)
    return [dot] if dot else []


def parse_choices(lines):
    groups = []
    for line_index, line in enumerate(lines):
        for mark in splits(line):
            groups.append((line_index, mark))
    for offset, (line_index, first) in enumerate(groups):
        if first[1] not in 'AА' or offset + 2 >= len(groups):
            continue
        second_index, second = groups[offset + 1]
        third_index, third = groups[offset + 2]
        if second[1] not in 'BВБ' or third[1] not in 'CС':
            continue
        before = [*lines[:line_index], lines[line_index][:first.start()]]
        middle = []
        for (start_i, start), (end_i, end) in ((groups[offset], groups[offset + 1]), (groups[offset + 1], groups[offset + 2])):
            if start_i == end_i:
                middle.append(lines[start_i][start.end():end.start()])
            else:
                middle.append(join_lines([lines[start_i][start.end():], *lines[start_i + 1:end_i], lines[end_i][:end.start()]]))
        return join_lines(before), [*map(normalized, middle), join_lines([lines[third_index][third.end():], *lines[third_index + 1:]])]
    return join_lines(lines), []


def keys(path):
    text = subprocess.run(['pdftotext', '-layout', str(path), '-'], check=True, capture_output=True, text=True).stdout
    headings = list(re.finditer(r'(?m)^\s*(\d{1,2}-\d{1,2}) классы\b', text))
    answers = {}
    for i, heading in enumerate(headings):
        data = text[heading.end():headings[i + 1].start() if i + 1 < len(headings) else len(text)]
        answers[heading[1]] = {int(n): letter for n, letter in re.findall(r'(?<!\w)(\d{1,2})\.?\s+([АБВГABC*])(?=\s|$)', data)}
    return answers


CITY_CHOICES = {
    '5-6': ('Берлин|Лондон|Париж|Санкт-Петербург', 'Великий Новгород|Казань|Киев|Москва',
            'Афины|Мадрид|Рим|Стамбул'),
    '7-8': ('Берлин|Лондон|Париж|Санкт-Петербург', 'Амстердам|Барселона|Дрезден|Флоренция',
            'Будапешт|Варшава|Вена|Прага'),
    '9-11': ('Берлин|Лондон|Париж|Санкт-Петербург', 'Антверпен|Венеция|Лиссабон|Севилья',
             'Брюссель|Женева|Краков|Страсбург'),
}
HERO_CHOICES = {
    '3-4': ('Белоснежка|Спящая красавица|Золушка', 'Геракл|Самсон|Илья Муромец',
            'Пеппи Длинный Чулок|Алиса|Элли Смит', 'Муми-тролль|Буратино/Пиноккио|Винни Пух',
            'Кот в сапогах|Конёк-Горбунок|Гусь Мартин'),
    '5-6': ('Микула Селянинович|Илья Муромец|Садко', 'Вильгельм Телль|Робин Гуд|Соколиный Глаз',
            'Лемюэль Гулливер|Робинзон Крузо|Одиссей', 'Баба Яга|Снегурочка|Русалочка',
            'Том Сойер|Джим Хокинс|Оливер Твист', 'Мерлин|Черномор|Гэндальф'),
    '7-8': ('Руслан и Людмила|Ромео и Джульетта|Орфей и Эвридика', 'Робин Гуд|Владимир Дубровский|Карл Моор',
            'Чичиков|Молчалин|Невзоров', 'Базаров|Раскольников|Обломов',
            'Шерлок Холмс|Эркюль Пуаро|Комиссар Мегрэ', 'Роланд|Айвенго|Парсифаль'),
    '9-11': ('Ромео и Джульетта|Тристан и Изольда|Паоло и Франческа', 'Чацкий|Онегин|Печорин',
             'Доктор Фауст|Дориан Грей|Мастер', 'Воланд|Мефистофель|Демон',
             'Татьяна Ларина|Софья Фамусова|Наташа Ростова', 'Дон-Кихот|Князь Мышкин|Степан Копенкин'),
}
HERO_SECTIONS = {
    '3-4': ('Героини сказок', 'Богатыри и силачи', 'Путешественницы', 'Герои детских книг', 'Помощники героев'),
    '5-6': ('Былинные герои', 'Меткие стрелки', 'Морские путешественники', 'Сказочные героини',
            'Герои приключений', 'Волшебники'),
    '7-8': ('Влюблённые', 'Благородные разбойники', 'Литературные авантюристы', 'Герои русских романов',
            'Сыщики', 'Рыцари'),
    '9-11': ('Судьбы влюблённых', 'Герои русской классики', 'Мечты и стремления', 'Демонические персонажи',
             'Героини русской классики', 'Рыцари и мечтатели'),
}
# One row per printed image cluster. Integers are zero-based PDF image positions on the indicated page.
CITY_IMAGES = {
    '5-6': [(1, 0, [1, 0, 2]), (13, 0, [5, 4, 3]), (16, 0, [6, 7, 8]), (22, 0, [14, 13, 12]),
            (28, 0, [10, 11, 9]), (31, 1, [5, 1, 2]), (34, 1, [0, 3, 4]), (40, 1, [9, 11, 10]),
            (43, 1, [7, 6, 8])],
    '7-8': [(1, 0, [2, 1, 4]), (4, 0, [3, 5, 0]), (16, 0, [6, 8, 7]), (22, 0, [14, 12, 13]),
            (28, 0, [11, 9, 10]), (31, 1, [1, 2, 0]), (43, 1, [4, 5, 3])],
    '9-11': [(1, 0, [1, 0, 2]), (13, 0, [11, 10, 9]), (16, 0, [3, 5, 4]), (25, 0, [12, 13, 14]),
             (28, 0, [6, 8, 7]), (31, 1, [4, 3, 5]), (34, 1, [1, 0, 2])],
}
CITY_GROUPS = {
    '5-6': ('виды|гербы|виды|гербы|памятники|виды|соборы|гербы|арки').split('|'),
    '7-8': ('виды|памятники|виды|гербы|памятники|виды|достопримечательности').split('|'),
    '9-11': ('виды|памятники|виды|памятники|гербы|виды|организации').split('|'),
}
CITY_PROMPTS = {
    'виды': ('Горизонты Европы', 'Какие города изображены на фотографиях?'),
    'гербы': ('Символы городов', 'Каким городам принадлежат изображённые гербы?'),
    'памятники': ('Городская скульптура', 'В каких городах находятся эти скульптуры?'),
    'соборы': ('Храмы и соборы', 'В каких городах находятся эти соборы?'),
    'арки': ('Городские арки', 'В каких городах находятся эти арки?'),
    'достопримечательности': ('Достопримечательности', 'С какими городами связаны эти изображения?'),
    'организации': ('Штаб-квартиры', 'В каких городах находятся штаб-квартиры этих международных организаций?'),
}
HERO_IMAGES = {
    '3-4': [(8, 0, [6, 5, 2]), (18, 0, [7, 3, 4]), (25, 0, [8]), (38, 1, [7, 5, 6]), (50, 1, [8])],
    '5-6': [(8, 0, [4, 3, 2]), (28, 0, [7, 5, 6]), (38, 1, [8, 9, 10]), (48, 1, [6, 5, 7]), (60, 1, [12])],
    '7-8': [(8, 0, [2, 3, 4]), (20, 0, [5]), (48, 1, [5]), (58, 1, [7, 6, 9])],
    '9-11': [(8, 0, [2, 3, 4]), (38, 1, [10, 8, 9]), (48, 1, [6, 7, 5]), (60, 1, [11])],
}
HERO_MATCHING = {'3-4': (), '5-6': (8, 28, 38, 48), '7-8': (8,), '9-11': (38, 48)}


def load_illustration_masters():
    restoration = runpy.run_path(str(ROOT / 'scripts/build-golden-fleece-reading-pdfs.py'))
    restored = {}
    for entry in read(SOURCE / 'reading-pdfs.json'):
        for target in entry['targets']:
            if int(target['task'].split('/')[0]) in range(2009, 2015):
                restored[target['task']] = (entry, target)
    return restoration, restored


READING_RESTORATION, READING_MASTERS = load_illustration_masters()


def figure_source(year, grade, variant, number, page, rect, native_size, output, language, master):
    destination = f'assets/golden-fleece/{year}/interactive-{grade}{"-" + variant if variant else ""}/{number}.webp'
    target = ROOT / 'dist' / destination
    target.parent.mkdir(parents=True, exist_ok=True)
    edition = grade + ('-v' + variant.replace('-', '') if variant else '')
    rect = fitz.Rect(rect) & page.rect
    provenance = {'page': page.number, 'rect': [round(value, 3) for value in rect]}
    source = READING_MASTERS.get(f'{year}/{edition}/{number}')
    caption = f'{number}-тапсырмаға сурет' if language == 'kk' else f'Иллюстрация к заданию {number}'
    if source is not None:
        entry, region = source
        crop = READING_RESTORATION['crop_master']
        picture = crop(crop(READING_RESTORATION['load_master'](entry), entry), region)
        provenance['restoration'] = entry['id']
        if entry.get('source'):
            provenance['source'] = entry['source']
        if entry.get('substitute'):
            caption += ' · ' + ('Сол нысанның басқа фотосуреті' if language == 'kk' else 'Современный снимок того же объекта')
    elif master:
        with Image.open(SOURCE / str(year) / master['file']) as original:
            picture = ImageOps.exif_transpose(original).convert('RGB')
        provenance.update({'master': master['file'], 'source': master['source']})
    else:
        zoom = min(native_size[0] / rect.width, native_size[1] / rect.height, 4)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=rect, alpha=False)
        picture = Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)
    provenance['nativeSize'] = list(picture.size)
    figure = {'src': destination, 'alt': caption, 'caption': caption}
    if max(picture.size) > 620:
        detail = target.with_stem(target.stem + '-detail')
        picture.save(detail, quality=93, method=4)
        figure['detailSrc'] = detail.relative_to(ROOT / 'dist').as_posix()
        picture.thumbnail((620, 620), Image.Resampling.LANCZOS)
    picture.save(target, lossless=True)
    figure.update({'width': picture.width, 'height': picture.height})
    output[str(number)] = provenance
    return figure


def section_for(sections, number):
    return next(title for start, title in reversed(sorted(sections.items())) if start <= number)


def read_reviews(directory):
    data = {}
    for path in sorted(directory.glob('walkthroughs-early*.txt')):
        grade_rows = None
        for line in path.read_text(encoding='utf-8').splitlines():
            if not line or line.startswith('#'):
                continue
            if line.startswith('[') and line.endswith(']'):
                grade_rows = data.setdefault(line[1:-1], {})
                continue
            number, title, *steps = line.split('|')
            if grade_rows is None or len(steps) < 2 or not title:
                raise ValueError(f'{path}: incomplete walkthrough {line}')
            key = int(number)
            if key in grade_rows:
                raise ValueError(f'{path}: duplicate walkthrough {key}')
            grade_rows[key] = {'title': title, 'steps': steps}
    return data


def trim_question(lines):
    parts = []
    for line in lines:
        if CHOICE.match(line) or line.startswith(('Кто изображен на иллюстрациях?', 'Кто из этих героев изображен')):
            break
        parts.append(line)
    text = join_lines(parts)
    return re.split(r'\s+(?:Укажите города, в которых находятся:|Как называются представленные картины\?)$', text)[0]


def add_city_prompts(grade, questions, sections, matches):
    prompts = {}
    for start, theme in zip((row[0] for row in CITY_IMAGES[grade]), CITY_GROUPS[grade]):
        title, question = CITY_PROMPTS[theme]
        sections[start] = title
        matches.append({'start': start, 'count': 3, 'title': title, 'question': question, 'originalNumbers': True})
        for number in range(start, start + 3):
            prompts[number] = question
    if grade == '9-11':
        for number in range(4, 7):
            prompts[number] = 'В каком городе находится эта картина? ' + trim_question(questions[number]['lines'])
        for number in range(10, 13):
            prompts[number] = 'В каком городе происходит действие произведения? ' + trim_question(questions[number]['lines'])
    if grade == '7-8':
        for number in range(19, 22):
            prompts[number] = 'В каком городе находится этот музей? ' + trim_question(questions[number]['lines'])
    return prompts


def add_hero_prompts(grade, questions, sections, matches):
    prompts = {}
    group_question = 'Кто изображён на иллюстрациях?'
    for start, _, positions in HERO_IMAGES[grade]:
        for number in range(start, start + len(positions)):
            if number not in questions:
                prompts[number] = 'Кто изображён на иллюстрации?'
        if start in HERO_MATCHING[grade]:
            matches.append({'start': start, 'count': len(positions), 'title': 'Герои на иллюстрациях',
                            'question': group_question, 'originalNumbers': True})
    sections.clear()
    sections.update({start * 10 + 1: title for start, title in enumerate(HERO_SECTIONS[grade])})
    return prompts


def fix_prompt(year, grade, variant, number, question, section):
    question = re.split(r'\s+(?:Кто создал эти картины\?|Как называются представленные картины\?|'
                        r'Кто изображен на этих памятниках\?|Как называются эти картины\?)$', question)[0]
    if question:
        return question
    if variant in ('kz', '980'):
        return 'Бұл суретте кім бейнеленген?' if section == 'Ескерткіштер' else 'Мына туынды қалай аталады?'
    if year == 2011:
        if grade == '5-6' and number <= 54 or grade == '3-4':
            return 'Как называется эта картина?'
        return 'Кто создал эту картину?'
    if section == 'Памятники':
        return 'Кто изображён на этом памятнике?'
    return 'Как называется эта картина?'


def normalize_answers(year, letters):
    if year <= 2010:
        return letters.translate(str.maketrans('АБВГABC', 'АБВГАБВ'))
    return letters.translate(str.maketrans('АБВС', 'ABBC'))


def booklet_images(year, grade, document, positions):
    if year <= 2010:
        spec = (CITY_IMAGES if year == 2009 else HERO_IMAGES)[grade]
        positions = {n + offset: (p, index) for n, p, indices in spec for offset, index in enumerate(indices)}
    page_images = [page.get_image_info() for page in document]
    figures = {}
    for number, (page_index, image_index) in positions.items():
        page = document[page_index]
        entry = page_images[page_index][image_index]
        rectangle = fitz.Rect(entry['bbox']) * page.rotation_matrix
        native_size = (entry['width'], entry['height'])
        if page.rotation in (90, 270):
            ratio = rectangle.width / rectangle.height
            image_ratio = native_size[0] / native_size[1]
            if abs(log(ratio * image_ratio)) < abs(log(ratio / image_ratio)):
                native_size = native_size[::-1]
        figures[int(number)] = (page, rectangle, native_size)
    return figures


def edition(form, key, corrections):
    year, grade, variant = form['year'], form['grade'], form.get('variant', '')
    directory = SOURCE / str(year)
    suffix = f'v{variant.replace("-", "")}' if variant else ''
    set_id = f'{grade}{"-" + suffix if suffix else ""}'
    language = 'kk' if variant in ('kz', '980') else 'ru'
    letters = RUSSIAN[:4 if year == 2009 else 3] if year <= 2010 else LATIN
    theme = form['title']
    count = 45 if year == 2009 else 50 if year <= 2012 and grade == '3-4' else 60
    if set(key) != set(range(1, count + 1)):
        raise ValueError(f'{year}/{set_id}: incomplete key {len(key)} / {count}')
    matches = []
    art = {}
    reviews = read_reviews(directory)
    revisions_file = directory / 'interactive-revisions.json'
    all_revisions = read(revisions_file) if revisions_file.exists() else {}
    for patch in sorted(directory.glob('interactive-revisions-*.json')):
        for edition_id, changes in read(patch).items():
            all_revisions.setdefault(edition_id, {}).update(changes)
    order_file = directory / 'interactive-order.json'
    order = read(order_file).get(set_id, list(range(1, count + 1))) if order_file.exists() else list(range(1, count + 1))
    if sorted(order) != list(range(1, count + 1)):
        raise ValueError(f'{year}/{set_id}: invalid correspondence to the reference booklet')
    canonical = f'{grade}-v540' if variant else grade
    positions = read(directory / 'interactive-figure-pages.json')[set_id] if year >= 2011 else {}
    masters_file = directory / 'interactive-masters.json'
    masters = read(masters_file).get(set_id, {}) if masters_file.exists() else {}
    with fitz.open(directory / form['tasksFile']) as document:
        if year == 2013 and variant == 'kz':
            restore_kazakh_encoding(document)
        questions, sections, labels = parse_booklet(document, year)
        if year == 2009:
            prompts = add_city_prompts(grade, questions, sections, matches)
        elif year == 2010:
            prompts = add_hero_prompts(grade, questions, sections, matches)
        else:
            prompts = {}
        if year == 2014 and grade == '9-11' and language == 'ru':
            sections[1] = 'Иберия в мировой культуре'
        images = booklet_images(year, grade, document, positions)
        if year >= 2012 and set(images) != set(labels):
            raise ValueError(f'{year}/{set_id}: illustrated questions do not match the printed labels')
        rows = []
        for number in range(1, count + 1):
            task = questions.get(number)
            section = section_for(sections, number)
            if year <= 2010:
                options = (CITY_CHOICES if year == 2009 else HERO_CHOICES)[grade]
                choices = options[(number - 1) // (15 if year == 2009 else 10)].split('|')
                question = prompts.get(number) or trim_question(task['lines'])
            else:
                question, choices = parse_choices(task['lines'])
                question = fix_prompt(year, grade, variant, number, question, section)
            letter = normalize_answers(year, key[number] or "*")
            fixed = corrections.get((year, grade, variant, number))
            if fixed:
                answer = fixed['answer']
                choices = fixed['choices']
                question = fixed['question']
            else:
                answer = letters.find(letter)
            if not choices or len(choices) != len(letters) or not 0 <= answer < len(choices):
                raise ValueError(f'{year}/{set_id}/{number}: invalid choices or answer {letter}: {choices}')
            image = None
            original_figure_valid = not fixed or year == 2011 and (grade, number) in {
                ('3-4', 43), ('3-4', 48), ('5-6', 27), ('9-11', 42),
            }
            if number in images and original_figure_valid:
                page, rect, native_size = images[number]
                image = figure_source(year, grade, variant, number, page, rect, native_size, art, language,
                                      masters.get(str(number)))
            reference_number = order[number - 1]
            review = reviews.get(set_id, {}).get(number) or reviews.get(canonical, {}).get(reference_number)
            if review is None:
                raise ValueError(f'{year}/{set_id}/{number}: missing walkthrough')
            row = {'number': number, 'question': question, 'choices': choices, 'answer': answer, **review}
            if image:
                row['figure'] = {**image, 'alt': review['title'] + ' · ' + image['caption']}
            inherited = all_revisions.get(canonical, {}).get(str(reference_number), {})
            if language == 'kk' and set_id != canonical:
                inherited = {key: value for key, value in inherited.items() if key not in ('question', 'choices', 'adaptation')}
            row.update(inherited)
            row.update(all_revisions.get(set_id, {}).get(str(number), {}))
            if year == 2009 and grade == '5-6' and number == 21:
                row['question'] = 'Символ этого города — Золотые ворота, построенные в XI веке.'
                row['adaptation'] = 'Исправлена дата постройки: 1164 год относится к Золотым воротам во Владимире.'
                row['references'] = ['https://www.britannica.com/place/Kyiv/Landscape', 'https://whc.unesco.org/en/list/633/']
            if year == 2009 and grade == '7-8' and number == 9:
                row['question'] = 'В центре этого города стояла знаменитая тюрьма, которую восставшие взяли 14 июля 1789 года.'
                row['adaptation'] = 'Уточнена дата взятия Бастилии.'
                row['references'] = ['https://www.britannica.com/event/storming-of-the-Bastille']
            if fixed:
                row.update({k: v for k, v in fixed.items() if k not in ('year', 'grade', 'variant')})
            if len(row['title']) > 30:
                title = row['title']
                while len(title) > 30 and ' ' in title:
                    title = title.rsplit(' ', 1)[0]
                row['title'] = title[:30]
            rows.append(row)
    source_file = directory / f'interactive-{set_id}.json'
    write(source_file, rows)
    if art:
        write(directory / f'interactive-art-{set_id}.json', {'source': form['tasksFile'], 'figures': art})
    asset_directory = ROOT / f'dist/assets/golden-fleece/{year}/interactive-{grade}{"-" + variant if variant else ""}'
    current_images = {ROOT / 'dist' / figure[prop] for row in rows if (figure := row.get('figure'))
                      for prop in ('src', 'detailSrc') if prop in figure}
    for path in asset_directory.glob('*.webp'):
        if path not in current_images:
            path.unlink()
    meta = {'subject': 'golden-fleece', 'year': year, 'grade': grade, 'contest': 'Золотое руно',
            'letters': letters, 'count': count, 'language': language, 'points': 3, 'tasksFile': form['tasksFile'],
            'answersFile': form['answersFile'], 'title': theme, 'sourceFile': source_file.relative_to(ROOT).as_posix(),
            'sections': [{'start': start, 'title': title} for start, title in sorted(sections.items())]}
    if suffix:
        meta.update({'variant': variant, 'editionSuffix': suffix, 'editionLabel': form['variantLabel']})
    if matches:
        meta['matchingGroups'] = matches
    return meta


def build(selected):
    registry = SOURCE / 'interactive-2009-2014.json'
    meta = [row for row in read(registry) if row['year'] not in selected] if registry.exists() else []
    fixes = {(r['year'], r['grade'], r['variant'], r['number']): r for r in read(SOURCE / 'archive-corrections-modern.json')}
    base = {(r['year'], r['grade'], r['variant']): {i + 1: a for i, a in enumerate(r['answers'])}
            for r in read(SOURCE / 'paper-base-keys.json')}
    for form in read(SOURCE / 'archive-materials.json'):
        year, grade, variant = form['year'], form['grade'], form.get('variant', '')
        if year not in selected:
            continue
        key = base.get((year, grade, variant))
        if not key:
            key = keys(SOURCE / str(year) / form['answersFile'])[grade]
        print(f'{year} · {grade} · {variant}')
        meta.append(edition(form, key, fixes))
    write(registry, sorted(meta, key=lambda row: (row['year'], row.get('variant', ''), row['grade'])))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('years', type=int, nargs='*', metavar='YEAR')
    options = parser.parse_args()
    supported = set(range(2009, 2015))
    if set(options.years) - supported:
        parser.error('choose a year between 2009 and 2014')
    build(set(options.years) or supported)
