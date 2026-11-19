"""Build the native 2010–2020 grade 5–6 answers verified against the official PDFs."""
from argparse import ArgumentParser
from hashlib import sha256
from html import escape
from io import BytesIO
import json
import math
from pathlib import Path
import re

import fitz
from PIL import Image

from archive_condition_art import vector_figure

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
SOURCES = ROOT / 'sources'
MATERIAL = SOURCES / 'grade-5-6-keys.json'
FIGURES = Path('assets/grade-key-figures')
INK = '#172e34'
GRAY = '#9da2a4'
WHITE = '#fffefa'
DARK = '#30363a'


def svg_path(points, *, fill='none', width=2, close=False):
    path = 'M' + ' L'.join(f'{x:g} {y:g}' for x, y in points) + (' Z' if close else '')
    return f'<path d="{path}" fill="{fill}" stroke="{INK}" stroke-width="{width}"/>'


def svg_text(x, y, text, size=15):
    return (f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" '
            f'text-anchor="middle" fill="{INK}">{escape(str(text))}</text>')


def squares(cells, *, size=25, labels=None, origin=(8,8), gap=0):
    start_x,start_y = origin
    step = size + gap
    area = ''.join(
        f'<rect x="{start_x+x*step}" y="{start_y+y*step}" width="{size}" height="{size}" '
        f'fill="{color}" stroke="{INK}" stroke-width="1.6"/>'
        for x, y, color in cells
    )
    return area + ''.join(svg_text(start_x+x*step+size/2, start_y+y*step+size*.71, text)
                          for (x, y), text in (labels or {}).items())


def face(top_left, across, down, grid):
    def point(x, y):
        return (top_left[0] + x * across[0] + y * down[0],
                top_left[1] + x * across[1] + y * down[1])

    return ''.join(svg_path([point(x, y), point(x+1, y), point(x+1, y+1), point(x, y+1)],
                            fill=color, width=1.6, close=True)
                   for y, row in enumerate(grid) for x, color in enumerate(row))


def solid_cube(front, top, side):
    return (
        face((10, 44), (26, 0), (11, -11), top)
        + face((88, 44), (11, -11), (0, 26), side)
        + face((10, 44), (26, 0), (0, 26), front)
    )


def five_cubes():
    # Faces are read from the official isometric option. The lower projection
    # extends from the front face, while the upper cube extends to the left.
    a,b,c,d,e,f = (205,20),(270,1),(333,20),(270,40),(395,38),(333,59)
    g,h,i,j = (270,123),(205,102),(333,145),(395,125)
    k,l,m,n,o = (333,230),(270,207),(395,210),(395,282),(333,314)
    u,v,w,z = (202,227),(265,255),(265,340),(202,311)
    faces = [
        ([a,b,c,d], WHITE), ([d,c,e,f], WHITE),
        ([a,d,g,h], GRAY), ([d,f,i,g], GRAY), ([f,e,j,i], WHITE),
        ([g,i,k,l], GRAY), ([i,j,m,k], WHITE), ([k,m,n,o], WHITE),
        ([u,l,k,v], WHITE), ([u,v,w,z], GRAY), ([v,k,o,w], WHITE),
    ]
    return ''.join(svg_path([(x-196,y+6) for x,y in points],fill=color,width=2.5,close=True)
                   for points,color in faces)


def triangle_grid():
    a, b, c = (12, 12), (12, 144), (12+66*math.sqrt(3), 78)

    def between(u, v, i):
        return tuple((x * (4-i) + y * i) / 4 for x, y in zip(u, v))

    return svg_path([a, b, c], close=True) + ''.join(
        svg_path([between(u, v, i), between(u, w, i)], width=1.5)
        for u, v, w in ((a,b,c),(b,a,c),(c,a,b)) for i in range(1, 4)
    )


def dashed_line(start, end):
    x, y = start
    dx, dy = end[0]-x, end[1]-y
    length = math.hypot(dx, dy)
    return ''.join(svg_path([(x+dx*a/length,y+dy*a/length),
                            (x+dx*min(a+6,length)/length,y+dy*min(a+6,length)/length)],
                           width=2)
                   for a in range(0,math.ceil(length),12))


