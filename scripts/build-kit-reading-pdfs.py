"""Prepare separate KIT reading copies while keeping the original booklets."""
from pathlib import Path
import fitz

from kit_restored_figures import build_reading_copies

ROOT = Path(__file__).resolve().parents[1]
PANELS = {
    2011: [(0, 'lower', 0), (1, 'upper', 0), (1, 'lower', 0), (0, 'upper', 0)],
    2012: [(0, 'left', 90), (0, 'right', 270)],
}


def prepare(year, grade):
    source = ROOT / 'sources' / 'kit' / str(year) / f'{grade}.pdf'
    output = ROOT / 'dist' / 'assets' / 'kit' / str(year) / f'{grade}-reading.pdf'
    with fitz.open(source) as booklet, fitz.open() as result:
        if len(booklet) != (2 if year == 2011 else 1):
            raise ValueError(f'Unexpected layout in {source}')
        panels = PANELS[year]
        # Only the 6–7 booklet puts its title on the right of the 2012 sheet.
        if year == 2012 and grade == '6-7':
            panels = list(reversed(panels))
        for i, half, rotation in panels:
            rect = booklet[i].rect
            w, h = rect.width, rect.height
            clips = {'upper': (0, 0, w, h / 2), 'lower': (0, h / 2, w, h),
                     'left': (0, 0, w / 2, h), 'right': (w / 2, 0, w, h)}
            clip = fitz.Rect(clips[half])
            size = (clip.height, clip.width) if rotation else (clip.width, clip.height)
            page = result.new_page(width=size[0], height=size[1])
            page.show_pdf_page(page.rect, booklet, i, clip=clip, rotate=rotation)
        output.write_bytes(result.tobytes(garbage=4, deflate=True, no_new_id=True))


if __name__ == '__main__':
    for year in PANELS:
        for grade in ['2-3', '4-5', '6-7', '8-9', '10-11']:
            prepare(year, grade)
    build_reading_copies()
