"""Build figures and reading copies from official Russian Bear PDFs and checked artwork."""
import io
import json
import subprocess
from pathlib import Path

import fitz
from PIL import Image, ImageChops, ImageOps

from pdf_figure import cropped_svg

ROOT = Path(__file__).resolve().parents[1]
# Page numbers are zero-based. The split rectangles are percentages of the original rebus panel.
# Each rectangle excludes the printed answer letter and the decoded words underneath the panel.
PANELS = [
    (2005, '2-3', 17, 2, 86, [(6,0,33,42),(43,0,65,42),(75,0,100,42),(14,42,44,100),(56,44,100,100)]),
    (2005, '4-5', 20, 2, 415, [(8,0,38,46),(43,0,62,46),(68,0,100,46),(20,46,49,100),(58,46,83,100)]),
    (2006, '2-3', 11, 1, [60,330,540,438], [(2.6,0,26,48),(29.4,0,59,50),(62.8,0,99,43),(15.5,50,48,100),(59,43,86,100)]),
    (2006, '4-5', 10, 1, [60,156,530,303], [(3.1,0,31.3,49),(36.4,0,66.3,47),(71.8,0,100,47),(23,50,52,100),(60.5,50,98,100)]),
    (2008, '2-3', 11, 1, 373, [(7.4,0,29,48),(37,0,67,53),(77,0,100,53),(19,59,42,100),(55,55,87,100)]),
    (2008, '4-5', 8, 1, 91, [(10,0,32,48),(47,0,66,48),(79,0,99,48),(24.5,51,42,100),(58,50,98,100)]),
    (2009, '2-3', 13, 1, 515, [(7,0,29,46),(36,0,60,44),(70,0,99,46),(21,48,56,100),(62.6,46,77,100)]),
    (2010, '2-3', 11, 1, 309, [(8,0,33,49),(39,0,68,49),(75,0,100,49),(30,55,51,100),(60.5,55,83,100)]),
    (2010, '4-5', 8, 1, 49, [(8.5,0,29,47),(39,0,58,47),(69.7,0,100,42),(28.3,48,40,100),(52.3,42,83,100)]),
]
# The descriptions name what is visible on the button, without decoding the puzzle.
DESCRIPTIONS = [
    [
        'Число 100 и буква Л',
        'Единица между запятыми, затем Н внутри А',
        'Буквы Т и У протягивают друг к другу руки, затем Л',
        'Маленькие буквы Т на большой Р, затем ф и ель',
        'Буква К, нота ре и слон с запятой после него',
    ],
    [
        'Маленькие е на большой Н, затем д, ель и веник с двумя запятыми перед ним',
        'Маленькая а под верхней чертой Г, затем запятая и куст',
        'Буква с внутри О, кресло с двумя запятыми после него, пень с запятой перед ним и буква е',
        'Сук с зачёркнутой у, о внутри О, роза с заменой з на д',
        'Фен с запятой после него, а внутри Р, ель с запятой перед ней',
    ],
    [
        'Буква М, карты с запятой перед ними, шкаф с запятой после него',
        'Буквы Е и Н с руками и ногами стоят рядом. После гуся и после кисти руки по две запятые',
        'Меч и цифра 2, после каждого запятая. Над ежом зачёркнуты две точки, над окном цифры 1, 3, 4, 2',
        'Маленькие о на большой Р, Ё и Н рядом, затем запятая перед перевёрнутым котом',
        'Буквы КА над Р, затем лейка с запятой перед ней',
    ],
    [
        'Мост с запятой после него и К внутри А',
        'Кит с заменой Т на Р, затем ковш с запятыми по обе стороны',
        'Л внутри О, над горой буква Г между цифрами 2 и 3, затем Д',
        'Муха с двумя запятыми после неё, рама с зачёркнутой цифрой 2, носки с зачёркнутой О и запятой после них',
        'Буква У, кран с запятой после него, шина с запятой перед ней',
    ],
    [
        'Жаба с заменой Ж на К, затем очки с запятой перед ними',
        'Мак, арка с двумя запятыми после неё, конь с запятой с каждой стороны и буква ы',
        'Маленькая р внутри е, нота ми, буква ш и ель',
        'Лапы с двумя запятыми перед ними, лес и оса с запятой после неё',
        'Кот, лев с запятой после него и таз с запятой после него',
    ],
    [
        'Н перед А, маленькая с внутри е',
        'Буквы ЗА над В, затем запятая и лес',
        'Ваза с двумя запятыми перед ней, затем буквы ес над В',
        'Е за В, затем оса с запятой перед ней',
        'Зонт с заменой О на А и запятой после него, А внутри е, затем нота си с запятой после неё',
    ],
    [
        'Маленькая с внутри е, затем луна с двумя запятыми перед ней',
        'Рама с двумя запятыми перед ней, затем рот с зачёркнутой буквой о',
        'Лес с запятой после него, число 100 с запятой перед ним',
        'Нос и пень, перед каждым рисунком запятая',
        'Открытый замок с двумя запятыми после него, под ним запись 1И32',
    ],
    [
        'Шина с заменой Ш на Л и запятой после неё, лейка с запятой перед ней',
        'Игральная карта с двумя запятыми после неё, бант с запятой с каждой стороны и душ с заменой У на А',
        'Число 100 с запятой перед ним, затем вилка с заменой В на Ч',
        'Руль с двумя запятыми после него, бочка с двумя запятыми перед ней',
        'Маленькие Т на большой Р, затем ф и ель',
    ],
    [
        'Единица между запятыми, затем Н внутри А',
        'Число 100 и буква л',
        'Буква К, нота ре и слон с запятой после него',
        'Маленькие слоги Ка на большой букве Л',
        'Маленькая а внутри Т, затем о и бусы с запятой после них',
    ],
]
# For embedded originals identify each image by the vertical coordinate of its top edge.
SINGLE = [
    (2022,'4-5',2,0,301,'Силуэт собаки в красном перечёркнутом круге.'),
    (2023,'2-3',7,1,64,'Над ртом зачёркнута Т, над почтовой маркой указана замена Р на Ш.'),
    (2023,'4-5',1,0,249,'Белый треугольник с красной каймой и чёрной буквой У.'),
    (2024,'4-5',21,2,562,'Красная К над синей А, внутри которой маленькая О.'),
]
# Pixel coordinates in the 591-pixel-wide originals. The printed numbers become captions.
REBUSES = [
    ('2-3',20,2,531,[
        ((36,0,211,83), 'Бант с запятой перед ним, слон с двумя запятыми перед ним.'),
        ((252,0,398,83), 'Нота ми и воздушный шар с запятой после него.'),
        ((435,0,558,83), 'Внутри О лодка с двумя запятыми после неё, рядом Я.'),
        ((50,84,178,175), 'Маленькая а над Т, лилия с двумя запятыми перед ней.'),
        ((251,84,380,175), 'Юла с заменой Л на Р.'),
        ((420,84,569,175), 'Нота фа, шина с запятой перед ней.'),
    ]),
    ('4-5',10,1,218,[
        ((14,0,192,57), 'Две ели, буква Е за В, затем таз с запятой после него.'),
        ((211,0,411,57), 'Гриб и гора с запятой после каждого, кий с запятой перед ним.'),
        ((424,0,591,57), 'Дом с зачёркнутой о, затем буква и, цифра 3 и буква й.'),
        ((84,57,177,118), 'Запятая перед нотным станом с нотой соль. Две запятые перед рисунком ноги.'),
        ((216,57,306,118), 'Цветок мака, нота си на нотном стане и прописная М.'),
        ((324,57,410,118), 'Слева Ж над Е. Справа строчная в, перечёркнутая крестом, над цифрой 2.'),
    ]),
]
# Hand-drawn vector masters, checked against the corresponding regions of the 2004 booklet.
REBUS_VECTORS = {'2-3': {2: {}, 3: {}, 4: {}, 6: {}}, '4-5': {
    1: {}, 2: {}, 3: {}, 4: {}, 5: {},
    # On first magnification show the crossed-out letter above the 2.
    6: {'zoomCenter': {'x': 0.79, 'y': 0.20}},
}}
# Task sheet pages containing the corresponding image; answer sheet pages are in REBUSES and PANELS.
REBUS_TASK_PAGES = {(2004, '2-3'): 2, (2004, '4-5'): 0, (2005, '2-3'): 1, (2005, '4-5'): 1}
OPTION_VECTORS = {
    (2005, '2-3', 17): {4, 5},
    (2005, '4-5', 20): {4},
}
# Coordinates in points on page 2 of the 2008 booklet after normalizing its rotation.
ORIGINAL_2008_PANEL = (37, 259, 362, 310)
ORIGINAL_2008_OPTIONS = {1: (61, 261, 129, 285), 4: (98, 288, 172, 309)}
# The horse from variant Б extends over the top right corner of the crop for Г.
ORIGINAL_2008_MASKS = {4: [(161, 288, 172, 291)]}
# Traced from the 1023 × 230 embedded diagram on page 2 of the 2016 answers PDF.
# The five paths use the original coordinates so the key and the signs keep the same proportions.
CIPHER = [
    ((10,0,311,105), 'M68 11H286V92H68ZM68 52H286M176 11V92M68 11L286 92M68 92L286 11',
     'Ключ', 'Рамка со средней горизонталью, средней вертикалью и обеими диагоналями.'),
    ((7,114,244,212), 'M16 122H235M16 163H234M16 203H234M125 122V203M16 203L125 163 234 203',
     'Знак 1', 'Три горизонтали, средняя вертикаль и линии от центра к нижним углам.'),
    ((269,114,508,212), 'M278 163H498M388 123V203M278 122L498 203M278 203L498 122',
     'Знак 2', 'Средняя горизонталь, средняя вертикаль и обе диагонали.'),
    ((530,114,768,214), 'M539 165H758M648 124V206M758 124V206M539 124L758 206M539 206L758 124',
     'Знак 3', 'Средняя горизонталь, средняя и правая вертикали и обе диагонали.'),
    ((776,114,1014,214), 'M786 165H1004M786 206H1004M786 124V206M1004 124V206M786 124L1004 206M786 206L1004 124',
     'Знак 4', 'Средняя и нижняя горизонтали, обе боковые вертикали и обе диагонали.'),
]
# Display-coordinate rectangles in PDF points. Preserve text, glyph outlines and complete images.
GROUPS = [
    (2013,'4-5',24,3,(440,46,549,116),'Кроссворд. Слово 1 по горизонтали: Б, пустая клетка, К. Слово 2 по вертикали: Л, та же пустая клетка, К.'),
    (2019,'4-5',3,0,(115,402,436,505),'На одной картинке кабинет с партами, на другой несколько рук с поднятыми большими пальцами.'),
    (2024,'2-3',28,3,(55,570,457,670),'Валентина нарисовала неваляшку, Ирина — жирафа, Зинаида — корзину.'),
]
CONDITION_ITEMS = [
    (123,584,'Валентина','Неваляшка'),
    (256,571,'Ирина','Жираф'),
    (390,574,'Зинаида','Корзина'),
]
CHOICES = [
    (2024,'2-3',28,3,[(105,712),(200,700),(291,708),(389,712),(461,718)],['Детская коляска','Лев','Изба','Матрёшка','Ранец']),
    (2024,'4-5',5,0,[(147,506),(313,500),(448,504),(210,555),(386,555)],['Клюква','Клубника','Крыжовник','Чёрная смородина','Морошка']),
]


