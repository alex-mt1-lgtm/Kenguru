"""Recreate checked archive illustrations from native paths in the official PDFs."""

from collections import defaultdict
import json
from pathlib import Path
from xml.etree import ElementTree

import fitz

from pdf_figure import cropped_svg, remove_print_marks


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'sources' / 'separated-choice-vectors.json'


def save_vector(booklet, page_number, bounds, path, clear_watermark, omit_glyphs, exclude_rects=()):
    page = booklet[page_number]
    region = fitz.Rect(bounds)
    if region.is_empty or not page.rect.contains(region):
        raise ValueError(f'{path}: invalid crop {bounds} on page {page_number + 1}')

    shape = cropped_svg(booklet, page_number, region)
    element = ElementTree.fromstring(shape)
    if any(node.tag.endswith('}image') for node in element.iter()):
        raise ValueError(f'{path}: a source bitmap intersects the artwork')
    if clear_watermark or omit_glyphs or exclude_rects:
        shape = remove_print_marks(element, clear_watermark, omit_glyphs, exclude_rects)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(shape, encoding='utf-8')


def main():
    choice_sets = json.loads(MANIFEST.read_text(encoding='utf-8'))
    sources = defaultdict(list)
    for task, record in choice_sets.items():
        if record.get('options', {}).keys() != record.get('clips', {}).keys():
            raise ValueError(f'{task}: each exported choice must have a source crop')
        if ('condition' in record) != ('conditionClip' in record):
            raise ValueError(f'{task}: the condition artwork must have a source crop')
        sources[record['source']].append(record)

    for source, records in sources.items():
        with fitz.open(ROOT / source) as booklet:
            for number in {record['page'] for record in records}:
                booklet[number].remove_rotation()
            for record in records:
                if 'condition' in record:
                    save_vector(booklet, record['page'], record['conditionClip'], ROOT / 'dist' / record['condition'],
                                clear_watermark=record.get('clearWatermark', False), omit_glyphs=[],
                                exclude_rects=record.get('conditionExcludeRects', []))
                for option, path in record.get('options', {}).items():
                    save_vector(booklet, record['page'], record['clips'][option], ROOT / 'dist' / path,
                                clear_watermark=record.get('clearWatermark', False),
                                omit_glyphs=record.get('omitGlyphs', {}).get(option, []),
                                exclude_rects=record.get('excludeRects', {}).get(option, []))


if __name__ == '__main__':
    main()