def clock():
    def point(radius, offset):
        angle = math.radians(30*offset - 90)
        return 60 + radius*math.cos(angle), 60 + radius*math.sin(angle)

    return (
        f'<circle cx="60" cy="60" r="49" fill="{WHITE}" stroke="{INK}" stroke-width="2"/>'
        + ''.join(f'<circle cx="{x:.3f}" cy="{y:.3f}" r="1.8" fill="{INK}"/>'
                  for x, y in (point(49, tick) for tick in range(12)))
        + svg_path([point(37, 11), (60,60), point(24, 1.8)], width=4)
        + f'<circle cx="60" cy="60" r="3.4" fill="{INK}"/>'
    )


def numbered_grid():
    values = (2, 1, 2, 2)
    labels = {(4, y): label for y, label in enumerate(values)}
    labels.update({(x, 4): label for x, label in enumerate(values)})
    return squares([(x,y,WHITE) for y in range(5) for x in range(5)], labels=labels)


def route():
    return (
        ''.join(f'<circle cx="90" cy="90" r="{r}" fill="none" stroke="#b6c0bd" stroke-width="1.8"/>'
                for r in (25,50,75))
        + '<path d="M15 90H165 M90 15V165" stroke="#cbd3cf" stroke-width="1.2"/>'
        + f'<path d="M90 15V40 A50 50 0 0 0 40 90 H15 A75 75 0 0 0 90 165 V140 A50 50 0 0 0 140 90 H115 A25 25 0 0 0 65 90 H90" '
          f'fill="none" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>'
        + f'<circle cx="90" cy="15" r="3.2" fill="{INK}"/><circle cx="90" cy="90" r="3.2" fill="{INK}"/>'
        + svg_text(107, 17, 'X') + svg_text(99, 108, 'Y')
    )


def manual_figures():
    gray_front = [[GRAY,GRAY,WHITE],[WHITE,GRAY,GRAY],[WHITE,GRAY,GRAY]]
    gray_side = [[WHITE,GRAY,GRAY],[GRAY,WHITE,WHITE],[GRAY,GRAY,WHITE]]
    black_front = [[DARK,WHITE,DARK],[WHITE,WHITE,WHITE],[DARK,WHITE,DARK]]
    checker = [[DARK,WHITE,DARK],[WHITE,DARK,WHITE],[DARK,WHITE,DARK]]
    painted = [[2],[0,3],[0,1],[2,3]]
    return {
        'rotate-five': (80,80,'<text x="40" y="62" font-family="sans-serif" font-size="60" '
                        f'text-anchor="middle" fill="{INK}" transform="rotate(180 40 40)">5</text>'),
        'el': (68,68,squares([(0,0,DARK),(1,0,WHITE),(0,1,GRAY)])),
        'rope': (180,106,
                 f'<path d="M38 15 H58 l5 6 5-6 h9 l5 6 5-6 h9 l5 6 5-6 h8 l5 6 5-6 h18 '
                 'C161 15 170 31 170 49 C170 68 161 84 142 84 h-18 l-5-6 -5 6 h-8 l-5-6 -5 6 h-9 '
                 'l-5-6 -5 6 h-9 l-5-6 -5 6 H38 C19 84 10 68 10 49 C10 31 19 15 38 15 Z '
                 'M63 21L82 78 M101 21V78 M119 21V78 M63 78v13q0 10-11 3 M119 78v13q0 10 11 3" '
                 f'fill="{WHITE}" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>'),
        'five-cubes': (206,354,five_cubes()),
        'strip-net': (220,94,squares([(x,1,WHITE) for x in range(8)]
                     + [(x,0,WHITE) for x in (0,1,7)] + [(x,2,WHITE) for x in (0,1,4)])),
        'triangle': (138,156,triangle_grid()),
        'totals-grid': (141,141,numbered_grid()),
        'steps': (116,116,squares([(x,3-y,WHITE) for x, height in enumerate((4,3,3,2))
                                   for y in range(height)])),
        'house': (84,98,svg_path([(13,89),(13,39),(42,10),(71,39),(71,89)],fill=GRAY,close=True)),
        'clock': (120,120,clock()),
        'empty-grid': (66,66,squares([(x,y,WHITE) for y in range(2) for x in range(2)])),
        'shifted-rows': (166,91,squares([(x,y,GRAY) for y, start in enumerate((0,2,0))
                                          for x in range(start,start+4)])),
        'folds': (116,116,
                  f'<rect x="8" y="8" width="100" height="100" fill="{WHITE}" stroke="{INK}" stroke-width="2"/>'
                  + dashed_line((8,58),(58,8))
                  + dashed_line((8,108),(108,8))
                  + dashed_line((58,108),(108,58))),
        'loop': (172,103,squares([(x,0,GRAY if x < 2 else WHITE) for x in range(3)],
                                            size=36,origin=(25,53),gap=7)
                 + ''.join(f'<circle cx="{x}" cy="71" r="5.8" fill="{WHITE}" stroke="{INK}" stroke-width="2"/>'
                           for x in (43,86,129))
                 + f'<path d="M43 71 C-12 69 -5 14 86 14 C177 14 184 69 129 71 H43 Z" '
                   f'fill="none" stroke="{INK}" stroke-width="2.8"/>'),
        'gray-cube': (132,132,solid_cube(gray_front,gray_front,gray_side)),
        'turn-cards': (116,116,squares([(x,y,DARK if x in painted[y] else WHITE)
                                       for y in range(4) for x in range(4)])),
        'wire': (184,104,svg_path([(53,88),(13,88),(13,12),(53,12),(53,50),(92,50),
                                  (92,12),(132,12),(132,50),(172,50),(172,88),(132,88)],width=3.2)),
        'black-cube': (132,132,solid_cube(black_front,checker,checker)),
        'circle-route': (180,180,route()),
    }


