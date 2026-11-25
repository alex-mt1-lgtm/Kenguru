from xml.etree import ElementTree

import fitz


SVG = 'http://www.w3.org/2000/svg'


def cropped_svg(document, page_number, rect):
    """Export only the material inside a display-coordinate rectangle, retaining glyph outlines."""
    with fitz.open() as figure:
        figure.insert_pdf(document, from_page=page_number, to_page=page_number)
        page = figure[0]
        if page.rotation:
            page.remove_rotation()
        if page.mediabox.top_left != fitz.Point(0, 0) or page.cropbox.top_left != fitz.Point(0, 0):
            # Some archived spreads place the page outside the default PDF origin.
            with fitz.open() as normalized:
                target = normalized.new_page(width=page.rect.width, height=page.rect.height)
                target.show_pdf_page(target.rect, figure, 0)
                target.clip_to_rect(rect)
                target.set_cropbox(rect)
                return target.get_svg_image(text_as_path=True)
        page.clip_to_rect(rect)
        page.set_cropbox(rect)
        return page.get_svg_image(text_as_path=True)


def remove_print_marks(svg, clear_watermark=False, omit_glyphs=(), exclude_rects=()):
    """Omit the watermark or adjoining printed labels on checked crops."""
    for parent in svg.iter():
        for item in list(parent):
            glyph = item.get('data-text')
            if item.tag != f'{{{SVG}}}use' or glyph is None:
                continue
            watermark = (clear_watermark and item.get('fill') == '#ff5400'
                         and item.get('fill-opacity') == '.25')
            if watermark or glyph in omit_glyphs:
                parent.remove(item)
    if exclude_rects:
        _, _, width, height = map(float, svg.get('viewBox').split())
        outline = f'M0 0H{width}V{height}H0Z'
        for left, top, right, bottom in exclude_rects:
            if not (0 <= left < right <= width and 0 <= top < bottom <= height):
                raise ValueError(f'Invalid print mark rectangle {left, top, right, bottom}')
            outline += f' M{left} {top}H{right}V{bottom}H{left}Z'
        artwork = list(svg)
        defs = ElementTree.SubElement(svg, f'{{{SVG}}}defs')
        clip = ElementTree.SubElement(defs, f'{{{SVG}}}clipPath', {'id': 'exclude-print-marks'})
        ElementTree.SubElement(clip, f'{{{SVG}}}path', {'d': outline, 'clip-rule': 'evenodd'})
        group = ElementTree.SubElement(svg, f'{{{SVG}}}g', {'clip-path': 'url(#exclude-print-marks)'})
        for item in artwork:
            if item.tag != f'{{{SVG}}}defs':
                svg.remove(item)
                group.append(item)
    ElementTree.register_namespace('', SVG)
    ElementTree.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
    return ElementTree.tostring(svg, encoding='unicode') + '\n'
