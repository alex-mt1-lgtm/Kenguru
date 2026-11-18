"""Build original grade 5–6 cards with PyMuPDF and Pillow."""
from pathlib import Path
import io
import json
import re

import fitz
from PIL import Image, ImageChops

BASE = Path(__file__).resolve().parents[1]
SOURCES = BASE / 'sources'
MANIFEST = SOURCES / 'grade-5-6-manifest.json'
PUBLIC = BASE / 'dist'
TASKS = SOURCES / 'grades-5-6'
LATIN = 'ABCDE'
CYRILLIC = 'АБВГД'
SCALE = 2.2
SCANS={
2011:[(0,1,465,826,[130,180,230,281,317,367,418,471],545),(0,24,46,410,[42,114,154,227,282,384,455],507),(1,9,46,410,[42,123,210,260,343,396,457],550),(1,16,465,826,[42,102,174,222,283,349,421,472],550)],
2021:[(0,19,29,407,[20,77,145,224,345,430],536),(0,1,436,808,[115,190,253,310,374,419,492],568),(1,8,29,407,[20,184,242,364,474],575),(1,13,436,808,[20,130,266,334,420,504],575)],
2022:[(0,1,16,404,[101.7,205.7,263.7,369.7,437.7,481.7,525.7],576),(1,8,16,405,[24.3,106.3,177.3,253.3,375.3,453.3,507.3],577),(2,15,16,405,[24.3,101.3,156.3,213.3,280.3,349.3,440.3,495.3],577),(3,23,16,405,[24.3,133.3,196.3,250.3,305.3,354.3,444.3,498.3],564)],
2023:[(0,1,15,406,[109.7,180.7,254.3,326.7,393,457.7,524],578),(1,8,15,406,[22.7,89,153,216.7,270,332,393,455,517.3],578),(2,17,15,406,[22.7,106.7,206,249,343,424.7,520],578),(3,24,15,406,[22.7,117.7,190.7,254.3,327.3,385.3,493],550)],
2025:[(0,1,16,405,[98.3,158.3,217.3,300.3,348.7,440.3,492],580),(1,8,20,410,[19,83,132.3,226.7,286.3,345.3,427.7,491],581),(2,16,16,405,[19,94,171.7,244.3,312,438.3,502.7],557),(3,23,20,410,[19,68,142,224.3,306.3,392.7,468.3,521.3],579)],
2026:[(0,1,16,404,[93,199.3,274.3,351,427.7,490],576),(1,7,20,408,[24,77,176.3,213,298.3,356.7,428.7,476.3],580),(2,15,16,404,[19,77.3,196.3,254.7,334.7,415.7,500.7],575),(3,22,16,404,[19,89,168.7,216,275,332.3,378.7,459.3,550.7],582)],
}
NUMBER=re.compile(r'(\d{1,2})(?:\.+(?=\D|$)|\s{2,})')
def page_lines(page):
    for block in page.get_text('dict',flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)['blocks']:
        for line in block.get('lines',[]):
            b=fitz.Rect(line['bbox']) * page.rotation_matrix
            yield b,' '.join(s['text'] for s in line['spans']), ''.join(s['text'] for s in line['spans'])

def find_pages(year, pdf):
    if year in SCANS:
        for pn,n,left,right,starts,end in SCANS[year]:
            yield pn,left,right,[(n+i,y-1.5) for i,y in enumerate(starts)],end
        return
    for pn,page in enumerate(pdf):
        if year<=1999: cols=[(57,65,53,420,534)]
        elif year<=2002 and len(pdf)==4: cols=[(133,140,130,484,680)]
        elif year==2024: cols=[(16,33,14,409,564 if pn == 0 else 549 if pn == 3 else 566 if pn == 2 else 578)]
        elif year==2000: cols=[(54,59,49,408,534),(461,467,457,823,534)]
        elif 2017<=year<=2019: cols=[(39,43,34,399,551),(448,455,445,821,550)]
        elif year==2020: cols=[(30,35,25,394,548),(445,453,441,814,550)]
        elif year==2010: cols=[(38,43,34,395,549),(458,465,453,818,551)]
        elif 2014<=year<=2016: cols=[(42,51,38,399,549),(458,474,453,819,551)]
        else: cols=[(43,52,39,401,549),(464,476,458,824,551)]
        all_lines=list(page_lines(page))
        for lo,hi,left,right,end in cols:
            markers=set()
            for rect,spaced,txt in all_lines:
                if not lo<=rect.x0<=hi or rect.y0>min(page.rect.height-50,end):continue
                if year == 2019 and pn == 0 and left > 420 and rect.y0 < 120:continue
                m=NUMBER.match(txt.strip())
                if m and 1<=int(m[1])<=30:
                    markers.add((int(m[1]),round(rect.y0,1)-1.5))
            if year==2024:
                for word in page.get_text('words'):
                    if not word[4].isascii() or not word[4].isdigit():continue
                    x,y,*_=word
                    if lo<=x<=hi and 1<=int(word[4])<=30 and 16<y<end:
                        markers.add((int(word[4]),round(y,1)-1.5))
            markers=sorted(markers,key=lambda item:item[1])
            ys={}
            for n,y in markers:
                if n not in ys: ys[n]=y
                elif abs(ys[n]-y)>4: print('duplicate-in-column',year,pn,n,ys[n],y)
            ordered=list(ys.items())
            if year<=1999 and pn==len(pdf)-1:ordered=[(n,y) for n,y in ordered if n>20]
            yield pn,left,right,ordered,end

