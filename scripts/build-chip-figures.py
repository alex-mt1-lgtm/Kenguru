import json
import re
from html import escape
from pathlib import Path

import fitz
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources' / 'chip'
ASSETS = ROOT / 'dist' / 'assets' / 'chip'


def preview_from_master(path, max_size=480):
    if path.suffix == '.svg':
        with fitz.open(path) as vector:
            page = vector[0]
            scale = max_size / max(page.rect.width, page.rect.height)
            pixels = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            return Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples)
    with Image.open(path) as original:
        image = original.copy()
    image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    return image


def credit_lines(path, manifest):
    year = path.parent.name
    label = year
    if manifest.get('title'):
        label += ' · ' + manifest['title']
    for edition in sorted(path.parent.glob('*.json')):
        grade = edition.stem
        if not re.fullmatch(r'\d+(?:-\d+)?', grade):
            continue
        grade_label = grade.replace('-', '–')
        grade_label += ' классы' if '-' in grade else ' класс'
        yield f'<h2>{escape(label)} · {grade_label}</h2><ul>'
        rows = json.loads(edition.read_text(encoding='utf-8'))
        credits = set()
        for row in rows:
            images = ([row['figure']] if row.get('figure') else []) + row.get('figures', []) + row.get('optionFigures', [])
            for image in images:
                detail = manifest['figures'].get(Path(image['src']).stem, {}).get('detail')
                if not detail:
                    continue
                source = detail['source']
                if source == 'tasks.pdf':
                    source = year + '/tasks.pdf'
                license_name = escape(detail['license'])
                if detail.get('licenseUrl'):
                    license_name = f'<a href="{escape(detail["licenseUrl"], quote=True)}">{license_name}</a>'
                master = ASSETS / year / detail['file']
                size = 'SVG'
                if master.suffix != '.svg':
                    with Image.open(master) as original:
                        size = f'{original.width} × {original.height} px'
                credits.add(f'<li><strong>{escape(detail["author"])}</strong>. '
                            f'<a href="{escape(source, quote=True)}">Источник</a> · {license_name}. '
                            f'{escape(detail["processing"])} <small>({size})</small></li>')
        yield from sorted(credits, key=str.casefold)
        yield '</ul>'


def build_credits(manifests):
    parts = ['''<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Источники иллюстраций ЧИП · Olympiads.pro</title>
<style>body{font:1rem/1.6 system-ui,sans-serif;max-width:56rem;margin:auto;padding:1.2rem;color:#172e34;background:#fffefa}h1,h2{line-height:1.2}li{margin-block:.65rem}a{color:#165c56}ul{padding-inline-start:1.5rem}</style>
<main><h1>Источники иллюстраций ЧИП</h1>
<p>Оригинальные буклеты доступны в уроках. Здесь указаны источники крупных изображений, использованных в тренировочных заданиях.</p>''']
    for path in manifests:
        parts.extend(credit_lines(path, json.loads(path.read_text(encoding='utf-8'))))
    parts.append('</main>')
    (ASSETS / 'illustrations.html').write_text('\n'.join(parts) + '\n', encoding='utf-8')


def build_figures(manifest_path):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    output = ASSETS / manifest_path.parent.name
    output.mkdir(parents=True, exist_ok=True)
    with fitz.open(manifest_path.parent / manifest['source']) as document:
        for name, figure in manifest['figures'].items():
            if 'detail' in figure:
                master = output / figure['detail']['file']
                if master == output / f'{name}.svg':
                    if not master.is_file():
                        raise FileNotFoundError(master)
                    continue
                preview = preview_from_master(master, figure['detail'].get('previewMax', 480))
                preview.save(output / f'{name}.webp', quality=86, method=5)
                continue
            page = document[figure['page']]
            if 'xref' in figure:
                pixels = fitz.Pixmap(document, figure['xref'])
            else:
                scale = manifest['renderScale']
                pixels = page.get_pixmap(
                    matrix=fitz.Matrix(scale, scale),
                    clip=fitz.Rect(figure['box']),
                    alpha=False,
                )
            image = Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples)
            if figure.get('flipVertical'):
                image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            if 'badge' in figure:
                badge = fitz.Rect(figure['badge']) * fitz.Matrix(scale, scale)
                pixel_box = badge.irect - (pixels.x, pixels.y, pixels.x, pixels.y)
                ImageDraw.Draw(image).rectangle(tuple(pixel_box), fill=image.getpixel((0, 0)))
            if 'imageBox' in figure:
                image = image.crop(figure['imageBox'])
            image.save(output / f'{name}.webp', lossless=True)


if __name__ == '__main__':
    manifests = sorted(SOURCES.glob('*/figures.json'))
    for manifest_path in manifests:
        build_figures(manifest_path)
    build_credits(manifests)
