import fitz


def cropped_svg(document, page_number, rect):
    """Export only the material inside a display-coordinate rectangle, retaining glyph outlines."""
    with fitz.open() as figure:
        figure.insert_pdf(document, from_page=page_number, to_page=page_number)
        page = figure[0]
        if page.rotation:
            page.remove_rotation()
        page.clip_to_rect(rect)
        page.set_cropbox(rect)
        return page.get_svg_image(text_as_path=True)