# Point-group headings in paper scans occur between the following tasks.
SCAN_GROUP_ENDS = {
    2021: {8: 160, 16: 391},
    2022: {10: 227, 20: 420},
    2023: {10: 196, 20: 317},
    2025: {10: 203, 20: 411},
    2026: {10: 275, 20: 475},
}


def answer_file(year):
    return (TASKS if year <= 2000 else SOURCES) / str(year) / 'answers.pdf'


def extract_letters(year, page, size):
    if year <= 1999:
        rows = [re.findall('[A-E]', row) for row in page.get_text(sort=True).splitlines()
                if re.fullmatch(r'\s*(?:[A-E]\s*){15}', row)]
        keys = ''.join(sum(rows[:2], []))
        alphabet = LATIN
    elif year <= 2009 or year >= 2022:
        text = page.get_text(sort=year >= 2022)
        starts = list(re.finditer(r'5\s*[-–]\s*6(?:-|\s)*', text))
        end_pattern = r'7\s*[-–]\s*8'
        alphabet = LATIN if year < 2008 else CYRILLIC
        keys = ''
        for start in starts:
            candidate = re.split(end_pattern, text[start.end():], maxsplit=1)[0]
            value = ''.join(re.findall(rf'(?<![\w-])[{alphabet}]+(?![\w-])', candidate))
            if len(value) == size:
                keys = value
                break
    else:
        label = next(fitz.Rect(word[:4]) for word in page.get_text('words') if word[4] == '5-6')
        row = [word for word in page.get_text('words')
               if abs(word[1] - label.y0) < 4 and word[0] > label.x1
               and re.fullmatch(rf'[{CYRILLIC}]+', word[4])]
        keys = ''.join(word[4] for word in sorted(row))
        alphabet = CYRILLIC
    if len(keys) != size:
        raise ValueError(f'{year}: official key has {len(keys)} letters, expected {size}')
    return [alphabet.index(letter) for letter in keys]


def crop_image(page, rect, destination):
    raster = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=rect, alpha=False)
    image = Image.open(io.BytesIO(raster.tobytes('png'))).convert('RGB')
    diff = ImageChops.difference(image, Image.new('RGB', image.size, 'white')).convert('L')
    xs = diff.point(lambda value: 255 if value > 28 else 0).getbbox()
    if xs is None:
        raise ValueError(f'Blank crop {destination}')
    left, top, right, bottom = xs
    image = image.crop((max(0, left - 9), max(0, top - 8),
                        min(image.width, right + 9), min(image.height, bottom + 8)))
    image.save(destination, 'WEBP', quality=88, method=4)
    return image.size


def task_regions(pdf, year, size):
    regions = {}
    for page_index, left, right, starts, end in find_pages(year, pdf):
        page = pdf[page_index]
        for i, (number, top) in enumerate(starts):
            if number in regions or number > size:
                raise ValueError(f'{year}: repeated or unexpected task {number}')
            bottom = starts[i + 1][1] if i + 1 < len(starts) else end
            bottom = min(bottom, SCAN_GROUP_ENDS.get(year, {}).get(number, bottom))
            if year not in SCANS:
                for rect, text, _ in page_lines(page):
                    if (left <= rect.x0 < right and top + 14 < rect.y0 < bottom and
                        re.search(r'задачи\s*,?\s*оцениваемые|отводится на решение|по правилам международной|внимание.*в нашей группе', text, re.I)):
                        bottom = rect.y0 - 1
            if bottom - top < 18:
                raise ValueError(f'{year}: suspicious crop for task {number}')
            regions[number] = (page_index, fitz.Rect(left, top, right, bottom))
    if sorted(regions) != list(range(1, size + 1)):
        raise ValueError(f'{year}: incomplete numbering {sorted(regions)}')
    return regions


def build():
    entries = json.loads(MANIFEST.read_text())['datasets']
    editions = []
    for edition in entries:
        year = edition['year']
        size = 24 if year == 2021 else 30
        assets = PUBLIC / 'assets' / 'grades-5-6' / str(year)
        assets.mkdir(parents=True, exist_ok=True)
        with fitz.open(TASKS / str(year) / 'tasks.pdf') as tasks, fitz.open(answer_file(year)) as answers:
            by_value = 2010 <= year <= 2020
            official_page = answers[0]
            regions = task_regions(tasks, year, size)
            keys = [None] * size if by_value else extract_letters(year, official_page, size)
            cards = []
            for number in range(1, size + 1):
                page, rect = regions[number]
                width, height = crop_image(tasks[page], rect, assets / f'task-{number:02d}.webp')
                cards.append([width, height, keys[number - 1]])
            editions.append({**edition, 'cards': cards})
        print(f'{year}: {size} original cards, {"native value key" if by_value else "letter key"}', flush=True)
    output = PUBLIC / 'years' / 'grades-5-6-data.js'
    encoded = json.dumps(editions, ensure_ascii=False, separators=(',', ':'))
    output.write_text("'use strict';\n// Generated by scripts/build-grades-5-6.py.\n"
                      "globalThis.KENGURU_GRADES_5_6 = " + encoded + ";\n")


if __name__ == '__main__':
    build()
