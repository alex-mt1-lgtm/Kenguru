"""Build the 2001–2019 task illustrations and player data from the official PDFs.

Requires Python, PyMuPDF and Pillow. Run from the repository root. The JSON
lesson files carry the checked answer letter and explanation for each task.
"""
import argparse
import io
import json
import re
from pathlib import Path

import fitz
from PIL import Image, ImageChops, ImageDraw


BASE = Path(__file__).resolve().parents[1]
SOURCES = BASE / "sources"
DIST = BASE / "dist"
YEARS = range(2001, 2020)
CACHE = SOURCES / "legacy-renders"
SCALE = 2.35

# Printed spread coordinates, with page numbers starting at zero. The PDF for
# 2011 has no text layer. Others find task numbers in the PDF's text positions.
SCAN_2011 = [
    (0, 46, 21, [63.2, 132, 192.8, 306.4, 399.2, 457.6]),
    (0, 466, 1, [150.4, 222.4, 300, 384, 421.6, 473.6]),
    (1, 46, 7, [41.6, 103.2, 185.6, 240, 315.2, 385.6, 444]),
    (1, 466, 14, [41.6, 120, 207.2, 273.6, 352, 429, 485.6]),
]
# A small number of drawings start above their task number. Coordinates
# override that start rather than including part of the task above.
TOP_OVERRIDES = {(2011, 2): 216.5}


def words_in_print_order(page):
    return [(fitz.Rect(word[:4]) * page.rotation_matrix, word[4])
            for word in page.get_text("words")]


def printed_columns(document, year):
    if year == 2011:
        for page_index, x, first, tops in SCAN_2011:
            yield page_index, x, [(first + i, y) for i, y in enumerate(tops)]
        return

    for page_index, page in enumerate(document):
        words = words_in_print_order(page)
        left_edges = [(134, 141)] if len(document) == 4 else [(39, 53), (459, 473)]
        for col_index, (lo, hi) in enumerate(left_edges):
            markers = []
            for box, word in words:
                if not lo <= box.x0 <= hi or (len(document) == 2 and not 27 <= box.y0 <= 541):
                    continue
                match = re.match(r"^(\d{1,2})\.", word)
                if year == 2017 and col_index == 0:
                    # The left column contains both a whole task number and
                    # a duplicate last digit from the overprinted characters.
                    if box.x0 > 48:
                        continue
                    match = re.fullmatch(r"(\d{1,2})\.?", word)
                if match and 1 <= int(match[1]) <= 26:
                    markers.append((int(match[1]), box.y0, box.x0))
            markers.sort(key=lambda item: item[1])
            if not markers or [m[0] for m in markers] != list(range(markers[0][0], markers[-1][0] + 1)):
                raise ValueError(f"{year}, page {page_index + 1}, column {col_index + 1}: {markers}")
            x = min(mark[2] for mark in markers)
            yield page_index, x, [(n, y) for n, y, _ in markers]


def crop_bottom(page, left, right, top, bottom, *, final=False, scanned=False):
    """Trim the paper after the task, leaving all content in the crop."""
    if scanned:
        return bottom
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            content = " ".join(span["text"] for span in line["spans"])
            rect = fitz.Rect(line["bbox"]) * page.rotation_matrix
            if not left <= rect.x0 < right or not top + 10 < rect.y0 < bottom:
                continue
            if re.search(r"задачи\s*,?\s*оцениваемые\s+в\s+[345]\s*балл|время\s*,?\s*отвед[её]нное|правила международной ассоциации", content, re.I):
                bottom = min(bottom, rect.y0 - (6 if final else 2))
    return bottom


