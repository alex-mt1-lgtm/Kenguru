"""Rebuild the standalone SVG artwork for the 2000 grade 5–6 booklet."""

from pathlib import Path


DESTINATION = Path(__file__).resolve().parents[1] / "dist/assets/grades-5-6/2000"
INK = "#211e1b"


def save(name, width, height, body, view_box=None):
    view_box = view_box or f"0 0 {width} {height}"
    (DESTINATION / f"{name}.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="{view_box}" color="{INK}">\n{body.strip()}\n</svg>\n'
    )


def clock(mirrored, show_hour):
    ticks = "\n".join(
        f'  <path d="M110 48v-11" transform="rotate({angle} 110 132)"/>'
        for angle in range(0, 360, 30)
    )
    # In the booklet the long hand points horizontally right and the short
    # hand points 18 degrees up from it. The drawing uses open arrowheads.
    hands = '<path d="M110 132h80m-18 -5 18 5-18 5"/>'
    if show_hour:
        hands += '\n  <path d="M110 132h55m-15 -5 15 5-15 5" transform="rotate(-18 110 132)"/>'
    reflection = '' if mirrored else ' transform="translate(220 0) scale(-1 1)"'
    numeral = ' transform="translate(220 0) scale(-1 1)"' if mirrored else ''
    return f"""
<circle cx="110" cy="132" r="89" fill="none" stroke="currentColor" stroke-width="2.5"/>
<g fill="none" stroke="currentColor" stroke-width="4">
{ticks}
</g>
<text x="110" y="30" text-anchor="middle" fill="currentColor"
      font-family="Arial,sans-serif" font-size="27" font-weight="700"{numeral}>12</text>
<g fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"
   stroke-linejoin="round"{reflection}>
  {hands}
</g>
"""


def kangaroo():
    # Keep each connection in the original graph. The upper arm forms a loop
    # with the join below B. C terminates at the end of the rear foot and D
    # connects that end to the leg and to the outer contour.
    return """
<g fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M109 86
    C123 102 155 98 165 76
    C153 62 152 42 159 27
    C171 39 179 48 181 64
    C193 47 214 48 232 44
    C231 62 222 73 198 74
    C213 106 199 126 207 169
    C215 222 233 287 261 317
    C292 349 349 362 385 356
    C351 383 283 395 231 349
    C183 376 123 392 101 383
    C79 374 93 358 128 353"/>
  <path d="M109 86C114 118 143 114 159 120Q167 134 174 172"/>
  <path d="M174 172C147 190 115 185 94 177C84 174 79 185 91 191Q117 205 140 202"/>
  <path d="M174 172Q160 194 140 202"/>
  <path d="M140 202
    C126 212 105 227 94 234C79 249 111 251 135 239Q156 229 169 215
    C171 230 180 246 188 255C184 270 154 271 140 269
    C139 286 162 311 174 321
    C147 326 104 315 87 326C58 345 102 353 128 353"/>
  <path d="M128 353Q151 352 172 342"/>
</g>
<g fill="currentColor">
  <circle cx="174" cy="172" r="8"/>
  <circle cx="172" cy="342" r="8"/>
  <circle cx="128" cy="353" r="8"/>
  <g font-family="Arial,sans-serif" font-size="44">
    <text x="66" y="94">A</text><text x="125" y="167">B</text>
    <text x="181" y="344">C</text><text x="46" y="381">D</text>
  </g>
</g>
"""


def cube_net():
    return """
<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">
  <path d="M16 16h60v60h120v60h60v60H136v-60H16zM16 76h60v60m0 0h120m-60 -60v60m60 0v60"/>
  <path d="M76 76l13 -16h34l13 16 13 -16h34l13 16 15 15v30l-15 15
           m-60 0-15 15v30l15 15 15 15h30l15 -15 15 15h30l15 -15
           m0 -60 15 15v30l-15 15"/>
</g>
<g fill="currentColor" font-family="Arial,sans-serif" font-size="33" font-weight="700"
   text-anchor="middle">
  <text x="46" y="58">A</text>
  <text x="46" y="118">B</text><text x="106" y="118">X</text><text x="166" y="118">C</text>
  <text x="166" y="178">D</text><text x="226" y="178">E</text>
</g>
"""


def shaded_rectangle():
    dots = "\n".join(
        f'  <circle cx="{x}" cy="{y}" r="3.8"/>'
        for x, y in [
            *((x, y) for x in (12, 84.5, 157, 229.5, 302) for y in (9.5, 154.5)),
            (12, 82), (302, 82),
        ]
    )
    return f"""
<g stroke="currentColor" stroke-width="2" stroke-linejoin="round">
  <path d="M12 9.5h290v145H12z" fill="none"/>
  <path d="M12 82 84.5 9.5h145L302 82l-72.5 72.5h-145z
           M84.5 82 157 9.5l72.5 72.5-72.5 72.5z"
        fill="#aaa" fill-rule="evenodd"/>
</g>
<g fill="currentColor">
{dots}
  <g font-family="Arial,sans-serif" font-size="28" font-style="italic" font-weight="700"
     text-anchor="middle">
    <text x="115" y="92">A</text><text x="157" y="51">B</text>
    <text x="202" y="92">C</text><text x="157" y="133">D</text>
  </g>
</g>
"""


