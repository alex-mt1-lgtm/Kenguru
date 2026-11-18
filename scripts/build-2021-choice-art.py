"""Extract the five sun-ray fragments from the 2021 grade 3–4 booklet."""

from pathlib import Path

import fitz

from archive_condition_art import vector_figure


ROOT = Path(__file__).resolve().parents[1]
CHOICES = [
    (474.5, 375.75, 501.25, 395.5),
    (521.5, 375.75, 552.25, 395.5),
    (572.75, 375.75, 597.75, 395.5),
    (616.75, 375.75, 647.5, 395.5),
    (667.75, 375.75, 691.5, 395.5),
]


if __name__ == '__main__':
    folder = ROOT / 'dist' / 'assets' / 'years' / '2021'
    with fitz.open(ROOT / 'sources' / '2021' / 'tasks.pdf') as document:
        for index, bounds in enumerate(CHOICES):
            region = fitz.Rect(bounds)
            drawing = vector_figure(document, 0, region, round(region.width * 4), round(region.height * 4))
            (folder / f'choice-4-{index}.svg').write_text(drawing, encoding='utf-8')