def find_opening_text(page, region, number, year):
    # The raster remains authoritative and includes picture-only choices.
    # Extract the printed wording when the PDF encodes it as normal text.
    if year in (2011, 2017, 2018, 2019):
        return ""
    words = [(r, word) for r, word in words_in_print_order(page)
             if region.x0 <= r.x0 and r.x1 <= region.x1 + 2 and region.y0 <= r.y0 < region.y1]
    words.sort(key=lambda pair: (pair[0].y0, pair[0].x0))
    rows = []
    for rect, word in words:
        if not rows or rect.y0 - rows[-1][0] > 3:
            rows.append((rect.y0, []))
        rows[-1][1].append((rect.x0, word))
    text_rows = []
    for _, row in rows:
        value = " ".join(word for _, word in sorted(row))
        end = re.search(r"\([АA]\)", value)
        if end:
            if value[:end.start()].strip():
                text_rows.append(value[:end.start()].strip())
            break
        text_rows.append(value)
    else:
        return ""
    text = re.sub(rf"^{number}\.\s*", "", " ".join(text_rows))
    text = re.sub(r"(?<=\w)- (?=\w)", "", text)
    text = re.sub(r"\s+([,.;?!])", r"\1", text)
    if not (len(text) > 24 and re.search("[а-яА-Я]{3}", text)) or "\ufffd" in text:
        return ""
    return text


def answer_marks(page, region, number, year):
    if year in (2011, 2017, 2019):
        return {}
    labels = ("AА", "BВ" if year <= 2007 else "Б", "CС" if year <= 2007 else "В",
              "D" if year <= 2007 else "Г", "EЕ" if year <= 2007 else "Д")
    result = {}
    reading_order = sorted(words_in_print_order(page), key=lambda word: (word[0].y0, word[0].x0))
    for i, letters in enumerate(labels):
        matches = [rect for rect, word in reading_order
                   if re.fullmatch(rf"\([{letters}]\)", word)
                   and region.contains(rect)]
        if len(matches) != 1:
            return {}
        rect = matches[0]
        result[str(i)] = [round((rect.x0 - region.x0) * SCALE, 1),
                          round((rect.y0 - region.y0) * SCALE, 1),
                          round(rect.width * SCALE, 1), round(rect.height * SCALE, 1)]
    return result


def cut_segments(left, right, default, overrides):
    """Split a crop at the printed boundary, allowing a drawing to overhang."""
    points = sorted({left, right, *(min(right, max(left, x))
                        for z in overrides for x in z[:2])})
    for x0, x1 in zip(points, points[1:]):
        y = next((cut for lo, hi, cut in overrides if lo <= x0 and x1 <= hi), default)
        yield x0, x1, y


def trim_masks(image, pixels, region, cuts, opening):
    draw = ImageDraw.Draw(image)
    for x0, x1, y in cuts:
        if opening and y <= region.y0 or not opening and y >= region.y1:
            continue
        left = round(x0 * SCALE) - pixels.x
        right = round(x1 * SCALE) - pixels.x - 1
        vertical = round(y * SCALE) - pixels.y
        top, bottom = (0, vertical - 1) if opening else (vertical, image.height - 1)
        if left <= right and top <= bottom:
            draw.rectangle((left, top, right, bottom), fill="white")


def final_boundary(page, year, column_x):
    if year <= 2002:
        return 672
    if year == 2011:
        return 537
    # Most releases print the page number at the bottom and near the
    # horizontal middle of each column. Its y position varies by year.
    center = 628 if column_x > 420 else 208
    words = words_in_print_order(page)
    candidates = [r.y0 for r, w in words if 528 < r.y0 < 570 and
                  abs(r.x0 - center) <= 6 and w in ("1", "2", "3", "4")]
    return max(candidates) - 2 if candidates else 548


def closing_rule(page, left, right, top, bottom):
    for drawing in page.get_drawings():
        rect = drawing["rect"] * page.rotation_matrix
        if (rect.x0 >= left - 8 and rect.x1 <= right + 9 and
                rect.width >= 270 and rect.height < 3 and top + 20 < rect.y0 < bottom + 6):
            bottom = min(bottom, rect.y0 - 3)
    return bottom


