"""Run with Python Playwright and Chromium against a server for dist/."""

import shutil
import sys

from playwright.sync_api import expect, sync_playwright


BASE_URL = sys.argv[1].rstrip("/") + "/" if len(sys.argv) > 1 else "http://127.0.0.1:8000/"


def open_task(page, key):
    page.goto(BASE_URL + "#zadacha=" + key)
    page.wait_for_function("key => ready && lessonKey(LESSONS[task]) === key", arg=key)


def open_viewer(page, button):
    button.focus()
    page.keyboard.press("Enter")
    expect(page.locator("#detailClose")).to_be_focused()
    expect(page.locator("#detailScale")).to_be_enabled()
    assert_fitted(page)


def assert_fitted(page):
    view = page.locator("#detailViewport").bounding_box()
    image = page.locator("#detailMedia > :is(img, svg)").bounding_box()
    for start, length in (("x", "width"), ("y", "height")):
        assert view[start] <= image[start]
        assert image[start] + image[length] <= view[start] + view[length]


def close_viewer(page, button):
    page.keyboard.press("Escape")
    expect(page.locator("#detailZoom")).to_be_hidden()
    expect(button).to_be_focused()


def control_positions(page):
    return [page.locator(selector).bounding_box() for selector in
            ("#detailZoom", "#detailScale", "#detailClose", "#detailNext")]


def compact_viewer(page):
    height = page.viewport_size["height"]
    open_task(page, "2022-kit-4-5/18")
    button = page.locator("#openLegacyZoom")
    open_viewer(page, button)
    initial = control_positions(page)
    assert initial[0]["height"] < height * .45
    page.locator("#detailScale").click()
    assert control_positions(page) == initial
    close_viewer(page, button)

    open_task(page, "2004-medvezhonok-2-3/20")
    button = page.locator("#openLegacyZoom")
    open_viewer(page, button)
    initial = control_positions(page)
    assert initial[0]["height"] < height * .45
    page.locator("#detailNext").click()
    expect(page.locator("#detailScale")).to_be_enabled()
    assert control_positions(page) == initial
    img = page.locator("#detailImage")
    native_width = img.evaluate("(img) => img.naturalWidth")
    normal_width = img.bounding_box()["width"]
    assert native_width < normal_width <= native_width * 1.5
    expect(page.locator("#detailHint")).to_contain_text(str(native_width))
    page.locator("#detailScale").click()
    assert normal_width < img.bounding_box()["width"] <= native_width * 2
    assert control_positions(page) == initial
    close_viewer(page, button)

    open_task(page, "2020-3-4/5")
    button = page.locator('#scene [data-condition-item="4"]')
    open_viewer(page, button)
    assert page.locator("#detailMedia").bounding_box()["height"] > height * .75
    initial = control_positions(page)
    page.locator("#detailScale").click()
    assert control_positions(page) == initial
    close_viewer(page, button)


def pan(page, mobile):
    viewport = page.locator("#detailViewport")
    box = viewport.bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    left = viewport.evaluate("(node) => node.scrollLeft")
    if mobile:
        cdp = page.context.new_cdp_session(page)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        for step in range(1, 5):
            cdp.send("Input.dispatchTouchEvent", {
                "type": "touchMove", "touchPoints": [{"x": x - step * 15, "y": y}]
            })
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        cdp.detach()
    else:
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x - 60, y, steps=4)
        page.mouse.up()
    page.wait_for_function("left => document.querySelector('#detailViewport').scrollLeft > left", arg=left)


def choices(page, mobile):
    open_task(page, "2026-5-6/14")
    page.locator('[data-answer="2"]').click()
    button = page.locator("#openChoiceZoom")
    open_viewer(page, button)
    expect(page.locator("#detailTitle")).to_have_text("Вариант В")
    assert page.locator("#detailImage").get_attribute("src").startswith("data:image/svg+xml")
    assert page.locator("#detailZoom").bounding_box()["height"] < page.viewport_size["height"] * .45
    fit = page.locator("#detailImage").bounding_box()
    page.locator("#detailScale").click()
    assert page.locator("#detailImage").bounding_box()["width"] > fit["width"]
    pan(page, mobile)
    page.locator("#detailScale").click()
    assert_fitted(page)
    for letter in "ГД":
        page.keyboard.press("ArrowRight")
        expect(page.locator("#detailTitle")).to_have_text("Вариант " + letter)
        expect(page.locator("#detailScale")).to_be_enabled()
        assert_fitted(page)
    close_viewer(page, button)
    expect(page.locator('[data-answer="2"]')).to_have_attribute("aria-pressed", "true")
    page.reload()
    expect(page.locator('[data-answer="2"]')).to_have_attribute("aria-pressed", "true")