def svg_document(width, height, art, *, origin=(0, 0)):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="{origin[0]} {origin[1]} {width} {height}">\n{art}\n</svg>\n')


def color(value):
    if value is None:
        return 'none'
    return '#' + ''.join(f'{round(component * 255):02x}' for component in value[:3])


def draw_path(drawing):
    commands = []
    previous = None

    def coordinates(point):
        return f'{point.x:.4f} {point.y:.4f}'

    for kind, *points in drawing['items']:
        if kind in ('l', 'c'):
            start, *path = points
            if previous != start:
                commands.append('M' + coordinates(start))
            commands.append(('L' if kind == 'l' else 'C') + ' '.join(map(coordinates,path)))
            previous = path[-1]
        elif kind in ('re', 'qu'):
            shape = points[0]
            corners = ([shape.tl, shape.tr, shape.br, shape.bl] if kind == 're'
                       else [shape.ul, shape.ur, shape.lr, shape.ll])
            if kind == 're' and points[1] == -1:
                corners.reverse()
            commands.append('M' + ' L'.join(map(coordinates,corners)) + ' Z')
            previous = None
        else:
            raise ValueError(f'Unsupported PDF path element {kind}')
    if drawing.get('closePath'):
        commands.append('Z')
    fill_rule = 'evenodd' if drawing.get('even_odd') else 'nonzero'
    attrs = (f'fill="{color(drawing.get("fill"))}" fill-rule="{fill_rule}" '
             f'stroke="{color(drawing.get("color"))}" stroke-width="{drawing.get("width") or 0}" '
             f'fill-opacity="{drawing.get("fill_opacity",1)}" stroke-opacity="{drawing.get("stroke_opacity",1)}"')
    if drawing.get('lineCap'):
        attrs += f' stroke-linecap="{("butt", "round", "square")[max(drawing["lineCap"])]}"'
    if drawing.get('lineJoin') is not None:
        attrs += f' stroke-linejoin="{("miter", "round", "bevel")[int(drawing["lineJoin"])]}"'
    return f'<path d="{" ".join(commands)}" {attrs}/>'


def official_drawing(region, drawings):
    bounds = fitz.Rect(region) + (-0.5,-0.5,0.5,0.5)
    # Rect.contains() drops some degenerate rectangles, including vertical lines.
    selected = [item for item in drawings
                if bounds.x0 <= item['rect'].x0 <= item['rect'].x1 <= bounds.x1
                and bounds.y0 <= item['rect'].y0 <= item['rect'].y1 <= bounds.y1]
    if not selected:
        raise ValueError(f'No vector paths inside {region}')
    areas = [item['rect'] for item in selected]
    x = math.floor(min(area.x0 for area in areas))-4
    y = math.floor(min(area.y0 for area in areas))-4
    width = math.ceil(max(area.x1 for area in areas))+4-x
    height = math.ceil(max(area.y1 for area in areas))+4-y
    if width < 12 or height < 12:
        raise ValueError(f'Unexpected vector size for {region}')
    return width,height,svg_document(width,height,'\n'.join(map(draw_path,selected)),origin=(x,y))