def paper_strip():
    return """
<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19 116 70 27l51 89z" fill="#b8b8b8"/>
  <path d="M70 27h164m50 0h164l-51 89H284m-54 0H121"/>
  <path d="M121 116 172 27l51 89m72 0 51 -89 51 89" stroke-dasharray="3 6" stroke-width="2"/>
</g>
<g fill="currentColor" font-family="Arial,sans-serif" font-size="22" font-style="italic">
  <text x="4" y="140">A</text><text x="48" y="22">B</text>
  <text x="114" y="140">C</text><text x="166" y="21">D</text>
</g>
<g fill="currentColor">
  <circle cx="245" cy="28" r="1.8"/><circle cx="255" cy="28" r="1.8"/><circle cx="265" cy="28" r="1.8"/>
  <circle cx="245" cy="117" r="1.8"/><circle cx="255" cy="117" r="1.8"/><circle cx="265" cy="117" r="1.8"/>
</g>
"""


def triangle_choice(vertices):
    left, right, bottom = vertices
    return f"""
<path d="M23 28h54L50 74z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
<g fill="currentColor" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-style="italic">
  <text x="24" y="21">{left}</text><text x="76" y="21">{right}</text><text x="50" y="90">{bottom}</text>
</g>
"""


def dice_stack():
    divider = "\n".join(
        f'  <path d="M18 {45 + level * 77} 96 {96 + level * 77}l79 -26"/>'
        for level in range(1, 5)
    )
    center = (0.5, 0.5)
    diagonal = [(0.23, 0.24), (0.77, 0.76)]
    four = diagonal + [(0.23, 0.76), (0.77, 0.24)]
    five = four + [center]
    pips = []
    for column in (0.2, 0.46, 0.72):
        for row in (0.24, 0.76):
            pips.append((18 + 78 * (column + row), 45 + 51 * column - 26 * row))
    for level, (left, right) in enumerate(zip((five, four, [center], diagonal), (four, [center], five, four))):
        pips.extend((18 + 78 * x, 45 + 77 * (level + y) + 51 * x) for x, y in left)
        pips.extend((96 + 79 * x, 96 + 77 * (level + y) - 26 * x) for x, y in right)
    dots = "\n".join(f'  <circle cx="{x:.2f}" cy="{y:.2f}" r="6.3"/>' for x, y in pips)
    return f"""
<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">
  <path d="M18 45 96 19l79 51v308l-79 26-78-51zM18 45l78 51 79-26M96 96v308"/>
{divider}
</g>
<g fill="currentColor">
{dots}
</g>
"""


def drilled_cube():
    # Coordinates for each view use the common four-by-four grid.
    faces = [
        ("translate(14 96) scale(44)", [(2.5, 1.5), (1.5, 2.5)]),
        ("matrix(44 0 20 -20 14 96)", [(1.5, 2.5), (2.5, 1.5)]),
        ("matrix(20 -20 0 44 190 96)", [(1.5, 1.5), (2.5, 2.5)]),
    ]
    grid = '<path d="M0 0h4v4H0zM1 0v4m1-4v4m1-4v4M0 1h4m-4 1h4m-4 1h4" fill="none" vector-effect="non-scaling-stroke"/>'
    body = ""
    for transform, holes in faces:
        dots = "".join(
            f'<circle cx="{x}" cy="{y}" r=".23" fill="#aaa" vector-effect="non-scaling-stroke"/>'
            for x, y in holes
        )
        body += f'  <g transform="{transform}">{grid}{dots}</g>\n'
    return f"""
<g stroke="currentColor" stroke-width="2.2" stroke-linejoin="round">
{body}</g>
"""


def square_grids():
    return """
<g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round">
  <path d="M14 14h144v144H14zM50 14v144m36 -144v144m36 -144v144M14 50h144m-144 36h144m-144 36h144"/>
  <path d="M206 14h72v72h72v72H206zM242 14v144m36 -72v72m36 -72v72M206 50h72m-72 36h72m-72 36h144"/>
</g>
"""


def main():
    save("condition-01", 220, 236, clock(mirrored=True, show_hour=True))
    save("clock-minute-01", 220, 236, clock(mirrored=False, show_hour=False))
    save("condition-03", 230, 236, kangaroo(), "30 10 370 380")
    save("condition-09", 286, 226, cube_net())
    save("condition-13", 314, 164, shaded_rectangle())
    save("condition-20", 460, 148, paper_strip())
    for option, vertices in zip("abcde", ("CAB", "ABC", "BCA", "ACB", "BAC")):
        save(f"choice-20-{option}", 100, 96, triangle_choice(vertices))
    save("condition-26", 134, 293, dice_stack(), "0 0 192 420")
    save("condition-28", 294, 284, drilled_cube())
    save("condition-30", 364, 172, square_grids())


if __name__ == "__main__":
    main()