def open_page(year, grade, page):
    document = fitz.open(ROOT / f'sources/medvezhonok/{year}/{grade}-answers.pdf')
    if document[page].rotation:
        document[page].remove_rotation()
    return document, document[page]


def embedded(doc, page, top, left=None):
    candidates = [i for i in page.get_image_info(xrefs=True) if abs(i['bbox'][1]-top)<2 and (left is None or abs(i['bbox'][0]-left)<2)]
    assert len(candidates)==1, (page.number, top, left)
    item = candidates[0]
    original = doc.extract_image(item['xref'])
    image = Image.open(io.BytesIO(original['image'])).convert('RGB')
    if original.get('smask'):
        alpha = Image.open(io.BytesIO(doc.extract_image(original['smask'])['image'])).convert('L')
        image = Image.composite(image, Image.new('RGB', image.size, 'white'), alpha)
    return image


def raster_asset(image, folder, stem):
    box = ImageChops.difference(image, Image.new('RGB', image.size, 'white')).convert('L').point(lambda p: 255 if p>32 else 0).getbbox()
    assert box
    image = ImageOps.expand(image.crop(box), 4, fill='white')
    output = folder / (stem+'.webp')
    image.save(output, lossless=True)
    return {'src':output.relative_to(ROOT/'dist').as_posix(), 'width':image.width, 'height':image.height, 'pixelWidth':image.width, 'pixelHeight':image.height}


