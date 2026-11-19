"""Extract only the figures used by the Russian-language lessons from official local PDFs."""
import io
import json
from pathlib import Path

import fitz
from PIL import Image, ImageChops, ImageOps

from pdf_figure import cropped_svg

ROOT = Path(__file__).resolve().parents[1]
# Page numbers are zero-based. The split rectangles are percentages of the original rebus panel.
# Each rectangle excludes the printed answer letter and the decoded words underneath the panel.
PANELS = [
    (2005, '2-3', 17, 2, 86, [(6,0,33,42),(43,0,65,42),(75,0,100,42),(14,44,44,100),(56,44,100,100)]),
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
    (2004,'2-3',20,2,531,
     '1. Бант с запятой перед ним, слон с двумя запятыми перед ним. '
     '2. Нота ми и шар с запятой после него. '
     '3. Внутри О лодка с двумя запятыми после неё, рядом Я. '
     '4. Маленькая а над Т, лилия с двумя запятыми перед ней. '
     '5. Юла с заменой Л на Р. '
     '6. Нота фа, шина с запятой перед ней.'),
    (2004,'4-5',10,1,218,
     '1. Две ели, буква Е за В, затем таз с запятой после него. '
     '2. Гриб и гора с запятой после каждого, кий с запятой перед ним. '
     '3. Дом с зачёркнутой о, затем буква и и цифра 3 с й. '
     '4. Нота соль с запятой перед ней, нога с двумя запятыми перед ней. '
     '5. Мак, нота си и буква м. '
     '6. Ж над Е, цифра 2 с зачёркнутой в над ней.'),
    (2016,'2-3',24,1,446,
     'Сверху прямоугольник с горизонталью, вертикалью и двумя диагоналями через центр. '
     'Под ним четыре рисунка. '
     'На первом три горизонтали, средняя вертикаль и линии от центра к нижним углам. '
     'На втором средняя горизонталь, средняя вертикаль и обе диагонали. '
     'На третьем средняя горизонталь, средняя и правая вертикали и обе диагонали. '
     'На четвёртом средняя и нижняя горизонтали, обе боковые вертикали и обе диагонали.'),
    (2022,'4-5',2,0,301,'Силуэт собаки в красном перечёркнутом круге.'),
    (2023,'2-3',7,1,64,'Над ртом зачёркнута Т, над почтовой маркой указана замена Р на Ш.'),
    (2023,'4-5',1,0,249,'Белый треугольник с красной каймой и чёрной буквой У.'),
    (2024,'4-5',21,2,562,'Красная К над синей А, внутри которой маленькая О.'),
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


def main():
    art = {}
    def destination(year, grade, number):
        folder = ROOT / f'dist/assets/medvezhonok/{year}'
        return folder, f'{grade}-{number}', art.setdefault(str(year),{}).setdefault(f'{grade}/{number}',{})
    for (year,grade,number,pn,panel,regions), descriptions in zip(PANELS,DESCRIPTIONS,strict=True):
        doc,page = open_page(year,grade,pn)
        folder,stem,record = destination(year,grade,number)
        options = []
        if isinstance(panel,int):
            image = embedded(doc,page,panel)
            width,height = image.size
        else:
            rect = fitz.Rect(panel)
        for i,((x,y,right,bottom),description) in enumerate(zip(regions,descriptions,strict=True)):
            name = f'{stem}-{i+1}'
            if isinstance(panel,int):
                box = (int(width*x/100),int(height*y/100),round(width*right/100),round(height*bottom/100))
                file = raster_asset(image.crop(box),folder,name)
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
    for year,grade,number,pn,top,alt in SINGLE:
        doc,page=open_page(year,grade,pn)
        folder,stem,record=destination(year,grade,number)
        record['condition']={**raster_asset(embedded(doc,page,top),folder,stem),'alt':alt}
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
                figure['items'].append({'src':item['src'], 'caption':caption, 'alt':description})
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


if __name__=='__main__':
    main()
