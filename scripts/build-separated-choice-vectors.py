"""Recreate the checked choice drawings from native paths in the official PDFs."""

from collections import defaultdict
import json
from pathlib import Path
from xml.etree import ElementTree

import fitz

from pdf_figure import cropped_svg


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'sources' / 'separated-choice-vectors.json'
SVG = 'http://www.w3.org/2000/svg'


def remove_print_marks(svg, clear_watermark, omit_glyphs, exclude_rects):
    """Omit the watermark or adjoining printed labels on checked crops."""
    for parent in svg.iter():
        for item in list(parent):
            glyph = item.get('data-text')
            if item.tag != f'{{{SVG}}}use' or glyph is None:
                continue
            watermark = (clear_watermark and item.get('fill') == '#ff5400'
                         and item.get('fill-opacity') == '.25')
            if watermark or glyph in omit_glyphs:
                parent.remove(item)
    if exclude_rects:
        _, _, width, height = map(float, svg.get('viewBox').split())
        outline = f'M0 0H{width}V{height}H0Z'
        for left, top, right, bottom in exclude_rects:
            if not (0 <= left < right <= width and 0 <= top < bottom <= height):
                raise ValueError(f'Invalid print mark rectangle {left, top, right, bottom}')
            outline += f' M{left} {top}H{right}V{bottom}H{left}Z'
        artwork = list(svg)
        defs = ElementTree.SubElement(svg, f'{{{SVG}}}defs')
        clip = ElementTree.SubElement(defs, f'{{{SVG}}}clipPath', {'id': 'exclude-print-marks'})
        ElementTree.SubElement(clip, f'{{{SVG}}}path', {'d': outline, 'clip-rule': 'evenodd'})
        group = ElementTree.SubElement(svg, f'{{{SVG}}}g', {'clip-path': 'url(#exclude-print-marks)'})
        for item in artwork:
            if item.tag != f'{{{SVG}}}defs':
                svg.remove(item)
                group.append(item)
    ElementTree.register_namespace('', SVG)
    ElementTree.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
    return ElementTree.tostring(svg, encoding='unicode') + '\n'


def save_vector(booklet, page_number, bounds, path, clear_watermark, omit_glyphs, exclude_rects=()):
    page = booklet[page_number]
    region = fitz.Rect(bounds)
    if region.is_empty or not page.rect.contains(region):
        raise ValueError(f'{path}: invalid crop {bounds} on page {page_number + 1}')

    shape = cropped_svg(booklet, page_number, region)
    element = ElementTree.fromstring(shape)
    if any(node.tag.endswith('}image') for node in element.iter()):
        raise ValueError(f'{path}: a source bitmap intersects the choice')
    if clear_watermark or omit_glyphs or exclude_rects:
        shape = remove_print_marks(element, clear_watermark, omit_glyphs, exclude_rects)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(shape, encoding='utf-8')


def main():
    choice_sets = json.loads(MANIFEST.read_text(encoding='utf-8'))
    sources = defaultdict(list)
    for task, record in choice_sets.items():
        if record['options'].keys() != record['clips'].keys():
            raise ValueError(f'{task}: each exported choice must have a source crop')
        sources[record['source']].append(record)

    for source, records in sources.items():
        with fitz.open(ROOT / source) as booklet:
            for number in {record['page'] for record in records}:
                booklet[number].remove_rotation()
            for record in records:
                for option, path in record['options'].items():
                    save_vector(booklet, record['page'], record['clips'][option], ROOT / 'dist' / path,
                                clear_watermark=record.get('clearWatermark', False),
                                omit_glyphs=record.get('omitGlyphs', {}).get(option, []),
                                exclude_rects=record.get('excludeRects', {}).get(option, []))


if __name__ == '__main__':
    main()
