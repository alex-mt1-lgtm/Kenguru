#!/usr/bin/env python3
"""Rebuild figure crops for the 7–8 grade archive lessons."""

import json
from pathlib import Path
import sys
from xml.etree import ElementTree

import fitz

from pdf_figure import cropped_svg, remove_print_marks


ROOT = Path(__file__).resolve().parents[1]
RENDER_SCALE = 1.5


def build(manifest):
    year, _, grade = manifest.name.removesuffix('.art.json').partition('-')
    pdf = ROOT / 'sources' / f'grades-{grade}' / year / 'tasks.pdf'
    with fitz.open(pdf) as document:
        for figure in json.loads(manifest.read_text(encoding='utf-8')):
            rect = fitz.Rect(figure['rect']) / RENDER_SCALE
            target = ROOT / 'dist' / figure['src']
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.suffix == '.png':
                scale = figure['imageScale']
                page = document[figure['page']]
                page.get_pixmap(clip=rect, matrix=fitz.Matrix(scale, scale)).save(target)
                continue
            svg = cropped_svg(document, figure['page'], rect)
            if 'exclude' in figure:
                element = ElementTree.fromstring(svg)
                _, _, width, height = map(float, element.get('viewBox').split())
                exclusions = []
                for excluded in figure['exclude']:
                    left, top, right, bottom = fitz.Rect(excluded) / RENDER_SCALE
                    exclusions.append((
                        max(0, left - rect.x0), max(0, top - rect.y0),
                        min(width, right - rect.x0), min(height, bottom - rect.y0),
                    ))
                svg = remove_print_marks(element, exclude_rects=exclusions)
            target.write_text(svg, encoding='utf-8')


def main():
    directory = ROOT / 'sources' / 'math-completion'
    manifests = [directory / f'{edition}.art.json' for edition in sys.argv[1:]]
    for manifest in manifests or sorted(directory.glob('????-7-8.art.json')):
        build(manifest)


if __name__ == '__main__':
    main()
