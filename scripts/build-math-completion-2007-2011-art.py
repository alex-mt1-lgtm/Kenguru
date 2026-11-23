#!/usr/bin/env python3
"""Rebuild reviewed 7–8 class artwork from the 2007–2011 contest booklets."""

import argparse
import json
from pathlib import Path
import re
from runpy import run_path
from xml.etree import ElementTree

import fitz

from pdf_figure import SVG, cropped_svg


ROOT = Path(__file__).resolve().parents[1]
XLINK = 'http://www.w3.org/1999/xlink'
YEARS = range(2007, 2012)
URL_REFERENCE = re.compile(r'url\(#([^)]*)\)')


def tag(name):
    return f'{{{SVG}}}{name}'


def cropped_element(document, page, rectangle, index):
    element = ElementTree.fromstring(cropped_svg(document, page, rectangle))
    prefix = f'fragment-{index}-'
    for node in element.iter():
        for key, value in list(node.attrib.items()):
            if key == 'id':
                node.set(key, prefix + value)
            elif key in ('href', f'{{{XLINK}}}href') and value.startswith('#'):
                node.set(key, '#' + prefix + value[1:])
            elif 'url(#' in value:
                node.set(key, URL_REFERENCE.sub(lambda match: f'url(#{prefix}{match[1]})', value))
    return element


def compound_svg(document, page, rectangles, layout=None, polygon=None):
    bounds = fitz.Rect(rectangles[0])
    for rectangle in rectangles[1:]:
        bounds |= rectangle
    if layout is None:
        layout = [(r.x0 - bounds.x0, r.y0 - bounds.y0) for r in rectangles]
    if len(layout) != len(rectangles):
        raise ValueError('Every figure fragment needs a position in the composite')
    width = max(x + r.width for (x, _), r in zip(layout, rectangles))
    height = max(y + r.height for (_, y), r in zip(layout, rectangles))
    svg = ElementTree.Element(tag('svg'), {
        'viewBox': f'0 0 {width:g} {height:g}',
        'width': f'{width:g}',
        'height': f'{height:g}',
    })
    target = svg
    if polygon is not None:
        defs = ElementTree.SubElement(svg, tag('defs'))
        clip = ElementTree.SubElement(defs, tag('clipPath'), {'id': 'figure-clip'})
        points = ' '.join(f'{x - bounds.x0:g},{y - bounds.y0:g}' for x, y in polygon)
        ElementTree.SubElement(clip, tag('polygon'), {'points': points})
        target = ElementTree.SubElement(svg, tag('g'), {'clip-path': 'url(#figure-clip)'})
    for index, (rectangle, (x, y)) in enumerate(zip(rectangles, layout), 1):
        fragment = cropped_element(document, page, rectangle, index)
        fragment.set('x', f'{x:g}')
        fragment.set('y', f'{y:g}')
        target.append(fragment)
    ElementTree.register_namespace('', SVG)
    ElementTree.register_namespace('xlink', XLINK)
    return ElementTree.tostring(svg, encoding='unicode') + '\n', width, height


def build_year(year):
    manifest = ROOT / 'sources' / 'math-completion' / f'{year}-7-8-art.json'
    source = ROOT / 'sources' / 'grades-7-8' / str(year) / 'tasks.pdf'
    folder = Path('assets') / 'grades-7-8' / str(year)
    crop_art = run_path(str(ROOT / 'scripts' / 'build-grade-editions.py'))['crop_art']
    figures = {}
    with fitz.open(source) as document:
        for name, (page, regions, alt, *presentation) in json.loads(
            manifest.read_text(encoding='utf-8')
        ).items():
            shape = presentation[0] if presentation else None
            if len(regions) == 1 and shape is None:
                figure = crop_art(document, folder, name, page, regions)
            else:
                rectangles = [fitz.Rect(region) for region in regions]
                if any(r.is_empty or r not in document[page].rect for r in rectangles):
                    raise ValueError(f'{manifest.name} {name} has a crop outside page {page}')
                layout = shape.get('layout') if isinstance(shape, dict) else None
                polygon = shape if isinstance(shape, list) else None
                markup, width, height = compound_svg(document, page, rectangles, layout, polygon)
                path = folder / f'{name}.svg'
                output = ROOT / 'dist' / path
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(markup, encoding='utf-8')
                figure = {'src': path.as_posix(), 'width': round(width * 3), 'height': round(height * 3)}
            figures[name] = {**figure, 'alt': alt}
    return figures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('years', nargs='*', type=int, metavar='YEAR')
    args = parser.parse_args()
    for year in args.years or YEARS:
        if year not in YEARS:
            parser.error(f'no artwork manifest maintained by this script for {year}')
        build_year(year)


if __name__ == '__main__':
    main()