def mixed_gallery(page):
    open_task(page, "2019-chip-3-4/9")
    button = page.locator("#openChoiceZoom")
    open_viewer(page, button)
    initial = control_positions(page)
    for index, letter in enumerate("АБВГД"):
        if index:
            page.locator("#detailNext").click()
        expect(page.locator("#detailTitle")).to_have_text("Вариант " + letter)
        expect(page.locator("#detailScale")).to_be_enabled()
        assert_fitted(page)
        assert control_positions(page) == initial
        page.locator("#detailScale").click()
        assert control_positions(page) == initial
        page.locator("#detailScale").click()
        assert control_positions(page) == initial
    close_viewer(page, button)


def sources(page):
    open_task(page, "2004-5-6/15")
    button = page.locator("#openLegacyZoom")
    open_viewer(page, button)
    fit = page.locator("#detailMedia").bounding_box()
    page.locator("#detailScale").click()
    assert page.locator("#detailMedia").bounding_box()["width"] > fit["width"]
    close_viewer(page, button)

    open_task(page, "2024-3-4/7")
    open_viewer(page, page.locator("#openChoiceZoom"))
    expect(page.locator("#detailTitle")).to_have_text("Вариант А")
    close_viewer(page, page.locator("#openChoiceZoom"))

    open_task(page, "2015-chip-1-2/21")
    button = page.locator("#openChoiceZoom")
    open_viewer(page, button)
    source = page.evaluate("LESSONS[task].choiceLayout.options[0].detailSrc")
    assert page.locator("#detailImage").get_attribute("src") == source
    close_viewer(page, button)


def condition_items(page):
    open_task(page, "2015-chip-1-2/18")
    button = page.locator('#scene [data-condition-item="2"]')
    expect(page.locator("#scene [data-condition-item]")).to_have_count(6)
    assert button.evaluate("(node) => getComputedStyle(node, '::after').display") == "none"
    open_viewer(page, button)
    figure = page.evaluate("LESSONS[task].choiceLayout.condition.items[2]")
    expect(page.locator("#detailTitle")).to_have_text(figure["caption"])
    assert page.locator("#detailImage").get_attribute("src") == figure.get("detailSrc", figure["src"])
    expect(page.locator("#detailCredit")).to_be_hidden()
    expect(page.locator("#lessonIllustrationSources")).to_have_attribute("href", "assets/chip/illustrations.html")
    close_viewer(page, button)
    page.locator('[data-answer="0"]').click()
    page.locator("#next").click()
    expect(page.locator("#conditionPictures [data-condition-item]")).to_have_count(6)
    expect(page.locator("#conditionImage")).to_be_hidden()
    assert page.locator("#conditionPictures .named-figures").evaluate(
        "(grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length"
    ) >= 2
    open_viewer(page, page.locator('#conditionPictures [data-condition-item="0"]'))
    expect(page.locator("#detailCredit")).to_be_visible()
    close_viewer(page, page.locator('#conditionPictures [data-condition-item="0"]'))

    open_task(page, "2016-medvezhonok-2-3/24")
    figure = page.evaluate("LESSONS[task].choiceLayout.condition")
    button = page.locator("#openLegacyZoom")
    open_viewer(page, button)
    assert page.locator("#detailImage").get_attribute("src") == figure["detailItems"][0]["src"]
    close_viewer(page, button)
    page.locator('[data-answer="0"]').click()
    page.locator("#next").click()
    expect(page.locator("#conditionPictures")).to_be_hidden()
    expect(page.locator("#conditionImage")).to_have_attribute("src", figure["src"])