def write(path, data, check):
    read = path.read_bytes if isinstance(data, bytes) else path.read_text
    save = path.write_bytes if isinstance(data, bytes) else path.write_text
    if check:
        if read() != data:
            raise ValueError(f'Rebuild {path.relative_to(ROOT)}')
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        save(data)


def task_option(booklet, selection, prefix, check):
    page = selection['page']
    region = fitz.Rect(selection['rect'])
    if region.is_empty or not booklet[page].rect.contains(region):
        raise ValueError(f'Invalid official task option crop for {prefix}')
    scale = selection.get('rasterScale')
    if scale:
        bitmap = booklet[page].get_pixmap(matrix=fitz.Matrix(scale, scale), clip=region, alpha=False)
        width, height = bitmap.width, bitmap.height
        image = Image.frombytes('RGB', (width, height), bitmap.samples)
        buffer = BytesIO()
        image.save(buffer, 'WEBP', lossless=True)
        path, content = FIGURES / f'{prefix}.webp', buffer.getvalue()
    else:
        width, height = round(region.width * 3), round(region.height * 3)
        path = FIGURES / f'{prefix}.svg'
        content = vector_figure(booklet, page, region, width, height)
    write(DIST / path, content, check)
    return path.as_posix(), width, height


def build(check=False):
    materials = json.loads(MATERIAL.read_text())
    native = manual_figures()
    data = {}
    if sorted(materials) != list(map(str,range(2010,2021))):
        raise ValueError('Expected the eleven value-key editions')
    for year, material in materials.items():
        source = SOURCES / year / 'answers.pdf'
        tasks = SOURCES / 'grades-5-6' / year / 'tasks.pdf'
        if sha256(source.read_bytes()).hexdigest() != material['answersSha256']:
            raise ValueError(f'The official key changed for {year}')
        if sha256(tasks.read_bytes()).hexdigest() != material['tasksSha256']:
            raise ValueError(f'The official tasks changed for {year}')
        if len(material['answers']) != 30:
            raise ValueError(f'Expected 30 answers for {year}')
        result = []
        with fitz.open(source) as pdf, fitz.open(tasks) as booklet:
            paths = pdf[0].get_drawings()
            for number, key in enumerate(material['answers'],1):
                text = key['text']
                letter = key.get('letter')
                if not isinstance(text,str) or not text.strip() or (letter is not None and not re.fullmatch('[АБВГД]',letter)):
                    raise ValueError(f'Invalid answer {year}/{number}')
                figure = key.get('figure')
                entry = [text, letter]
                if figure:
                    if 'taskOption' in figure:
                        path, width, height = task_option(booklet, figure['taskOption'], f'{year}-{number:02}', check)
                    elif 'option' in figure:
                        path = figure['option']
                        if not re.fullmatch(r'assets/grade-conditions/\d{4}/choice-\d{2}-[1-5]\.webp',path):
                            raise ValueError(f'An answer illustration must be a separate choice {year}/{number}')
                        width, height = figure['width'], figure['height']
                        if sha256((DIST / path).read_bytes()).hexdigest() != figure['sha256']:
                            raise ValueError(f'The verified choice changed for {year}/{number}')
                    else:
                        path = str(FIGURES / f'{year}-{number:02}.svg')
                        if 'pdfRegion' in figure:
                            width,height,markup = official_drawing(figure['pdfRegion'],paths)
                        else:
                            width,height,art = native[figure['drawing']]
                            markup = svg_document(width,height,art)
                        write(DIST / path,markup,check)
                    entry.extend([path,width,height])
                result.append(entry)
        data[year] = result
    body = json.dumps(data,ensure_ascii=False,separators=(',',':'))
    write(DIST / 'years/grade-5-6-keys.js',
          "'use strict';\n// Generated by scripts/build-grade-keys.py from verified official material.\n"
          f'globalThis.KENGURU_GRADE_KEYS = {body};\n',check)


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    build(parser.parse_args().check)
