"""Export the independently checked answers for the 2024 KIT training edition."""

import json
import subprocess
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'sources/kit/2024'
OUTPUT = ROOT / 'dist/assets/kit/2024/editorial-answers.pdf'


def export():
    with fitz.open() as pdf:
        page = pdf.new_page()
        fontfile = subprocess.check_output(['fc-match', '-f', '%{file}', 'DejaVu Sans'], text=True)
        font = fitz.Font(fontfile=fontfile)

        def label(x, y, words, size=12):
            writer = fitz.TextWriter(page.rect)
            writer.append((x, y), words, font=font, fontsize=size)
            writer.write_text(page, color=(.09, .18, .20))

        label(48, 68, 'КИТ · 2024', 25)
        label(48, 101, 'Ответы редакции Olympiads.pro', 19)
        label(48, 130, 'Задания решены и сверены редакцией по конкурсным бланкам.')
        label(48, 168, '№ задачи', 13)
        label(205, 168, '2–3 классы', 13)
        label(385, 168, '4–5 классы', 13)
        for x, grade in [(205, '2-3'), (385, '4-5')]:
            rows = json.loads((SOURCE / (grade + '.json')).read_text())
            for i, row in enumerate(rows):
                answer = str(row['numericAnswer']) if 'numericAnswer' in row else 'АБВГ'[row['answer']]
                label(x, 196 + i * 25, answer)
        for number in range(1, 22):
            y = 196 + (number - 1) * 25
            label(48, y, str(number))
            page.draw_line((48, y + 7), (525, y + 7), color=(.82, .85, .82), width=.5)
        pdf.set_metadata({'title': 'КИТ 2024. Ответы редакции Olympiads.pro'})
        pdf.subset_fonts()
        pdf.save(OUTPUT, garbage=4, deflate=True, no_new_id=True)


if __name__ == '__main__':
    export()
