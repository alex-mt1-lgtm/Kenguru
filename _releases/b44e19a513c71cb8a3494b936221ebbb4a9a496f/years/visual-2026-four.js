'use strict';

(() => {
  const V = globalThis.KenguruVisual;
  const ink = '#172e34';
  const teal = '#237e79';
  const orange = '#e9693e';
  const gold = '#efc466';
  const mint = '#eaf0e6';
  const cream = '#fffdf6';
  const gray = '#aebbb6';
  const letters = ['А', 'Б', 'В', 'Г', 'Д'];
  const start = ['Условие', 'Условие задачи', 'Выбери ответ.'];

  const label = (x, y, value, size = 19, fill = ink, extra = '') =>
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${fill}" font-size="${size}" font-weight="650" ${extra}>${V.escape(value)}</text>`;
  const rect = (x, y, w, h, fill = cream, stroke = ink, extra = '') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${extra}/>`;
  const dot = (x, y, r, fill = cream, stroke = ink) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  const path = (d, fill = 'none', stroke = ink, width = 2, extra = '') =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
  const outline = (points, fill, stroke = ink, width = 2) =>
    path('M' + points.map((p) => p.join(' ')).join('L') + 'Z', fill, stroke, width);
  const polyline = (points, stroke = ink, width = 2) =>
    path('M' + points.map((p) => p.join(' ')).join('L'), 'none', stroke, width);
  const move = (x, y, contents, scale = 1) =>
    `<g transform="translate(${x} ${y}) scale(${scale})">${contents}</g>`;
  const fade = (frame, contents, delay = 0) => `<g opacity="${V.reveal(frame, delay)}">${contents}</g>`;
  const svg = (markup, title) => V.svg(markup, title, '0 0 640 300');
  const card = (x, y, w, h, value, fill = mint, size = 20) =>
    rect(x, y, w, h, fill, 'none', 'rx="12"') + label(x + w / 2, y + h / 2 + 1, value, size);
  const answer = (value, y = 267) => label(320, y, value, 29, teal);
  const dataImage = (contents, viewBox) =>
    'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${contents}</svg>`);

  function car(x, y, scale = 1, paint = mint) {
    const body = path('M5 44V29l12-5 10-19h44l17 20 11 6v13Z', paint, ink, 2.5)
      + rect(23, 14, 57, 18, cream, 'none', 'rx="7"')
      + [35, 51, 67].map((px) => dot(px, 23, 4, teal, 'none')).join('')
      + dot(24, 44, 7, ink) + dot(79, 44, 7, ink)
      + dot(24, 44, 2, cream, 'none') + dot(79, 44, 2, cream, 'none');
    return move(x, y, body, scale);
  }

  function excursion(step, frame) {
    if (step === 0) return svg(car(205, 27, 2.2) + label(320, 163, 'По 3 человека в машине', 25)
      + card(56, 210, 160, 46, '30 туристов', mint, 17)
      + card(240, 210, 160, 46, 'Интервал 2 мин', mint, 17)
      + card(424, 210, 160, 46, 'Поездка 10 мин', mint, 17), 'Экскурсионный автомобиль с тремя пассажирами.');
    if (step === 1) {
      const groups = Array.from({length: 10}, (_, i) => {
        const x = 54 + i % 5 * 112;
        const y = 42 + Math.floor(i / 5) * 101;
        return fade(frame, car(x, y, .83, i === 9 ? gold : mint) + label(x + 44, y + 65, `№ ${i + 1}`, 17), i * .22);
      }).join('');
      return svg(groups + fade(frame, answer('30 : 3 = 10 машин'), 2), 'Тридцать пассажиров занимают десять машин.');
    }
    if (step === 2) {
      const ticks = Array.from({length: 10}, (_, i) => {
        const x = 73 + i * 55;
        const time = '13:' + String(i * 2).padStart(2, '0');
        return fade(frame, dot(x, 138, i === 9 ? 8 : 5, i === 9 ? gold : teal, 'none')
          + label(x, i % 2 ? 176 : 101, time, 16) + label(x, 216, i + 1, 14, teal), i * .3);
      }).join('');
      return svg(path('M73 138H568', 'none', teal, 4) + ticks + fade(frame, answer('9 интервалов по 2 минуты = 18 минут'), 2.5),
        'Время отправления всех десяти машин отмечено на шкале.');
    }
    const x = 117 + 303 * V.reveal(frame);
    return svg(path('M120 175H520', 'none', teal, 5, 'stroke-dasharray="9 7"') + car(x, 108, .86, gold)
      + dot(120, 175, 7, teal, 'none') + dot(520, 175, 7, orange, 'none')
      + label(120, 208, '13:18', 23) + fade(frame, label(520, 208, '13:28', 23, teal), 1)
      + label(320, 61, 'Последняя машина в пути 10 минут', 22)
      + fade(frame, answer('13:18 + 10 минут = 13:28'), 2), 'Последняя машина движется от точки отправления к точке возвращения.');
  }

  const shape = [[0,0],[1,1],[2,0],[6,0],[6,4],[5,5],[4,4],[0,4]];
  const cuts = [
    [[0,2],[1,3],[2,2],[4,2],[5,3],[6,2]],
    [[2,0],[3,1],[2,2],[4,2],[4,4]],
    [[0,2],[1,3],[2,2],[6,2]],
    [[2,0],[3,1],[2,2],[3,3],[4,2],[5,3],[4,4]],
    [[2,0],[3,1],[2,2],[3,3],[4,2],[6,2]]
  ];
  const cutLeft = [...cuts[3], [0,4],[0,0],[1,1]];
  const cutRight = [[2,0],[6,0],[6,4],[5,5],[4,4],...cuts[3].slice(1,-1).reverse()];
  const cutDiagram = (index) => outline(shape, '#dfe5df', ink, .055)
    + path('M0 2H6M2 0V4M4 0V4', 'none', '#5b706b', .035, 'stroke-dasharray=".09 .12"')
    + polyline(cuts[index], ink, .115);
  const cutChoices = cuts.map((_, i) => dataImage(cutDiagram(i), '-.15 -.15 6.3 5.3'));

  function cutScene(step, frame) {
    if (step === 0) return svg(move(202, 33, outline(shape, '#dfe5df', ink, .055)
      + path('M0 2H6M2 0V4M4 0V4', 'none', '#5b706b', .035, 'stroke-dasharray=".09 .12"'), 39),
      'Фигура с выемкой слева сверху и выступом справа снизу. Возможные разрезы показаны в ответах.');
    if (step < 3) {
      const elimination = step === 1 ? [0,4] : [0,1,2,4];
      const examples = cuts.map((_, i) => {
        const x = 29 + i * 119;
        const diagram = move(x, 100, cutDiagram(i), 17);
        const cross = path('M-5-5L107 90M107-5L-5 90', 'none', orange, 4);
        return diagram + label(x + 51, 71, letters[i], 24)
          + (step > 0 && elimination.includes(i) ? move(x, 100, fade(frame, cross, i * .25)) : '');
      }).join('');
      const notes = step === 1 ? label(320, 252, 'А и Д: площади частей различаются', 25, teal)
        : step === 2 ? label(320, 252, 'Б и В: контуры частей различаются', 25, teal) : '';
      return svg(examples + fade(frame, notes), 'Пять разрезов одной фигуры по жирным линиям.');
    }
    const p = V.reveal(frame);
    const mirror = `matrix(${1 - p} ${p} ${p} ${1 - p} 0 ${-2 * p})`;
    const pieces = outline(cutLeft, '#c7e2d3', teal, .06)
      + `<g transform="${mirror}" fill-opacity=".63">${outline(cutRight, gold, orange, .08)}</g>`;
    return svg(move(160, 38, pieces, 38) + label(471, 117, 'Части совпадают', 23, teal)
      + fade(frame, answer('Подходит разрез Г'), 1), 'В варианте Г одна половина переворачивается и накладывается на другую.');
  }

  function digitalClock(value, x, y, scale = 1, swap = 0, mark = false) {
    const positions = [28, 72, 133, 177];
    const background = rect(0, 0, 205, 69, ink, 'none', 'rx="11"');
    const digits = [...value].map((digit, i) => {
      const offset = i === 1 ? 61 * swap : i === 2 ? -61 * swap : 0;
      const lift = (i === 1 ? -1 : i === 2 ? 1 : 0) * 44 * Math.sin(Math.PI * swap);
      const color = mark && (i === 1 || i === 2) ? gold : cream;
      return label(positions[i] + offset, 36 + lift, digit, 40, color, 'font-family="monospace"');
    }).join('');
    return move(x, y, background + label(102, 35, ':', 40, cream, 'font-family="monospace"') + digits, scale);
  }

  function clocks(step, frame) {
    if (step === 0) return svg(digitalClock('1569', 185, 89, 1.3)
      + label(320, 239, 'Переставлены две цифры', 24), 'Электронные часы показывают 15:69.');
    if (step === 1) {
      const examples = digitalClock('6519', 73, 111, .94, 0, true) + digitalClock('1659', 371, 111, .94, 0, true);
      return svg(label(320, 55, 'Цифру 6 нужно убрать из десятков минут', 24)
        + fade(frame, examples) + fade(frame, label(169, 213, 'Часы: 65 — невозможно', 20, orange), 1)
        + fade(frame, label(470, 213, 'Время 16:59 возможно', 20, teal), 2),
        'Два кандидата для истинного времени: 65:19 и 16:59.');
    }
    const p = V.reveal(frame);
    if (step === 2) return svg(digitalClock('1569', 96, 103, 1.02, p, true)
      + label(476, 111, 'Меняем разряды', 21) + fade(frame, label(476, 162, '16:59', 32, teal), 2)
      + label(320, 246, 'Теперь можно прибавить минуту', 23),
      'На табло меняются местами единицы часов и десятки минут.');
    return svg(digitalClock('1700', 91, 104, 1.05, p, true)
      + label(474, 98, '16:59 + 1 мин', 23) + label(474, 142, 'Истинное время: 17:00', 19)
      + fade(frame, answer('Табло покажет 10:70'), 2),
      'После смены минуты в числе 17:00 снова меняются местами две цифры.');
  }

  const foldChoices = [
    [[1,0],[2,3],[4,4],[7,7],[8,9]],
    [[0,1],[2,3],[4,5],[7,6],[8,9]],
    [[1,0],[3,2],[4,5],[6,7],[9,8]],
    [[0,1],[3,2],[5,4],[7,6],[8,9]],
    [[0,1],[2,3],[5,4],[6,7],[9,8]]
  ];

  function strip(creases, colors = []) {
    return rect(0, 0, 10, 1, cream, ink, 'style="stroke-width:.055"')
      + creases.map(([top, bottom], i) => polyline([[top, 0], [bottom, 1]], colors[i] || ink, colors[i] ? .085 : .047)).join('');
  }

  const foldChoiceImages = foldChoices.map((creases) => dataImage(strip(creases), '-.15 -.25 10.3 1.5'));
  const foldedVisible = [
    [[0,1],[1,0],[1,1]],
    [[1,0],[2,0],[3,1],[1,1]],
    [[2,1],[3,1],[3,3],[2,2]],
    [[3,2],[4,2],[5,3],[3,3]],
    [[4,3],[5,3],[5,4],[4,5]],
    [[3,4],[4,4],[4,5],[3,5]]
  ];
  const foldedParts = [
    [[0,0],[0,1],[1,1]],
    [[0,0],[3,0],[2,1],[1,1]],
    [[3,0],[5,0],[4,1],[2,1]],
    [[5,0],[7,0],[6,1],[4,1]],
    [[7,0],[8,0],[9,1],[6,1]],
    [[8,0],[10,0],[10,1],[9,1]]
  ];

  function reflectedPaper(turns) {
    const parts = foldedParts.map((points) => points.map(([x, y]) => [x, y]));
    const folds = foldChoices[3].map(([top, bottom]) => [[top, 0], [bottom, 1]]);
    for (let n = 0; n < Math.ceil(turns); n++) {
      const degree = Math.min(1, turns - n);
      const [[a, b], [c, d]] = folds[n];
      const slope = (d - b) / (c - a);
      const reflect = ([x, y]) => [
        x * (1 - degree) + ((y - b) * slope + a) * degree,
        y * (1 - degree) + ((x - a) * slope + b) * degree
      ];
      for (let i = n + 1; i < parts.length; i++) parts[i] = parts[i].map(reflect);
      for (let i = n + 1; i < folds.length; i++) folds[i] = folds[i].map(reflect);
    }
    const angle = turns / 5 * Math.PI / 2;
    const renderParts = parts.map((points) => points.map(([x,y]) => [
      Math.cos(angle) * x + Math.sin(angle) * y,
      -Math.sin(angle) * x + Math.cos(angle) * y
    ]));
    const all = renderParts.flat();
    const minX = Math.min(...all.map(([x]) => x));
    const maxX = Math.max(...all.map(([x]) => x));
    const minY = Math.min(...all.map(([,y]) => y));
    const maxY = Math.max(...all.map(([,y]) => y));
    const unit = Math.min(39, 500 / (maxX - minX), 177 / (maxY - minY));
    const shape = renderParts.map((points, i) => outline(points, i <= Math.floor(turns) && i % 2 ? '#b9c3bc' : cream, ink, .045));
    return move(320 - (minX + maxX) * unit / 2, 129 - (minY + maxY) * unit / 2, shape.reverse().join(''), unit);
  }

  function foldedStrip(step, frame) {
    const folded = foldedVisible.map((points, i) => outline(points, i % 2 ? '#b9c3bc' : cream, ink, .052)).join('');
    if (step === 0) return svg(move(200, 30, folded, 46), 'Полоска после пяти сгибов образует ступенчатую фигуру.');
    if (step === 1) {
      const seams = [[[0,1],[1,0]], [[2,0],[3,1]], [[2,2],[3,3]], [[4,2],[5,3]], [[5,4],[4,5]]];
      return svg(move(102, 28, folded, 43)
        + move(102, 28, seams.map((edge, i) => fade(frame, polyline(edge, i === 0 || i === 4 ? orange : teal, .11), i * .5)).join(''), 43)
        + label(471, 115, 'Пять линий сгиба', 24) + fade(frame, label(471, 167, 'Три средние', 21, teal), 1),
        'Последовательно выделены пять видимых границ между сторонами сложенной полоски.');
    }
    if (step === 2) {
      const choices = foldChoices.map((crease, i) => {
        const colors = [null, teal, teal, teal, null];
        if (i !== 3) colors[1 + (i === 1 ? 2 : i === 4 ? 1 : i === 2 ? 0 : 0)] = orange;
        return label(73, 36 + i * 52, letters[i], 20) + move(124, 16 + i * 52, strip(crease, colors), 36);
      }).join('');
      return svg(choices, 'Пять вариантов развёртки. Выделены три средние линии сгиба в каждом.');
    }
    const turns = 5 * (1 - V.reveal(frame, .5));
    return svg(reflectedPaper(turns) + fade(frame, answer('Подходит полоска Г'), 2),
      'Ступенчатая фигура разворачивается в прямоугольную полоску с тремя параллельными сгибами посередине.');
  }

  function numberRows(step, frame) {
    const rows = [[[237,59],[311,59]], [[163,131],[237,131],[311,131]], [[163,203],[237,203]]];
    const solution = [[5,2], [6,0,1], [3,4]];
    const links = path('M237 59H311V131H163V203H237V59');
    const circles = rows.map((row, r) => row.map(([x,y], i) => {
      const value = solution[r][i];
      const selected = step >= 2 && value === 0;
      return dot(x, y, 24, selected ? gold : r === 1 ? mint : cream, selected ? teal : ink)
        + (step >= 3 || selected ? fade(frame, label(x, y + 1, value, 23), i * .2) : '');
    }).join('')).join('');
    const values = step < 3 ? [0,1,2,3,4,5,6].map((value, i) => {
      const x = 129 + i * 64;
      const opacity = step >= 2 && value === 0 ? .25 : 1;
      return `<g opacity="${opacity}">` + dot(x, 264, 16, value === 0 && step === 2 ? gold : cream, teal)
        + label(x, 265, value, 18) + '</g>';
    }).join('') : '';
    const sums = step > 0 ? rows.map((row, i) => fade(frame, label(365, row[0][1], '= 7', 21, teal), i * .3)).join('') : '';
    const caption = step === 1 ? label(492, 96, '21 : 3 = 7', 28, teal)
      : step === 2 ? label(489, 104, 'В паре 0 + 7', 24) + label(489, 147, 'Но 7 нет', 21, orange)
      : step === 3 ? label(513, 139, '6 · 0 · 1 = 0', 27, teal) : '';
    return svg(links + circles + values + sums + fade(frame, caption), 'Семь кружков образуют два ряда по два и средний ряд из трёх кружков.');
  }
  const oneToSixteen = Array.from({length: 16}, (_, i) => [i + 1]);
  const foldStacks = (groups) => groups.slice(0, groups.length / 2)
    .map((group, i) => group.concat(groups[groups.length - i - 1]));
  const paperGroups = [oneToSixteen];
  for (let i = 0; i < 3; i++) paperGroups.push(foldStacks(paperGroups[i]));

  function cellRow(values, y, side = 32, options = {}) {
    const left = (640 - values.length * side) / 2;
    const { highlight = [], drawDelay, frame = 0, subtext } = options;
    return values.map((value, i) => {
      const x = left + i * side;
      const selected = highlight.includes(i);
      const tile = rect(x, y, side, side, selected ? gold : cream, selected ? teal : ink)
        + label(x + side / 2, y + side / 2 + 1, value, side >= 42 ? 23 : 16)
        + (subtext ? label(x + side / 2, y + side + 21, subtext[i], 14, teal) : '');
      return drawDelay ? fade(frame, tile, i * drawDelay) : tile;
    }).join('');
  }

  function foldingNumbers(step, frame) {
    if (step === 0) {
      const pictures = [[16, 26, 30], [8, 112, 37], [2, 199, 43]];
      return svg(pictures.map(([count, y, side], i) =>
        cellRow(Array.from({length: count}, (_, n) => n + 1), y, side)
        + label(320, y + side + 20, `Рисунок ${i + 1}`, 16)).join(''),
      'Полоска клеток до сгиба, после первого сгиба и после последнего сгиба.');
    }
    if (step <= 3) {
      const previous = paperGroups[step - 1];
      const width = step === 1 ? 31 : step === 2 ? 52 : 62;
      const getSum = (group) => group.reduce((a,b) => a + b, 0);
      const values = previous.map(getSum);
      const folded = paperGroups[step].map(getSum);
      const half = values.length / 2;
      const xStart = (640 - values.length * width) / 2;
      const progress = V.reveal(frame);
      const ghost = values.slice(half).map((value, i) => {
        const source = xStart + (half + i) * width;
        const target = xStart + (half - 1 - i) * width;
        const x = source + (target - source) * progress;
        const y = 57 - 31 * Math.sin(Math.PI * progress);
        return rect(x, y, width, width, gold, orange, 'fill-opacity=".62"')
          + label(x + width / 2, y + width / 2 + 1, value, width < 40 ? 16 : 21);
      }).join('');
      const original = cellRow(values, 57, width, {highlight: [0]});
      const foldPairs = step === 1 ? paperGroups[step].map((group) => group.join('+')) : undefined;
      const foldedRow = cellRow(folded, 155, step === 1 ? 54 : 65, {highlight: [0], subtext: foldPairs});
      const note = step === 1 ? 'Каждая пара даёт 17' : step === 2 ? '17 + 17 = 34' : '34 + 34 = 68';
      return svg(original + ghost + path('M320 39v94', 'none', teal, 2, 'stroke-dasharray="5 5"')
        + fade(frame, foldedRow, 1) + fade(frame, answer(note, 274), 2),
        'Правая половина полоски перемещается на левую, и значения соседних слоёв складываются.');
    }
    const pierced = paperGroups[3][0].map((n) => n - 1);
    return svg(label(320, 52, 'Проколы после разворачивания', 25)
      + fade(frame, cellRow(oneToSixteen.map(([n]) => n), 109, 31, {highlight: pierced}))
      + fade(frame, label(320, 193, 'Четыре пары по 17', 22, teal), 1)
      + fade(frame, answer('1 + 4 + 5 + 8 + 9 + 12 + 13 + 16 = 68'), 2),
      'Восемь проколотых клеток на развёрнутой полоске выделены золотым цветом.');
  }

  const blade = [[-2, 0], [-1, -1], [0, -1], [0, 0]];
  const bladeShape = (fill) => outline(blade, fill, ink, .046);
  const bladeColors = ['#cee7d8', '#f6e1a8', '#f5d2c3', '#dce9e5'];
  const rotate = (angle, contents) => `<g transform="rotate(${angle})">${contents}</g>`;

  function pinwheel(step, frame) {
    const combined = (spread, fill) => Array.from({length: 4}, (_, i) =>
      rotate(i * 90, move(-spread, -spread, bladeShape(fill(i))))).join('');
    const seams = Array.from({length: 4}, (_, i) => rotate(i * 90,
      path('M0 0V-1', 'none', orange, .086, 'stroke-dasharray=".12 .09"'))).join('');
    if (step === 0) {
      return svg(move(194, 143, bladeShape(cream), 55) + label(211, 88, 'A', 21) + label(211, 146, 'B', 21)
        + move(466, 137, combined(0, () => cream), 47)
        + label(143, 216, 'Рисунок 1', 18) + label(466, 256, 'Рисунок 2', 18),
        'Одна трапеция с прямыми углами A и B и вертушка из четырёх таких трапеций.');
    }
    const spread = step === 1 ? .24 : step === 2 ? .24 * (1 - V.reveal(frame)) : 0;
    const pin = move(219, 131, combined(spread, (i) => bladeColors[i]), 43);
    if (step === 1) return svg(pin + fade(frame, label(492, 110, '4 отдельные детали', 22))
      + fade(frame, label(492, 164, '4 · 22 = 88 см', 27, teal), 1),
      'Четыре одинаковые трапеции разъединены, чтобы считать их периметры отдельно.');
    const interior = move(219, 131, fade(frame, seams, .6), 43);
    const differences = step === 2 ? label(483, 112, '4 внутренних стыка', 23)
      + label(483, 157, 'Каждый длиной AB', 21, teal)
      : fade(frame, label(481, 82, '88 − 56 = 32 см', 26) + label(481, 128, '8 · AB = 32 см', 25)
        + label(481, 186, 'AB = 4 см', 29, teal), 1);
    return svg(pin + interior + differences, 'Четыре стыка внутри вертушки отмечены пунктиром.');
  }

  const candy = (x, y, scale = 1, fill = gold) => move(x, y,
    path('M-12 0l-7-6v12Z M12 0l7-6v12Z', fill, ink, 1.5)
    + rect(-12, -8, 24, 16, fill, ink, 'rx="6"'), scale);

  function sweets(step, frame) {
    const names = ['Никита', 'Петя', 'Саша'];
    const centers = [153, 320, 487];
    if (step === 0) {
      const first = centers.map((x, i) => card(x - 70, 93, 140, 104, '', i === 1 ? '#faebbf' : mint)
        + label(x, 120, names[i], 22)
        + Array.from({length: i + 1}, (_, j) => candy(x + (j - i / 2) * 37, 163, .7)).join(''));
      return svg(label(320, 53, 'Первые три хода', 24) + first.join('')
        + label(320, 242, 'У Пети всего 25 ирисок', 23), 'Никита берёт одну ириску, Петя две, Саша три.');
    }
    if (step <= 2) {
      const schedule = Array.from({length: 4}, (_, turn) => Array.from({length: 3}, (_, child) => {
        const planned = turn * 3 + child + 1;
        const value = step === 2 && planned === 11 ? '10' : step === 2 && planned === 12 ? '—' : planned;
        const accent = child === 1;
        const bg = accent ? (turn === 3 && step === 2 ? gold : '#faebbf') : mint;
        return fade(frame, card(centers[child] - 67, 60 + turn * 42, 134, 35, value, bg, 19), turn * .5);
      }).join('')).join('');
      const footer = step === 1 ? 'У Пети: 2 → 7 → 15 → 26' : 'Петя: 15 + 10 = 25';
      return svg(names.map((name, i) => label(centers[i], 33, name, 19, i === 1 ? teal : ink)).join('')
        + schedule + fade(frame, answer(footer), 2), 'Число ирисок в каждом круге ходов, по столбцу для каждого мальчика.');
    }
    const turns = Array.from({length: 11}, (_, i) => {
      const x = 43 + (i % 6) * 92;
      const y = 64 + Math.floor(i / 6) * 71;
      const value = Math.min(i + 1, 10);
      return fade(frame, card(x, y, 79, 53, '', i === 10 ? '#faebbf' : mint)
        + candy(x + 22, y + 26, .63) + label(x + 56, y + 27, value, 19), i * .22);
    }).join('');
    return svg(turns + fade(frame, answer('1 + 2 + … + 10 + 10 = 65'), 2),
      'Десять обычных ходов и последний ход Пети, который забрал оставшиеся десять ирисок.');
  }

  const grayBand = [[0,0,6,29], [6,0,29,6], [29,6,6,29], [0,29,29,6]];
  const whiteBand = [[6,6,8,15], [14,6,15,8], [21,14,8,15], [6,21,15,8]];

  function squareBands(step, frame) {
    const unit = 6;
    const origin = [138, 45];
    const render = ([x,y,w,h], fill, stroke = ink) =>
      rect(x, y, w, h, fill, stroke, 'style="stroke-width:.255"');
    const squares = grayBand.map((brick,i) => render(brick, step === 3 && i <= 1 ? gold : gray)).join('')
      + whiteBand.map((brick,i) => render(brick, step === 1 && i <= 1 ? '#d4e8d9' : cream)).join('')
      + render([14,14,7,7], ink);
    const diagram = move(...origin, squares, unit);
    const names = label(123, 45, 'A', 21) + label(362, 45, 'B', 21) +
      label(362, 255, 'C', 21) + label(123, 255, 'D', 21);
    const given = path('M174 31H348m-174-5v10m174-10v10 M362 129v90m-5-90h10m-10 90h10 M222 267h42m-42-5v10m42-10v10')
      + label(262, 18, '29 см', 16) + label(390, 174, '15 см', 16) + label(243, 286, '7 см', 16);
    if (step === 0) return svg(diagram + names + given, 'Квадрат из серых и белых прямоугольников с чёрным квадратом в центре.');
    let details;
    if (step === 1) details = path('M174 127h48 M222 127h42', 'none', teal, 3)
      + label(196, 115, '8', 17, teal) + label(244, 115, '7', 17, teal)
      + label(506, 111, 'Белая полоса', 22) + label(506, 164, '15 − 7 = 8 см', 25, teal);
    else if (step === 2) details = path('M174 221h138m-138-5v10m138-10v10', 'none', teal, 3)
      + label(242, 209, '23', 18, teal) + label(507, 101, 'Внутри: 15 + 8 = 23 см', 18)
      + label(506, 161, '29 − 23 = 6 см', 24, teal);
    else details = path('M138 45h36', 'none', orange, 5) + path('M174 45h174', 'none', teal, 5)
      + label(156, 63, '6', 17, ink) + label(503, 139, 'AB = 6 + 29 = 35 см', 23, teal);
    return svg(diagram + names + given + fade(frame, details),
      'Вложенные прямоугольники помогают последовательно найти короткие стороны и сторону внешнего квадрата.');
  }

  function apple(x, y, scale = 1, fill = orange) {
    return move(x, y, path('M0-7c-8-7-15 2-11 10 3 8 7 8 11 5 5 3 10 3 12-5C15-5 7-14 0-7Z', fill, ink, 1.4)
      + path('M0-7v-6q5-5 10-2-4 4-10 4', '#7db6a1', teal, 1.4), scale);
  }

  function crate(x, y) {
    const contents = Array.from({length: 6}, (_, i) => apple(18 + i % 3 * 30, 24 + Math.floor(i / 3) * 22, .8)).join('');
    return move(x, y, contents + rect(0, 43, 95, 54, '#f0d898', ink, 'rx="4"')
      + path('M6 58h83M6 81h83', 'none', '#ad7945', 2));
  }

  function pupil(x, y, value, active) {
    const color = active ? teal : '#70847b';
    return rect(x, y, 46, 54, active ? '#dcedde' : '#f6e4bc', 'none', 'rx="8"')
      + dot(x + 23, y + 14, 5, color, color) + path(`M${x+15} ${y+28}q8-12 16 0`, color, color, 1.5)
      + label(x + 23, y + 42, value, 15, ink);
  }

  function apples(step, frame) {
    if (step === 0) return svg(crate(273, 58) + label(320, 46, 'Яблоки делят поровну', 24)
      + card(87, 192, 213, 47, '+80 яблок → +4 каждому', mint, 13)
      + card(340, 192, 213, 47, '−8 учеников → +6 каждому', '#faebbf', 13),
      'Ящик яблок и два мысленных изменения из условия задачи.');
    if (step === 1 || step === 2 || step === 4) {
      const valueAt = (i) => step === 1 ? '+4' : step === 4 ? '9' : i < 12 ? '+6' : 'ушёл';
      const pupils = Array.from({length: 20}, (_, i) => {
        const x = 42 + i % 10 * 57;
        const y = 52 + Math.floor(i / 10) * 69;
        return fade(frame, pupil(x, y, valueAt(i), step !== 2 || i < 12), i * .105);
      }).join('');
      const title = step === 1 ? 'Если добавить 80 яблок' : step === 2 ? 'Если уйдут 8 учеников' : 'Исходная раздача';
      const count = step === 1 ? '80 : 4 = 20 учеников' : step === 2 ? '12 · 6 = 72 яблока перераспределили' : '20 · 9 = 180 яблок';
      return svg(label(320, 28, title, 21) + pupils + fade(frame, answer(count, 246), 2),
        'Двадцать учеников показаны двумя рядами. Под каждым написано его количество яблок для этого шага.');
    }
    const groups = Array.from({length: 8}, (_, i) => fade(frame,
      pupil(77 + i * 64, 71, '9', false), i * .24)).join('');
    return svg(groups + label(320, 155, '72 яблока — доля восьми учеников', 21)
      + fade(frame, answer('72 : 8 = 9 яблок на ученика'), 2),
      'Семьдесят два яблока распределены по исходным долям восьми учеников.');
  }

  const lessons = {
    11: {
      question: "30 человек отправляются на автомобильную экскурсию. Для этого их размещают в машины по три человека. Автомобили отправляются с интервалом в 2 минуты, а поездка занимает 10 минут. Первый автомобиль отправился в 13:00. Во сколько вернулся последний автомобиль с туристами из этой группы?",
      choices: ["13:18","13:20","13:28","13:30","14:40"],
      title: 'Автомобильная экскурсия',
      short: 'Отправление и возвращение',
      skill: 'Интервалы на шкале времени',
      steps: [
        start,
        ['Машины', 'Раздели туристов на тройки', 'В каждой машине три человека. Чтобы увезти всех тридцать, нужно 30 : 3 = 10 машин.'],
        ['Последнее отправление', 'Посчитай промежутки между машинами', 'Первая машина выехала в 13:00. Между первым и десятым отправлениями девять промежутков по 2 минуты. Значит, последняя машина выехала в 13:18.'],
        ['Возвращение', 'Отсчитай время поездки', 'Последняя машина находилась в пути 10 минут. Прибавляем их к 13:18 и получаем 13:28.']
      ],
      scene: excursion
    },
    12: {
      question: "В каком из вариантов, разрезав фигуру по толстой линии, получим две равные части? Части можно поворачивать и переворачивать.",
      title: 'Разрез на две равные части',
      short: 'Сравни площади и контуры',
      skill: 'Совмещение фигур',
      choiceImages: cutChoices,
      choices: ['', '', '', '', ''],
      steps: [
        start,
        ['Площади', 'Сравни число клеток по обе стороны', 'В варианте А получаются 3¼ и 2¾ клетки, а в варианте Д — 2 и 4 клетки. Части с разными площадями не могут совпасть.'],
        ['Контуры', 'Посмотри на форму оставшихся разрезов', 'Части вариантов Б и В имеют равную площадь, но их границы отличаются. В варианте Б два отрезка разреза длиной в одну клетку образуют выступ на одной части и выемку на другой. В варианте В только у верхней части обе стороны длиной в две клетки соединены короткой вертикальной стороной.'],
        ['Наложение', 'Переверни одну из частей', 'Если перевернуть правую часть варианта Г и передвинуть её, все её стороны и углы совпадут со сторонами и углами левой. Это две равные части.']
      ],
      scene: cutScene
    },
    13: {
      question: "Электронные часы показывают время в 24-часовом формате. Они работают правильно, но две цифры на табло перепутаны местами. Сейчас часы показывают 15:69. Что они покажут через минуту?",
      choices: ["10:70","15:70","16:69","16:70","25:69"],
      title: 'Перепутанные цифры часов',
      short: 'Найди верное время',
      skill: 'Ограничения на разряды времени',
      steps: [
        start,
        ['Десятки минут', 'Переставь цифру 6', 'Десятки минут могут быть только от 0 до 5. Значит, цифра 6 должна поменяться с 1 или с 5. Получатся 65:19 или 16:59.'],
        ['Истинное время', 'Проверь разряды часов', '65:19 выходит за пределы 24-часового формата. Поэтому верное время 16:59, а на табло перепутаны единицы часов и десятки минут.'],
        ['Следующая минута', 'Примени ту же перестановку', 'Через минуту истинное время — 17:00. Поменяем местами 7 и первый 0. Часы покажут 10:70.']
      ],
      scene: clocks
    },
    14: {
      question: "У Лиды есть прямоугольная полоска бумаги. Одна её сторона белая, другая серая. На белой стороне Лида нарисовала пять линий и согнула полоску по ним, как показано на рисунке справа. Как выглядела полоска до сгибания?",
      title: 'Пять сгибов полоски',
      short: 'Восстанови развёртку',
      skill: 'Отражение при сгибании',
      choiceImages: foldChoiceImages,
      choices: ['', '', '', '', ''],
      steps: [
        start,
        ['Границы сгибов', 'Проследи за полоской от конца до конца', 'На сложенной полоске видно пять сгибов. Их можно проследить вдоль ступенек от белого треугольника до серого квадрата.'],
        ['Средние сгибы', 'Сравни направления трёх средних линий', 'При распрямлении чередующиеся наклоны трёх средних сгибов переходят в один наклон. На развёртке эти три линии параллельны. Из пяти вариантов это верно только для Г.'],
        ['Проверка', 'Разверни все пять сгибов', 'В варианте Г три средние линии наклонены в одну сторону, а первая и последняя — в другую. Если сложить полоску по всем пяти линиям, получится фигура из условия.']
      ],
      scene: foldedStrip
    },
    15: {
      question: "Нина хочет вписать числа 0, 1, 2, 3, 4, 5, 6 в круги на рисунке — по одному числу в каждый круг — так, чтобы сумма чисел во всех горизонтальных рядах была одинакова. Чему будет равно произведение чисел, которые она запишет в среднем ряду?",
      choices: ["0","15","18","24","30"],
      title: 'Суммы в трёх рядах',
      short: 'Числа от нуля до шести',
      skill: 'Равные суммы и нулевой множитель',
      steps: [
        start,
        ['Равные суммы', 'Сложи все семь чисел', 'Общая сумма чисел от 0 до 6 равна 21. Её поровну делят три горизонтальных ряда, значит, сумма в каждом равна 21 : 3 = 7.'],
        ['Место нуля', 'Проверь ряды из двух кружков', 'Если в ряду из двух кружков написать 0, второе число должно быть 7. Такого числа нет, поэтому 0 обязательно находится в среднем ряду из трёх кружков.'],
        ['Произведение', 'Учти нулевой множитель', 'Как бы ни были расставлены остальные числа, произведение среднего ряда равно 0. Например, ряды могут быть 5 + 2, 6 + 0 + 1 и 3 + 4.']
      ],
      scene: numberRows
    },
    16: {
      question: "Ира заполнила полоску из 16 клеточек числами от 1 до 16 (рисунок 1). Потом Ира сложила полоску пополам (рисунок 2). Затем она ещё несколько раз таким же образом сложила полоску, пока не остался прямоугольник длиной в две клетки (рисунок 3).\n\nИра проткнула иголкой клетку, в которой написано число 1, развернула полоску и посчитала сумму всех чисел, которые оказались в проколотых клетках. Какая сумма у неё получилась?",
      choices: ["64","68","99","128","136"],
      title: 'Полоска и проколы',
      short: 'Что попало в стопку слоёв?',
      skill: 'Суммы при симметричном сгибании',
      steps: [
        start,
        ['Первый сгиб', 'Совмести клетки попарно', 'Клетка 1 совмещается с 16, клетка 2 — с 15, и так далее. Каждая из восьми пар даёт сумму 17.'],
        ['Второй сгиб', 'Сложи суммы двух слоёв', 'При втором сгибе друг на друга накладываются две пары. Теперь в каждой из четырёх стопок сумма равна 17 + 17 = 34.'],
        ['Последний сгиб', 'Сложи две стопки ещё раз', 'Из четырёх стопок получаются две. В каждой из них сумма чисел равна 34 + 34 = 68.'],
        ['Проколотые клетки', 'Проверь, какие числа под единицей', 'Иголка прокалывает все восемь слоёв под единицей. На развёртке можно увидеть четыре пары с суммой 17: 1 и 16, 4 и 13, 5 и 12, 8 и 9. Их общая сумма равна 68.']
      ],
      scene: foldingNumbers
    },
    17: {
      question: "Периметр фигуры на рисунке 1 равен 22 см, а её углы A и B прямые. Четыре такие фигуры соединены вместе без перекрытия, образуя вертушку (рисунок 2). Периметр вертушки равен 56 см. Какова длина стороны AB?",
      choices: ["8 см","6 см","5 см","4 см","3 см"],
      title: 'Периметр вертушки',
      short: 'Какие стороны стали внутренними?',
      skill: 'Периметр при соединении фигур',
      steps: [
        start,
        ['Четыре детали', 'Найди сумму исходных периметров', 'Периметр одной детали — 22 см. Если считать детали по отдельности, длина всех их границ составит 4 · 22 = 88 см.'],
        ['Общие стороны', 'Посчитай стыки внутри вертушки', 'Каждая сторона AB лежит на участке края соседней детали. Получаются четыре стыка длиной AB. У каждого стыка исчезают из периметра две границы, по одной от каждой соседней детали.'],
        ['Длина AB', 'Раздели потерю периметра на восемь', 'Разность периметров равна 88 − 56 = 32 см. В эту длину входят восемь отрезков длиной AB. Получаем AB = 32 : 8 = 4 см.']
      ],
      scene: pinwheel
    },
    18: {
      question: "В коробке находится некоторое количество ирисок. Никита, Петя и Саша по очереди берут их из коробки следующим образом: Никита берёт одну, Петя — две, Саша — три, Никита — четыре, Петя — пять и так далее. Когда в коробке остаётся недостаточно ирисок для выполнения этого правила, тот, чья очередь, забирает все оставшиеся ириски. Известно, что Пете всего досталось 25 ирисок. Сколько ирисок было в коробке изначально?",
      choices: ["48","50","55","56","65"],
      title: 'Последние ириски',
      short: 'Ходы Никиты, Пети и Саши',
      skill: 'Последовательности и остаток',
      steps: [
        start,
        ['Очередь Пети', 'Запиши, сколько Петя брал бы по правилу', 'Через каждые три хода снова очередь Пети. Он брал бы 2, 5, 8, 11 ирисок. После третьего своего хода у него было 15, а после полного четвёртого получилось бы 26.'],
        ['Неполный ход', 'Найди, сколько ирисок оставалось', 'У Пети получилось 25, значит, на своём четвёртом ходу он взял 25 − 15 = 10 ирисок. Это меньше положенных 11, значит, Петя забрал всё, что оставалось.'],
        ['Все ириски', 'Сложи первые десять ходов и остаток', 'До последнего хода взяли 1 + 2 + … + 10 = 55 ирисок. Добавим 10 последних ирисок Пети. Изначально в коробке было 65 ирисок.']
      ],
      scene: sweets
    },
    19: {
      question: "Квадрат ABCD разделён на 4 одинаковых серых прямоугольника, 4 одинаковых белых прямоугольника и один чёрный квадрат. Длина стороны чёрного квадрата составляет 7 см. Длина большей стороны белого прямоугольника составляет 15 см, а длина большей стороны серого прямоугольника — 29 см. Чему равна длина стороны квадрата ABCD?",
      choices: ["33 см","34 см","35 см","36 см","37 см"],
      title: 'Сторона составного квадрата',
      short: 'Белые и серые прямоугольники',
      skill: 'Чтение длин на чертеже',
      steps: [
        start,
        ['Белая деталь', 'Найди её короткую сторону', 'Длинная сторона белого прямоугольника равна короткой стороне другого белого прямоугольника плюс сторона чёрного квадрата. Короткая сторона равна 15 − 7 = 8 см.'],
        ['Серая деталь', 'Сравни внешний и внутренний ряды', 'Внутренняя белая область вместе с чёрным квадратом имеет ширину 15 + 8 = 23 см. Длинная серая сторона в 29 см охватывает эти 23 см и ещё одну короткую серую сторону. Её длина 29 − 23 = 6 см.'],
        ['Сторона квадрата', 'Сложи длинную и короткую серые стороны', 'Верхняя сторона AB состоит из длинной стороны верхнего серого прямоугольника и короткой стороны левого. Получается 29 + 6 = 35 см.']
      ],
      scene: squareBands
    },
    20: {
      question: "Группе учеников дали ящик с яблоками. Они хотят разделить яблоки поровну. Ребята заметили, что, если бы яблок было на 80 больше, каждый из них получил бы на 4 яблока больше. А если бы учеников было на 8 меньше, каждый из них получил бы на 6 яблок больше. Сколько яблок в ящике?",
      choices: ["240","200","180","160","120"],
      title: 'Яблоки для учеников',
      short: 'Два изменения поровну',
      skill: 'Распределение и восстановление целого',
      steps: [
        start,
        ['Число учеников', 'Раздай восемьдесят дополнительных яблок', 'Если добавить 80 яблок, каждый получит ещё по 4. Значит, учеников 80 : 4 = 20.'],
        ['Ученики уходят', 'Посчитай перераспределённые яблоки', 'Если уйдут восемь учеников, останется 20 − 8 = 12. Они получат по шесть дополнительных яблок, всего 12 · 6 = 72 яблока.'],
        ['Исходная доля', 'Найди долю одного ученика', 'Эти 72 яблока — исходные доли восьми ушедших учеников. Каждый из них получил бы по 72 : 8 = 9 яблок.'],
        ['Весь ящик', 'Умножь долю на число учеников', 'Изначально каждому из двадцати досталось бы по 9 яблок. В ящике было 20 · 9 = 180 яблок.']
      ],
      scene: apples
    }

  };

  Object.assign((globalThis.KenguruVisualLessons ??= {})[2026] ??= {}, lessons);
})();
