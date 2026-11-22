"""Build ЧИП reading copies with enlarged figures linked from the source pages."""
from io import BytesIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'sources' / 'chip'
ASSETS = ROOT / 'dist' / 'assets' / 'chip'

INK = (0.12, 0.18, 0.23)
BLUE = (0.03, 0.30, 0.52)
MUTED = (0.31, 0.36, 0.40)
LINE = (0.79, 0.83, 0.86)
WHITE = (1, 1, 1)
REGULAR = fitz.Font('helv')
BOLD = fitz.Font('hebo')
LETTERS = 'АБВГД'
MARGIN = 25
WIDTH = 518
HEIGHT = 620


def write(page, x, y, label, size, *, bold=False, color=INK):
    name, font = ('ReadingBold', BOLD) if bold else ('ReadingRegular', REGULAR)
    page.insert_font(fontname=name, fontbuffer=font.buffer)
    page.insert_text(
        fitz.Point(x, y) * page.derotation_matrix, label, fontname=name,
        fontsize=size, color=color, rotate=page.rotation,
    )
    return font.text_length(label, fontsize=size)


def goto(page, rect, destination):
    page.insert_link({
        'kind': fitz.LINK_GOTO, 'from': rect * page.derotation_matrix,
        'page': destination.number, 'to': destination.rect.tl * destination.derotation_matrix,
    })


def figure_source(year, panel):
    return MANIFEST / year / panel['file']


def draw_panel(page, rect, path):
    if path.suffix == '.svg':
        with fitz.open(path) as svg:
            with fitz.open('pdf', svg.convert_to_pdf()) as art:
                page.show_pdf_page(rect, art, 0)
    elif path.suffix == '.webp':
        with Image.open(path) as original:
            data = BytesIO()
            if max(original.size) >= 900:
                original.convert('RGB').save(data, 'JPEG', quality=96, subsampling=0)
            else:
                original.save(data, 'PNG')
        page.insert_image(rect, stream=data.getvalue())
    else:
        page.insert_image(rect, filename=str(path))


def plate(reader, edition, entry, source_index):
    page = reader.new_page(width=WIDTH, height=HEIGHT)
    supplement_index = page.number
    write(page, MARGIN, 32, f'ЧИП · {edition["label"]}', 13, color=MUTED)
    heading = entry.get('heading', f'Задание № {entry["number"]}')
    write(page, MARGIN, 64, heading, 25, bold=True)
    write(page, MARGIN, 85, f'Иллюстрации к странице {source_index + 1}', 12, color=MUTED)
    page.draw_line((MARGIN, 98), (WIDTH - MARGIN, 98), color=LINE, width=0.7)

    panels = entry['panels']
    if len(panels) == 1:
        draw_panel(page, fitz.Rect(MARGIN, 116, WIDTH - MARGIN, 546),
                   figure_source(edition['year'], panels[0]))
        if panels[0].get('caption'):
            write(page, MARGIN, 555, panels[0]['caption'], 10, color=MUTED)
    elif entry.get('comparison'):
        for i, panel in enumerate(panels):
            y = 116 + i * 223
            write(page, MARGIN, y, panel['caption'], 12, bold=True)
            draw_panel(page, fitz.Rect(MARGIN, y + 11, WIDTH - MARGIN, y + 210),
                       figure_source(edition['year'], panel))
    else:
        # One sheet shows the complete series in booklet order.
        panel_width = (WIDTH - MARGIN * 2 - 22) / 2
        for i, panel in enumerate(panels):
            x = MARGIN + i % 2 * (panel_width + 22)
            y = 110 + i // 2 * 145
            if not panel.get('printedLabel'):
                write(page, x, y + 11, panel.get('label', LETTERS[i]), 12, bold=True)
            rect = fitz.Rect(x, y + 19, x + panel_width, y + 139)
            draw_panel(page, rect, figure_source(edition['year'], panel))

    if any(panel.get('replacement') for panel in panels):
        note = entry.get('replacementNote', 'Есть редакционная замена. Источники приведены в конце PDF.')
        write(page, MARGIN, 568, note, 10, color=MUTED)
    page.draw_line((MARGIN, 576), (WIDTH - MARGIN, 576), color=LINE, width=0.7)
    label = f'Вернуться к странице {source_index + 1}'
    right = MARGIN + write(page, MARGIN, 599, label, 12, color=BLUE)
    goto(page, fitz.Rect(MARGIN, 585, right + 3, 604), reader[source_index])
    return supplement_index