def vector_master(folder, stem):
    source = folder / f'{stem}.svg'
    with fitz.open(source) as svg:
        size = svg[0].rect
    return {'src': source.relative_to(ROOT / 'dist').as_posix(),
            'width': round(size.width), 'height': round(size.height)}


def svg_asset(doc, page, rectangle, folder, stem, masks=()):
    rect = fitz.Rect(rectangle)
    output = folder / (stem+'.svg')
    svg = cropped_svg(doc, page.number, rect)
    # Adjacent letters in the printed panel sometimes overlap the bounding rectangle.
    for x0,y0,x1,y1 in masks:
        cover = f'<rect x="{x0-rect.x0}" y="{y0-rect.y0}" width="{x1-x0}" height="{y1-y0}" fill="white"/>'
        svg = svg.replace('</svg>',cover+'</svg>')
    output.write_text(svg)
    return {'src':output.relative_to(ROOT/'dist').as_posix(), 'width':round(rect.width*2), 'height':round(rect.height*2)}


def cipher_asset(folder, stem, bounds, paths):
    x0, y0, x1, y1 = bounds
    width, height = x1 - x0, y1 - y0
    output = folder / (stem + '.svg')
    drawing = ''.join(f'<path d="{path}"/>' for path in paths)
    output.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {width} {height}" width="{width}" height="{height}">'
        f'<rect x="{x0}" y="{y0}" width="{width}" height="{height}" fill="white"/>'
        f'<g fill="none" stroke="black" stroke-width="2.5" stroke-linejoin="round">{drawing}</g></svg>\n'
    )
    return {'src':output.relative_to(ROOT/'dist').as_posix(), 'width':width, 'height':height}


