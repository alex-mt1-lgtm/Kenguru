"""Generate separate Golden Fleece booklets with restored contest illustrations."""
from collections import Counter, defaultdict
from io import BytesIO
import json
from pathlib import Path

import fitz
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources/golden-fleece'
ASSETS = ROOT / 'dist/assets/golden-fleece'
INK = (0.09, 0.19, 0.22)
TEAL = (0.02, 0.35, 0.32)
GRAY = (0.35, 0.40, 0.42)
REGULAR = fitz.Font('helv')
BOLD = fitz.Font('hebo')


def matching_image(page, rect, size):
    unrotated = fitz.Rect(rect) * page.derotation_matrix
    matches = [image for image in page.get_image_info(xrefs=True)
               if (image['width'], image['height']) == tuple(size)
               and all(abs(a - b) < 0.05 for a, b in zip(image['bbox'], unrotated))]
    if len(matches) != 1 or not matches[0]['xref']:
        raise ValueError(f'Cannot locate {size} image at {rect} on page {page.number + 1}')
    return matches[0]


def load_master(spec):
    if 'pdf' not in spec:
        with Image.open(SOURCES / 'reading-art' / spec['file']) as image:
            return ImageOps.exif_transpose(image).convert('RGB')
    with fitz.open(ASSETS / spec['pdf']) as pdf:
        page = pdf[spec['page'] - 1]
        info = matching_image(page, spec['rect'], spec['size'])
        image = fitz.Pixmap(pdf, info['xref'])
        if image.colorspace != fitz.csRGB:
            image = fitz.Pixmap(fitz.csRGB, image)
        return Image.frombytes('RGB', (image.width, image.height), image.samples)


def image_bytes(image):
    stream = BytesIO()
    image.save(stream, format='JPEG', quality=94, subsampling=0, optimize=True)
    return stream.getvalue()


def crop_master(image, spec):
    if 'crop' in spec:
        image = image.crop(spec['crop'])
    return image


def link_text(page, point, label, size, page_index, to=None):
    x, y = point
    page.insert_text(point, label, fontname='ReviewRegular', fontsize=size, color=TEAL)
    width = REGULAR.text_length(label, fontsize=size)
    page.draw_line((x, y + 2), (x + width, y + 2), color=TEAL, width=0.5)
    page.insert_link({'from': fitz.Rect(x, y - size, x + width, y + 4),
                      'kind': fitz.LINK_GOTO, 'page': page_index,
                      'to': to if to is not None else fitz.Point(0, 0)})


def add_illustration_page(document, title, question, targets, image, source, number):
    max_width, max_height = 523, 661
    detail = load_master({'file': source['detailFile']}) if 'detailFile' in source else None
    landscape = image.width > image.height * 1.45 or detail is not None
    if landscape:
        max_width, max_height = 752, 411
    page = document.new_page(width=max_width + 72, height=max_height + 181)
    page.insert_font(fontname='ReviewRegular', fontbuffer=REGULAR.buffer)
    page.insert_font(fontname='ReviewBold', fontbuffer=BOLD.buffer)
    page.insert_text((36, 42), title, fontname='ReviewRegular', fontsize=13, color=GRAY)
    page.insert_text((36, 80), f'Иллюстрация к заданию № {question}',
                     fontname='ReviewBold', fontsize=24, color=INK)
    if source.get('substitute'):
        page.insert_text((36, 101), source.get('substituteLabel', 'Тот же объект, другой снимок.'),
                         fontname='ReviewRegular', fontsize=11, color=GRAY)
    bottom = page.rect.height - 65
    if detail is None:
        page.insert_image(fitz.Rect(36, 116, page.rect.width - 36, bottom),
                          stream=image_bytes(image), keep_proportion=True)
    else:
        note = source.get('detailNote', ())
        page.insert_image(fitz.Rect(36, 136, 385, bottom), stream=image_bytes(image))
        page.insert_text((420, 127), source['detailLabel'], fontname='ReviewRegular', fontsize=12, color=GRAY)
        page.insert_image(fitz.Rect(420, 136, page.rect.width - 36, bottom - 16 * len(note)),
                          stream=image_bytes(detail))
        for i, line in enumerate(note):
            y = bottom - 16 * (len(note) - i - 1)
            page.insert_text((420, y), line, fontname='ReviewRegular', fontsize=11, color=GRAY)
    first = targets[0]
    rect = fitz.Rect(first['rect'])
    original_index = first['page'] - 1
    position = fitz.Point(max(0, rect.x0 - 110), max(0, rect.y0 - 20))
    link_text(page, (36, page.rect.height - 28), 'Вернуться к заданию', 12,
              original_index, position * document[original_index].derotation_matrix)
    page.insert_text((page.rect.width - 51, page.rect.height - 28), f'{number + 1}',
                     fontname='ReviewRegular', fontsize=11, color=GRAY)
    return page.number