def add_sources(reader, edition):
    page = reader.new_page(width=WIDTH, height=HEIGHT)
    first = page.number
    write(page, MARGIN, 40, 'Источники иллюстраций', 24, bold=True)
    write(page, MARGIN, 59, edition['label'], 13, color=MUTED)
    y = 89
    for entry in edition['entries']:
        sources = dict.fromkeys(tuple(panel['credit'].items()) for panel in entry['panels'])
        for source_index, raw_source in enumerate(sources, 1):
            source = dict(raw_source)
            if y > HEIGHT - 100:
                page = reader.new_page(width=WIDTH, height=HEIGHT)
                write(page, MARGIN, 40, 'Источники иллюстраций', 24, bold=True)
                y = 72
            label = f'№ {entry["number"]} · Источник {source_index}'
            right = MARGIN + write(page, MARGIN, y, label, 12, bold=True, color=BLUE)
            page.insert_link({
                'kind': fitz.LINK_URI, 'from': fitz.Rect(MARGIN, y - 13, right + 3, y + 3),
                'uri': source['source'],
            })
            write(page, MARGIN, y + 17, source['author'], 10)
            license_url = source.get('licenseUrl')
            right = MARGIN + write(page, MARGIN, y + 32, source['license'], 10,
                                   color=BLUE if license_url else INK)
            if license_url:
                page.insert_link({
                    'kind': fitz.LINK_URI,
                    'from': fitz.Rect(MARGIN, y + 20, right + 3, y + 35),
                    'uri': license_url,
                })
            write(page, MARGIN, y + 47, source['processing'], 10)
            y += 67
    return first


def add_note(page, target):
    """Set the printed route in a clear outer margin of the source page."""
    label = 'Крупные иллюстрации'
    size = 9
    width = REGULAR.text_length(label, fontsize=size) + 4
    for y in (14, page.rect.height - 5):
        for x in (18, page.rect.width - width - 18):
            rect = fitz.Rect(x - 2, y - size - 1, x + width + 2, y + 3)
            pixels = page.get_pixmap(clip=rect, colorspace=fitz.csGRAY, alpha=False).samples
            if pixels and min(pixels) >= 242:
                write(page, x, y, label, size, color=BLUE)
                goto(page, rect, target)
                return


def build(edition):
    original = ASSETS / edition['original']
    output = original.with_stem(original.stem + '-reading')
    with fitz.open(original) as reader:
        count = len(reader)
        outline = [[1, 'Страницы буклета', 1]]
        links = {}
        for entry in edition['entries']:
            source_index = entry['page'] - 1
            if not 0 <= source_index < count:
                raise ValueError(f'Unexpected page for {original}: {entry["page"]}')
            supplement_index = plate(reader, edition, entry, source_index)
            link = fitz.Rect(entry['box'])
            if link.is_empty or not reader[source_index].rect.contains(link):
                raise ValueError(f'Invalid figure box in {original}: {link}')
            goto(reader[source_index], link, reader[supplement_index])
            links.setdefault(source_index, supplement_index)
            outline.append([1, entry.get('heading', f'Задание № {entry["number"]}'),
                            supplement_index + 1])
        for page_index, first_plate in links.items():
            add_note(reader[page_index], reader[first_plate])
        sources = add_sources(reader, edition)
        outline.append([1, 'Источники иллюстраций', sources + 1])
        reader.set_toc(outline)
        reader.del_xml_metadata()
        reader.set_metadata({
            'title': f'ЧИП · {edition["label"]} · PDF для чтения',
            'subject': 'Буклет с отдельными страницами крупных иллюстраций',
            'creator': 'Olympiads.pro',
        })
        # The organizer reused indexed image streams with different palettes.
        # Keep their resource objects separate in the reading copies.
        with TemporaryDirectory(prefix='.reading-', dir=output.parent) as folder:
            staged = Path(folder) / output.name
            reader.save(staged, garbage=0, deflate=True, no_new_id=True)
            staged.replace(output)


if __name__ == '__main__':
    for path in sorted(MANIFEST.glob('*/reading-figures.json')):
        for item in json.loads(path.read_text(encoding='utf-8')):
            build(item)
