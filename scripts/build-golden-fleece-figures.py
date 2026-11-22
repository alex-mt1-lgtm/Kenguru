import json
from html import escape
from io import BytesIO
from math import atan2, degrees
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources' / 'golden-fleece'


def render(page, scale, rect=None):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=rect, alpha=False)
    return Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)


def embedded_image(page, figure):
    area = fitz.Rect(figure['rect'])
    width, height = figure['embeddedSize']
    if 'embeddedXref' in figure:
        xref = figure['embeddedXref']
        matches = [info for info in page.get_image_info(xrefs=True)
                   if info['xref'] == xref and (info['width'], info['height']) == (width, height)
                   and all(abs(a - b) < 0.02 for a, b in zip(info['bbox'], area))]
        if len(matches) != 1:
            raise ValueError(f'Cannot identify embedded xref {xref} on page {page.number + 1}: {figure}')
        pixmap = fitz.Pixmap(page.parent, xref)
        if pixmap.alpha or page.parent.xref_get_key(xref, 'SMask')[0] != 'null':
            raise ValueError(f'Embedded xref {xref} is not opaque: {figure}')
        if pixmap.colorspace != fitz.csRGB:
            pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
        image = Image.frombytes('RGB', (width, height), pixmap.samples)
        x_scale, x_skew, y_skew, y_scale, _, _ = matches[0]['transform']
        # Some photos were reflected in the booklet layout.
        if x_scale < 0:
            image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            x_skew = -x_skew
        if y_scale < 0:
            image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            y_skew = -y_skew
        if abs(x_skew) > 0.001 or abs(y_skew) > 0.001:
            angle = atan2(x_skew, abs(x_scale))
            if abs(angle - atan2(-y_skew, abs(y_scale))) > 0.001:
                raise ValueError(f'Embedded xref {xref} is skewed: {figure}')
            image = image.rotate(-degrees(angle), Image.Resampling.BICUBIC, expand=True, fillcolor='white')
        return image
    blocks = page.get_text('dict', flags=fitz.TEXT_PRESERVE_IMAGES)['blocks']
    matches = [block for block in blocks if block['type'] == 1
               and (block['width'], block['height']) == (width, height)
               and all(abs(a - b) < 0.02 for a, b in zip(block['bbox'], area))]
    if len(matches) != 1 or matches[0].get('mask'):
        raise ValueError(f'Cannot identify an opaque embedded image on page {page.number + 1}: {figure}')
    with Image.open(BytesIO(matches[0]['image'])) as original:
        return original.convert('RGB')


def build_figures(manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    figures = manifest.get('figures', manifest)
    pdf_path = manifest_path.with_name(manifest.get('source', 'tasks.pdf'))
    rendered_pages = {}

    with fitz.open(pdf_path) as document:
        for figure in figures.values():
            page = document[figure['page']]
            scale = figure.get('scale', manifest.get('scale'))
            if 'embeddedSize' in figure:
                image = embedded_image(page, figure)
            elif 'box' in figure:
                # Pixel coordinates refer to an already rendered full page.
                page_key = (page.number, scale)
                if page_key not in rendered_pages:
                    rendered_pages[page_key] = render(page, scale)
                image = rendered_pages[page_key].crop(figure['box'])
            else:
                image = render(page, scale, fitz.Rect(figure['rect']))

            output = ROOT / 'dist' / figure['src']
            output.parent.mkdir(parents=True, exist_ok=True)
            image.save(output, lossless=True)


def build_previews(manifest_path):
    illustrations = json.loads(manifest_path.read_text(encoding='utf-8'))
    for figure in illustrations.values():
        if 'previewMaxSide' not in figure:
            continue
        master = ROOT / 'dist' / figure['detailSrc']
        if 'masterSource' in figure:
            with Image.open(SOURCES / 'reading-art' / figure['masterSource']) as original:
                master.parent.mkdir(parents=True, exist_ok=True)
                original.save(master, quality=94, method=5)
        with Image.open(master) as original:
            image = original.copy()
        max_side = figure['previewMaxSide']
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        if image.size != (figure['width'], figure['height']):
            raise ValueError(f'Preview dimensions differ from {manifest_path}: {figure}')
        image.save(ROOT / 'dist' / figure['src'], quality=86, method=5)


def build_credits(manifests):
    parts = ['''<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Источники иллюстраций «Золотого руна» · Olympiads.pro</title>
<style>body{font:1rem/1.6 system-ui,sans-serif;max-width:56rem;margin:auto;padding:1.2rem;color:#172e34;background:#fffefa}h1,h2{line-height:1.2}li{margin-block:.65rem}a{color:#165c56}ul{padding-inline-start:1.5rem}</style>
<main><h1>Источники иллюстраций «Золотого руна»</h1>
<p>Буклеты организатора доступны в архиве. Здесь указаны источники иллюстраций для интерактивных заданий и буклетов для чтения.</p>''']
    for path in manifests:
        illustrations = json.loads(path.read_text(encoding='utf-8'))
        entries = [figure for figure in illustrations.values() if 'credit' in figure]
        if not entries:
            continue
        parts.append(f'<h2>{path.parent.name}</h2><ul>')
        for figure in sorted(entries, key=lambda entry: entry['credit']['author'].casefold()):
            credit = figure['credit']
            parts.append(f'<li><a href="{escape(figure["source"], quote=True)}">{escape(credit["title"])}</a> · '
                         f'{escape(credit["author"])} · '
                         f'<a href="{escape(credit["licenseUrl"], quote=True)}">{escape(credit["license"])}</a>. '
                         f'{escape(figure["processing"])}</li>')
        parts.append('</ul>')
    reading_manifest = SOURCES / 'reading-pdfs.json'
    if reading_manifest.is_file():
        reading_art = json.loads(reading_manifest.read_text(encoding='utf-8'))
        parts.append('<h2>Буклеты для чтения</h2><ul>')
        for figure in reading_art:
            if 'source' not in figure:
                continue
            label = figure.get('title') or figure['id']
            license_name = figure.get('license') or 'Общественное достояние'
            license_url = figure.get('licenseUrl')
            license_markup = escape(license_name)
            if license_url:
                license_markup = f'<a href="{escape(license_url, quote=True)}">{license_markup}</a>'
            parts.append(f'<li><a href="{escape(figure["source"], quote=True)}">{escape(label)}</a> · '
                         f'{escape(figure.get("author", ""))} · {license_markup}. '
                         f'{escape(figure.get("processing", ""))}</li>')
        parts.append('</ul>')
    parts.append('</main></html>')
    (ROOT / 'dist/assets/golden-fleece/illustrations.html').write_text('\n'.join(parts) + '\n', encoding='utf-8')


if __name__ == '__main__':
    for manifest in sorted(SOURCES.glob('*/figures*.json')):
        build_figures(manifest)
    manifests = sorted(SOURCES.glob('*/illustrations.json'))
    for manifest in manifests:
        build_previews(manifest)
    build_credits(manifests)