def workspace(page):
    open_task(page, "2024-3-4/1")
    page.locator('[data-answer="4"]').click()
    page.locator("#drawingWorkspace summary").first.click()
    page.locator('[data-tool="pen"]').click()
    layer = page.locator("#drawingLayer")
    layer.scroll_into_view_if_needed()
    box = layer.bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 15, y + 15, steps=4)
    page.mouse.up()
    expect(page.locator("#drawingMarks polyline")).to_have_count(1)
    button = page.locator("#openLegacyZoom")
    open_viewer(page, button)
    expect(page.locator("#detailMedia > svg")).to_have_attribute("aria-label", "Рисунок Д. " + page.evaluate("squareDescription(4)"))
    close_viewer(page, button)
    expect(page.locator("#drawingMarks polyline")).to_have_count(1)
    page.locator("#undoDrawing").click()
    expect(page.locator("#drawingMarks polyline")).to_have_count(0)
    page.locator("#next").click()
    open_viewer(page, page.locator("#openSceneZoom"))
    close_viewer(page, page.locator("#openSceneZoom"))


def review_choices(page):
    open_task(page, "2010-chip-3-4/1")
    page.locator('[data-answer="2"]').click()
    page.locator("#next").click()
    expect(page.locator("#answers")).to_be_hidden()
    button = page.locator("#openChoiceZoom")
    open_viewer(page, button)
    expect(page.locator("#detailTitle")).to_have_text("Вариант В")
    page.locator("#detailNext").click()
    expect(page.locator("#detailTitle")).to_have_text("Вариант Г")
    close_viewer(page, button)
    assert page.evaluate("current().selected") == 2

    open_task(page, "1998-9-10/11")
    page.locator('[data-answer="0"]').click()
    page.locator("#next").click()
    expect(page.locator("#openLegacyZoom")).to_be_visible()
    expect(page.locator("#openChoiceZoom")).to_be_visible()
    expect(page.locator("#openSceneZoom")).to_be_hidden()
    button = page.locator("#openLegacyZoom")
    open_viewer(page, button)
    if page.viewport_size["width"] >= 900:
        assert 430 <= page.locator("#detailZoom").bounding_box()["width"] <= 520
    initial = control_positions(page)
    fitted = page.locator("#detailImage").bounding_box()["width"]
    page.locator("#detailScale").click()
    assert page.locator("#detailImage").bounding_box()["width"] > fitted
    assert control_positions(page) == initial
    close_viewer(page, button)


def matching(page):
    open_task(page, "2004-golden-fleece-3-7/1")
    answers = page.evaluate("matchingParts().map(index => LESSONS[index].answer)")
    controls = page.locator("select[data-match]")
    for offset, answer in enumerate(answers):
        controls.nth(offset).select_option(str(answer))
    button = page.locator('[data-match-image="1"]')
    open_viewer(page, button)
    expect(page.locator("#detailTitle")).to_have_text("Рисунок 2")
    page.locator("#detailNext").click()
    expect(page.locator("#detailTitle")).to_have_text("Рисунок 3")
    close_viewer(page, button)
    page.reload()
    for offset, answer in enumerate(answers):
        expect(controls.nth(offset)).to_have_value(str(answer))
    page.evaluate("""() => {
        const saved = new Map();
        activeProfileId = 'viewer-test';
        accountProgress = {
            read: key => saved.get(key), write: (key, value) => saved.set(key, value),
            status: () => ({state: 'saved'}),
            confirmed: key => saved.get(key), confirmedAward: key => saved.get(key) === 'solved',
        };
    }""")
    page.locator("#next").click()
    assert page.evaluate("current().step") == 1
    assert page.evaluate("ratingAttempt.length") == len(answers)
    assert page.evaluate("ratingAttempt.reduce((total, row) => total + row.points, 0)") == page.evaluate(
        "matchingParts().reduce((total, i) => total + LESSONS[i].points, 0)"
    )
    for _ in answers:
        page.locator("#next").click()
    expect(page.locator("#feedback")).to_contain_text("Ответ")
    assert page.evaluate("matchingParts().every(i => states[i].selected === LESSONS[i].answer)")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which("chromium"))
    for width, height in ((320, 740), (390, 844), (1280, 900)):
        mobile = width < 500
        page = browser.new_page(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile)
        page.set_default_timeout(10000)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        compact_viewer(page)
        choices(page, mobile)
        mixed_gallery(page)
        sources(page)
        condition_items(page)
        workspace(page)
        review_choices(page)
        matching(page)
        assert not errors, errors
        print(f"Просмотрщик иллюстраций: {width} × {height}")
        page.close()
    browser.close()