def replace_images(document, targets):
    replacements = []
    pages = {target['page'] - 1 for target, _, _ in targets}
    references = Counter(info['xref'] for page in document for info in page.get_image_info(xrefs=True))
    for index in pages:
        page = document[index]
        for target, source, image in targets:
            if target['page'] - 1 != index or target.get('appendixOnly'):
                continue
            info = matching_image(page, target['rect'], target['size'])
            if references[info['xref']] != 1:
                raise ValueError(f'Image {info["xref"]} has other references, use an appendix')
            if source.get('substitute') and 'crop' not in target:
                raise ValueError('A substitute placed on the task page needs an explicit crop')
            updated = crop_master(image, target)
            if updated.width * updated.height <= info['width'] * info['height']:
                raise ValueError(f'Replacement did not improve native size for task {target["task"]}')
            replacements.append((index, info['xref'], updated))
    for index, xref, image in replacements:
        document[index].replace_image(xref, stream=image_bytes(image))


def build_booklet(path, targets):
    original_path = ASSETS / path
    output = original_path.with_name(f'{original_path.stem}-reading.pdf')
    with fitz.open(original_path) as document:
        count_original = len(document)
        replace_images(document, targets)
        appendices = defaultdict(list)
        for target, source, image in targets:
            if source.get('appendix'):
                appendices[target['task'], source['id']].append((target, source, image))
        original_toc = document.get_toc()
        toc = original_toc or [[1, 'Буклет', 1]]
        links = []
        for (task, _), items in sorted(appendices.items(), key=lambda item: int(item[0][0].split('/')[-1])):
            first, source, image = items[0]
            year, grade, question = task.split('/')
            grade = grade.split('-v', 1)[0].replace('-', '–')
            title = f'Золотое руно · {year} · {grade} классы'
            page_index = add_illustration_page(document, title, question, [t for t, _, _ in items], image, source,
                                               len(document))
            toc.append([1, f'Иллюстрация к заданию № {question}', page_index + 1])
            for target, _, _ in items:
                rect = fitz.Rect(target['rect'])
                links.append((target['page'] - 1, rect, page_index))
        for index, rect, page_index in links:
            page = document[index]
            rect *= page.derotation_matrix
            page.insert_link({'from': rect, 'kind': fitz.LINK_GOTO, 'page': page_index,
                              'to': fitz.Point(0, 0)})
        if appendices or original_toc:
            document.set_toc(toc)
        document.del_xml_metadata()
        document.set_metadata({'title': f'Золотое руно {path.parts[0]} — версия для чтения',
                               'subject': 'Редакционная копия буклета «Золотое руно»'})
        if len(document) < count_original:
            raise ValueError(f'Original booklet pages lost: {path}')
        output.write_bytes(document.tobytes(garbage=4, deflate=True, no_new_id=True))
    return output


def build():
    records = json.loads((SOURCES / 'reading-pdfs.json').read_text(encoding='utf-8'))
    books = defaultdict(list)
    for source in records:
        image = crop_master(load_master(source), source)
        for target in source['targets']:
            books[Path(target['pdf'])].append((target, source, image))
    for path, targets in sorted(books.items()):
        build_booklet(path, targets)


if __name__ == '__main__':
    build()