def render_year(year):
    directory = DIST / "assets" / "years" / str(year)
    directory.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(SOURCES / str(year) / "tasks.pdf")
    layout_path = SOURCES / "legacy-layout" / f"{year}.json"
    layout = json.loads(layout_path.read_text()) if layout_path.exists() else {}
    seams = layout.get("seams", {})
    regions = layout.get("regions", {})
    tasks = {}
    for page_index, x, markers in printed_columns(doc, year):
        page = doc[page_index]
        # The 4-page PDFs are single pages, others have two facing pages.
        right = 478 if len(doc) == 4 else (813 if x > 420 else 401)
        gutter = x - 5
        last_limit = final_boundary(page, year, x)
        starts = [(n, TOP_OVERRIDES.get((year,n), y - 3)) for n, y in markers]
        for i, (n, top) in enumerate(starts):
            final = i + 1 == len(starts)
            following, bottom = (None, last_limit) if final else starts[i + 1]
            bottom = crop_bottom(page, gutter, right, top, bottom, final=final, scanned=year == 2011)
            if n == 26:
                bottom = closing_rule(page, gutter, right, top, bottom)
            top_cuts = list(cut_segments(gutter, right, top, seams.get(str(n), [])))
            bottom_cuts = list(cut_segments(gutter, right, bottom, seams.get(str(following), [])))
            box = [gutter, min(y for _, _, y in top_cuts),
                   right, max(y for _, _, y in bottom_cuts)]
            region = fitz.Rect(regions.get(str(n), box))
            if region.is_empty or n in tasks:
                raise ValueError(f"Invalid crop for {year} #{n}: {region}")
            pixmap = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=region, alpha=False)
            image = Image.open(io.BytesIO(pixmap.tobytes("png")))
            if str(n) not in regions:
                trim_masks(image, pixmap, region, top_cuts, True)
                trim_masks(image, pixmap, region, bottom_cuts, False)
            # Remove only empty rows, keeping a few pixels of paper around the ink.
            ink = ImageChops.difference(image, Image.new("RGB", image.size, "white")).convert("L")
            ink = ink.point(lambda px: 255 if px > 36 else 0)
            bounds = ink.getbbox()
            if not bounds:
                raise ValueError(f"Empty crop for {year} #{n}")
            stop = min(image.height, bounds[3] + 7)
            image = image.crop((0, 0, image.width, stop))
            image.save(directory / f"task-{n:02}.webp", quality=92, method=6)
            tasks[n] = [image.width, image.height,
                        find_opening_text(page, region, n, year),
                        answer_marks(page, region, n, year)]

    if set(tasks) != set(range(1, 27)):
        raise ValueError(f"{year}: expected tasks 1–26; found {sorted(tasks)}")
    return tasks


def generate(years):
    CACHE.mkdir(exist_ok=True)
    for year in years:
        print(f"Cropping {year}", flush=True)
        tasks = render_year(year)
        (CACHE / f"{year}.json").write_text(
            json.dumps(tasks, ensure_ascii=False, separators=(",", ":")) + "\n")


def write_catalog():
    catalog = []
    for year in YEARS:
        meta = json.loads((SOURCES / "legacy-lessons" / f"{year}.json").read_text())
        tasks = json.loads((CACHE / f"{year}.json").read_text())
        lessons = {lesson["number"]: lesson for lesson in meta["lessons"]}
        answers = meta["answers"]
        if len(answers) != 26 or re.search(r"[^ABCDE?]", answers):
            raise ValueError(f"Invalid key for {year}")
        if set(lessons) != set(range(1, 27)):
            raise ValueError(f"Missing walkthroughs for {year}")
        if any(not item.get("title") or len(item.get("steps", [])) < 2 for item in lessons.values()):
            raise ValueError(f"Incomplete walkthrough for {year}")
        items = []
        for i, letter in enumerate(answers, 1):
            lesson = lessons[i]
            w, h, question, marks = tasks[str(i)]
            items.append([w, h, question, marks, letter,
                          lesson.get("title", ""), lesson.get("steps", []),
                          lesson.get("note", "")])
        title = "3–4 классы"
        catalog.append([year, title, items])
    output = DIST / "years" / "legacy-catalog.js"
    output.write_text("'use strict';\n// Generated by scripts/build-legacy-editions.py.\n"
                      + "globalThis.KENGURU_LEGACY = " + json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--crop", type=int, nargs="*", help="Regenerate task rasters for these years, or all when no years are listed")
    parser.add_argument("--catalog", action="store_true", help="Regenerate the interactive dataset")
    args = parser.parse_args()
    if args.crop is not None:
        generate(args.crop or YEARS)
    if args.catalog:
        write_catalog()