def paint_figure(page, bounds, item):
    artwork = ROOT / 'dist' / item['src']
    if artwork.suffix == '.svg':
        with fitz.open(artwork) as svg, fitz.open('pdf', svg.convert_to_pdf()) as vector:
            page.show_pdf_page(bounds, vector, 0)
    else:
        with Image.open(artwork) as image:
            buffer = io.BytesIO()
            image.save(buffer, format='PNG')
            page.insert_image(bounds, stream=buffer.getvalue())


def patch_raster_panel(original, rectangles, items, indices):
    """Keep the printed labels and untouched figures in the panel at their original coordinates."""
    panel = fitz.open()
    page = panel.new_page(width=original.width, height=original.height)
    background = original.copy()
    for index in indices:
        background.paste('white', rectangles[index - 1])
    buffer = io.BytesIO()
    background.save(buffer, format='PNG')
    page.insert_image(page.rect, stream=buffer.getvalue())
    for index in indices:
        paint_figure(page, fitz.Rect(rectangles[index - 1]), items[index - 1])
    return panel


def rebus_reader(year, grade, number, items, source_suffix, page_number, panel, clip=None, note=''):
    filename = f'{grade}{source_suffix}'
    source = ROOT / f'sources/medvezhonok/{year}/{filename}.pdf'
    output = ROOT / f'dist/assets/medvezhonok/{year}/{filename}-reading.pdf'
    font_file = subprocess.check_output(['fc-match', '-f', '%{file}', 'DejaVu Sans'], text=True)
    font = 'DejaVu'
    with fitz.open(source) as booklet:
        source_page = booklet[page_number]
        original, = source_page.get_image_info()
        panel_bounds = fitz.Rect(original['bbox'])
        source_page.add_redact_annot(panel_bounds, fill=False, cross_out=False)
        source_page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE,
                                     graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                                     text=fitz.PDF_REDACT_TEXT_NONE)
        source_page.show_pdf_page(panel_bounds, panel, 0, keep_proportion=clip is not None, clip=clip)

        appendix_number = len(booklet)
        page = booklet.new_page(width=595.28, height=841.89)
        page.insert_font(fontname=font, fontfile=font_file)
        label = f'Ребусы к заданию № {number}'
        page.insert_text((36,53), label, fontname=font, fontsize=23)
        page.insert_text((36,76), f'Русский медвежонок · {year} · {grade.replace("-", "–")} классы',
                         fontname=font, fontsize=11)
        for index, item in enumerate(items):
            left = 36 + (index % 2) * 270
            top = 109 + (index // 2) * 214
            page.draw_line((left,top),(left+253,top),color=(0.65,0.65,0.65),width=0.5)
            page.insert_text((left,top+21), item['caption'], fontname=font, fontsize=12)
            paint_figure(page, fitz.Rect(left,top+35,left+253,top+152), item)
            remaining = page.insert_textbox((left,top+160,left+253,top+207),item['alt'],
                                            fontname=font,fontsize=11)
            if remaining < 0:
                raise ValueError(f'Caption for {year}, {grade}, № {number}, panel {index + 1} does not fit')
        if note:
            page.insert_text((36,790), note, fontname=font, fontsize=9)
        source_page = booklet[page_number]
        link_area = fitz.Rect(panel_bounds.x1 + 5, panel_bounds.y0 + 2,
                              source_page.rect.x1 - 5, panel_bounds.y0 + 27)
        text = source_page.insert_textbox(link_area, 'Крупные\nребусы →', fontname=font,
                                          fontfile=font_file, fontsize=8, color=(0.08, 0.28, 0.53))
        if text < 0:
            raise ValueError(f'Link to rebuses for {year}, {grade}, № {number} does not fit')
        source_page.insert_link({'kind': fitz.LINK_GOTO, 'from': link_area, 'page': appendix_number})
        booklet.set_toc([[1, label, appendix_number + 1]])
        booklet.subset_fonts()
        output.write_bytes(booklet.tobytes(garbage=4, deflate=True, no_new_id=True))


def build_raster_readers(year, grade, number, items, page_number, original, rectangles, indices):
    rebuilt = None
    restored = ', '.join(items[i - 1]['caption'].split()[-1] for i in indices)
    note = f'Векторная перерисовка по архивному буклету. Исправленные рисунки: {restored}.'
    with patch_raster_panel(original, rectangles, items, indices) as panel:
        rebus_reader(year, grade, number, items, '-answers', page_number, panel, note=note)
    task_page = REBUS_TASK_PAGES[year, grade]
    with fitz.open(ROOT / f'sources/medvezhonok/{year}/{grade}.pdf') as tasks:
        placed, = tasks[task_page].get_image_info()
        original = embedded(tasks, tasks[task_page], placed['bbox'][1])
        with patch_raster_panel(original, rectangles, items, indices) as panel:
            rebus_reader(year, grade, number, items, '', task_page, panel, note=note)
            if year == 2004:
                stem = f'{grade}-{number}'
                folder = ROOT / f'dist/assets/medvezhonok/{year}'
                (folder / f'{stem}.svg').write_text(panel[0].get_svg_image())
                rebuilt = vector_master(folder, stem)
    return rebuilt


def main():
    art = {}
    def destination(year, grade, number):
        folder = ROOT / f'dist/assets/medvezhonok/{year}'
        return folder, f'{grade}-{number}', art.setdefault(str(year),{}).setdefault(f'{grade}/{number}',{})
    for (year,grade,number,pn,panel,regions), descriptions in zip(PANELS,DESCRIPTIONS,strict=True):
        doc,page = open_page(year,grade,pn)
        folder,stem,record = destination(year,grade,number)
        options = []
        panel_indices = OPTION_VECTORS.get((year, grade, number), ())
        if isinstance(panel,int):
            image = embedded(doc,page,panel)
            width,height = image.size
            rectangles = [(int(width*x/100),int(height*y/100),round(width*right/100),round(height*bottom/100))
                          for x,y,right,bottom in regions]
        else:
            rect = fitz.Rect(panel)
        for i,((x,y,right,bottom),description) in enumerate(zip(regions,descriptions,strict=True)):
            name = f'{stem}-{i+1}'
            if i + 1 in panel_indices:
                file = vector_master(folder, name)
            elif (year, grade, number) == (2008, '2-3', 11) and i + 1 in ORIGINAL_2008_OPTIONS:
                with fitz.open(ROOT / 'sources/medvezhonok/2008/2-3.pdf') as tasks:
                    file = svg_asset(tasks, tasks[1], ORIGINAL_2008_OPTIONS[i + 1], folder, name,
                                     ORIGINAL_2008_MASKS.get(i + 1, ()))
            elif isinstance(panel,int):
                file = raster_asset(image.crop(rectangles[i]),folder,name)
            else:
                box = [rect.x0+rect.width*x/100, rect.y0+rect.height*y/100, rect.x0+rect.width*right/100, rect.y0+rect.height*bottom/100]
                masks = ()
                if grade=='2-3':
                    if i==1:
                        box[1]=325
                        masks=[(box[0],325,218,327)]
                    elif i==2:
                        box=[360,327,516,379.5]
                        masks=[(360,327,366,356), (360,374,384,380)]
                    elif i==3:
                        box[1]=381
                    elif i==4:
                        box[1]=374
                else:
                    if i==0:
                        masks=[(60,156,80,204)]
                        box[0]=72
                        box[3]=233
                    elif i==2:
                        box[1]=153
                    elif i==3:
                        box[1]=234
                file = svg_asset(doc,page,box,folder,name,masks)
            options.append({**file,'description':description})
        record.update(options=options,onlyPictures=True)
        if panel_indices or (year, grade, number) == (2008, '2-3', 11):
            items = [{**option, 'caption': f'Вариант {letter}', 'alt': option['description'] + '.'}
                     for option, letter in zip(options, 'АБВГД', strict=True)]
            if panel_indices:
                build_raster_readers(year, grade, number, items, pn, image, rectangles, sorted(panel_indices))
            else:
                with fitz.open(ROOT / 'sources/medvezhonok/2008/2-3.pdf') as original, fitz.open() as panel_doc:
                    panel_doc.insert_pdf(original, from_page=1, to_page=1)
                    panel_doc[0].remove_rotation()
                    rebus_reader(year, grade, number, items, '-answers', pn, panel_doc,
                                 clip=fitz.Rect(ORIGINAL_2008_PANEL),
                                 note='Полоса на странице ответов восстановлена по векторному бланку заданий.')
    for year,grade,number,pn,top,alt in SINGLE:
        doc,page=open_page(year,grade,pn)
        folder,stem,record=destination(year,grade,number)
        record['condition']={**raster_asset(embedded(doc,page,top),folder,stem),'alt':alt}
    for grade,number,pn,top,regions in REBUSES:
        doc,page=open_page(2004,grade,pn)
        folder,stem,record=destination(2004,grade,number)
        original = embedded(doc,page,top)
        items = []
        for i, (box, description) in enumerate(regions, 1):
            name = f'{stem}-condition-{i}'
            if i in REBUS_VECTORS[grade]:
                file = {**vector_master(folder, name), **REBUS_VECTORS[grade][i]}
            else:
                file = raster_asset(original.crop(box), folder, name)
            items.append({**file, 'caption': f'Ребус {i}', 'alt': description})
        figure = build_raster_readers(2004, grade, number, items, pn, original,
                                     [box for box, _ in regions], REBUS_VECTORS[grade])
        figure['items'] = items
        figure['alt'] = ' '.join(f'{i}. {description}' for i,(_,description) in enumerate(regions, 1))
        record['condition']=figure
    folder,stem,record = destination(2016,'2-3',24)
    figure = cipher_asset(folder,stem,(8,4,1013,214),[path for _,path,_,_ in CIPHER])
    figure['alt'] = 'Сверху ключ. Под ним слева направо четыре знака. ' + ' '.join(
        f'{caption}. {description}' for _,_,caption,description in CIPHER
    )
    figure['detailItems'] = [
        {**cipher_asset(folder,f'{stem}-condition-{i}',bounds,[path]),'caption':caption,'alt':description}
        for i,(bounds,path,caption,description) in enumerate(CIPHER, 1)
    ]
    record['condition'] = figure
    for year,grade,number,pn,rect,alt in GROUPS:
        doc,page=open_page(year,grade,pn)
        folder,stem,record=destination(year,grade,number)
        if year==2024:
            # Some SVG viewers ignore the masks on the three original transparent images.
            pix = page.get_pixmap(matrix=fitz.Matrix(3,3), clip=fitz.Rect(rect), alpha=False)
            figure = raster_asset(Image.frombytes('RGB',(pix.width,pix.height),pix.samples),folder,stem)
            figure['items'] = []
            for i, (left, top, caption, description) in enumerate(CONDITION_ITEMS, 1):
                image = embedded(doc,page,top,left)
                item = raster_asset(image,folder,f'{stem}-condition-{i}')
                figure['items'].append({**item, 'caption':caption, 'alt':description})
        else:
            figure = svg_asset(doc,page,rect,folder,stem)
        record['condition']={**figure,'alt':alt}
    for year,grade,number,pn,positions,descriptions in CHOICES:
        doc,page=open_page(year,grade,pn)
        folder,stem,record=destination(year,grade,number)
        record['options']=[{**raster_asset(embedded(doc,page,y,x),folder,f'{stem}-{i+1}'),'description':description} for i,((x,y),description) in enumerate(zip(positions,descriptions,strict=True))]
        record['onlyPictures']=grade=='2-3'
    for year,figures in art.items():
        (ROOT/f'sources/medvezhonok/{year}/figures.json').write_text(json.dumps(figures,ensure_ascii=False,indent=2)+'\n')
    with fitz.open(ROOT / 'sources/medvezhonok/2025/2-3.pdf') as doc:
        svg_asset(doc,doc[1],(668,173,788,265),ROOT / 'dist/assets/medvezhonok/2025','2-3-20')


if __name__=='__main__':
    main()
