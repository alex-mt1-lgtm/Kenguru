"""Print editorial keys for early primary editions and corrected archive questions."""
import json
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
rl_config.invariant = True
pdfmetrics.registerFont(TTFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
regular = ParagraphStyle('body', fontName='DejaVu', fontSize=11, leading=16)
heading = ParagraphStyle('heading', parent=regular, fontSize=18, leading=24)


def print_key(edition):
    cards = edition['cards']
    letters = edition['answerLetters']
    elements = [
        Paragraph(f"Кенгуру · {edition['year']} · {edition['label']}", heading),
        Spacer(1, 10), Paragraph('Редакционный ключ к варианту на Olympiads.pro', regular),
        Spacer(1, 20),
    ]
    for offset in range(0, len(cards), 10):
        group = cards[offset:offset + 10]
        grid = [['Задача'] + [str(c['number']) for c in group],
                ['Ответ'] + [letters[c['answer']] for c in group]]
        table = Table(grid, colWidths=[68] + [36] * len(group), hAlign='LEFT')
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'DejaVu'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e7eee8')),
            ('GRID', (0, 0), (-1, -1), .5, colors.HexColor('#98aaa2')),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ]))
        elements.extend([table, Spacer(1, 14)])
    for card in cards:
        if note := card.get('keyNote') or card.get('questionNote'):
            elements.extend([Paragraph(f"№ {card['number']}. {escape(note)}", regular), Spacer(1, 8)])
    SimpleDocTemplate(str(ROOT / 'dist' / edition['answersUrl']), title='Кенгуру. Редакционный ключ',
                      leftMargin=48, rightMargin=48).build(elements)


if __name__ == '__main__':
    editions = json.loads(subprocess.check_output(
        ['node', '-p', "JSON.stringify(require('./scripts/math-completion.cjs').loadCompletedMath())"],
        cwd=ROOT))
    for edition in editions:
        if '_reviewed_' in edition['answersUrl']:
            print_key(edition)
