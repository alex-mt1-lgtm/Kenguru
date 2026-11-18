"""Build independent choice figures and condition diagrams from reviewed card regions.

The source images are the localized artwork previously displayed together in the
lesson. The manifest records the regions in pixels and any choices set as text.
Run with Pillow, NumPy, and SciPy.
"""
import json
from pathlib import Path
import re
from xml.etree import ElementTree

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
MANIFEST = ROOT / 'sources' / 'separated-choices.json'
VECTORS = ROOT / 'sources' / 'separated-choice-vectors.json'
INK = 225
NEIGHBORS = np.ones((3, 3), dtype=bool)


def ink_mask(pixels):
    return np.asarray(Image.fromarray(pixels).convert('L')) < INK


def clean_pixels(image, record):
    pixels = np.array(image.convert('RGB'))
    if record.get('clearWatermark'):
        red, green, blue = pixels.astype(np.int16).transpose(2, 0, 1)
        # These three monochrome cards have a translucent orange watermark.
        # Undo the colour overlay while keeping underlying gray cells and ink.
        watermark = (red - blue > 7) & (red - green >= green - blue)
        alpha = np.clip((red[watermark] - blue[watermark]) / 191, 0, .45)
        gray = np.clip(np.rint((red[watermark] - 255 * alpha) / (1 - alpha)), 0, 255)
        pixels[watermark] = gray[:, None]
    for x0, y0, x1, y1 in record.get('erase', []):
        pixels[y0:y1, x0:x1] = 255
    return pixels


def written_image(pixels, mask):
    positions = np.nonzero(mask)
    if not positions[0].size:
        raise ValueError('The reviewed crop is empty')
    rows, columns = [
        slice(max(0, int(axis.min()) - 3), int(axis.max()) + 4)
        for axis in positions
    ]
    return Image.fromarray(pixels[rows, columns])


def split_components(pixels, regions, keep_outline):
    labels, count = ndimage.label(ink_mask(pixels), structure=NEIGHBORS)
    components = [None, *ndimage.find_objects(labels)]
    areas = np.bincount(labels.ravel(), minlength=count + 1)
    overlap = np.array([
        np.bincount(labels[y0:y1, x0:x1].ravel(), minlength=count + 1)
        for x0, y0, x1, y1 in [region if region else (0, 0, 0, 0) for region in regions]
    ])
    owners = overlap.argmax(axis=0)
    owners[overlap.max(axis=0) < areas * .12] = -1
    owners[0] = -1

    for index, region in enumerate(regions):
        if region is None:
            yield None
            continue
        selected = np.flatnonzero(owners == index)
        if keep_outline and index and selected.size:
            outline = components[selected[areas[selected].argmax()]]
            selected = [label for label in selected if all(
                outer.start - 3 <= inner.start and inner.stop <= outer.stop + 3
                for inner, outer in zip(components[label], outline)
            )]
        assigned = np.zeros(count + 1, dtype=bool)
        assigned[selected] = True
        mask = assigned[labels]
        expanded = ndimage.binary_dilation(mask, structure=NEIGHBORS)
        clipped = np.where(expanded[..., None], pixels, 255).astype(np.uint8)
        yield written_image(clipped, mask)


def trim_rectangles(pixels, regions):
    for region in regions:
        if region is None:
            yield None
            continue
        x0, y0, x1, y1 = region
        block = pixels[y0:y1, x0:x1]
        yield written_image(block, ink_mask(block))


def save_image(image, folder, name):
    path = folder / (name + '.webp')
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, 'WEBP', lossless=True, method=4)
    return path.relative_to(DIST).as_posix()


def condition_asset(asset):
    source = DIST / asset
    if source.suffix == '.svg':
        page = ElementTree.parse(source).getroot()
        _, _, width, height = map(float, page.attrib['viewBox'].split())
    else:
        with Image.open(source) as image:
            width, height = image.size
    return {'src': asset, 'width': width, 'height': height}


def main():
    manifest = json.loads(MANIFEST.read_text())
    vectors = json.loads(VECTORS.read_text()) if VECTORS.exists() else {}
    if unknown := vectors.keys() - manifest.keys():
        raise ValueError(f'Unknown tasks for copied artwork: {sorted(unknown)}')
    data = {}
    for task, record in manifest.items():
        edition, number = task.split('/')
        if not re.fullmatch(r'[0-9]{4}-(3-4|5-6)', edition) or not number.isdecimal():
            raise ValueError(f'Invalid task ID {task}')
        replacements = vectors.get(task, {})
        condition_vector = replacements.get('condition', record.get('vectorCondition'))
        option_vectors = replacements.get('options', {})
        regions = [
            None if condition_vector else record.get('condition'),
            *(None if str(index) in option_vectors else region
              for index, region in enumerate(record.get('figures', [None] * 5), 1)),
        ]
        if any(regions):
            source = DIST / record['source']
            with Image.open(source) as image:
                pixels = clean_pixels(image, record)
            for region in filter(None, regions):
                x0, y0, x1, y1 = region
                if not (0 <= x0 < x1 <= pixels.shape[1] and 0 <= y0 < y1 <= pixels.shape[0]):
                    raise ValueError(f'{task} has an invalid crop {region}')
            shapes = split_components(pixels, regions, record.get('outline', False)) if record.get('connected') \
                else trim_rectangles(pixels, regions)
            try:
                diagram, *choices = shapes
            except ValueError as error:
                raise ValueError(f'{task}: {error}') from error
        else:
            diagram, choices = None, [None] * 5
        options = record.get('choices', [{} for _ in range(5)])
        if len(choices) != 5 or len(options) != 5:
            raise ValueError(f'{task} must have exactly five choices')
        folder = DIST / 'assets' / 'separated-choices' / edition
        prefix = f'{int(number):02}'
        entry = {'options': options}
        if condition_vector:
            entry['condition'] = condition_asset(condition_vector)
        elif diagram is not None:
            src = save_image(diagram, folder, prefix + '-condition')
            entry['condition'] = {'src': src, 'width': diagram.width, 'height': diagram.height}
        for index, (picture, option) in enumerate(zip(choices, options)):
            if replacement := option_vectors.get(str(index + 1)):
                option['image'] = replacement
                if not replacement.endswith('.svg'):
                    with Image.open(DIST / replacement) as image:
                        option['pixelWidth'], option['pixelHeight'] = image.size
            elif picture is not None:
                option['image'] = save_image(picture, folder, f'{prefix}-{index + 1}')
                option['pixelWidth'], option['pixelHeight'] = picture.size
            if not option.get('text') and not option.get('image'):
                raise ValueError(f'{task} has an empty choice {index + 1}')
            if option.get('image') and not (DIST / option['image']).is_file():
                raise ValueError(f'{task} refers to a missing choice illustration')
        data[task] = entry
    output = DIST / 'years' / 'choice-layouts.js'
    output.write_text("'use strict';\n// Generated by scripts/build-separated-choices.py.\n"
                      'globalThis.KENGURU_CHOICE_LAYOUTS = '
                      + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'{len(data)} reviewed choice groups')


if __name__ == '__main__':
    main()
