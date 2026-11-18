'use strict';

(() => {
  const V = globalThis.KenguruVisual;
  const lessons = (globalThis.KenguruVisualLessons ??= {})[2000] ??= {};
  const ink = '#172e34', teal = '#237e79', pale = '#e9f2e8';
  const amber = '#bf603b', gold = '#f7dfa9', line = '#cbd9cd', paper = '#fffefa';
  const intro = ['Условие', 'Условие задачи', 'Выбери свой вариант ответа.'];
  const text = (x, y, value, size = 23, fill = ink) =>
    `<text x="${x}" y="${y}" font-family="system-ui,sans-serif" font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${fill}">${V.escape(value)}</text>`;
  const box = (x, y, w, h, fill = paper, stroke = line, r = 9) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
  const dot = (x, y, r, fill = teal, stroke = 'none') =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}"/>`;
  const path = (d, color = ink, width = 3, attrs = '') =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${attrs}/>`;
  const link = (x1, y1, x2, y2, color = ink, width = 3) =>
    path(`M${x1} ${y1} L${x2} ${y2}`, color, width);
  const scene = (markup, description) => V.svg(markup, description, '0 0 640 300');
  const fade = (markup, frame, delay = 0) => `<g opacity="${.24 + .76 * V.reveal(frame, delay)}">${markup}</g>`;
  const art = 'assets/grades-5-6/2000/';
  const clockFigure = `${art}condition-01.svg`;
  const clockMinute = `${art}clock-minute-01.svg`;
  const kangarooFigure = `${art}condition-03.svg`;
  const netFigure = `${art}condition-09.svg`;
  const image = (url, width, height, x = 0, y = 0) =>
    `<image href="${url}" x="${x}" y="${y}" width="${width}" height="${height}"/>`;
  const figure = (url, width, height, label) => V.svg(
    image(url, width, height), label, `0 0 ${width} ${height}`, 'legacy-scene')
    .replace('<svg ', `<svg style="max-width:${width}px" `);
  const answer = (value, frame) => fade(box(105, 246, 430, 43, pale, teal) + text(320, 268, value, Math.min(23, 725 / value.length), teal), frame);

  function pocketGroups(frame, final) {
    let body = box(108, 19, 424, 209, paper, teal) + text(320, 44, '1 карман', 23, teal);
    for (let row = 0; row < 3; row++) {
      const y = 69 + row * 50;
      let group = box(125, y, 390, 41, pale) + text(199, y + 21, `Мышка ${row + 1}`, 20);
      for (let i = 0; i < 5; i++) group += dot(314 + i * 40, y + 20, 10, teal);
      body += fade(group, frame, row * .75);
    }
    return body + (final ? answer('585 × 3 × 5 = 8 775', frame) : text(320, 257, '3 × 5 = 15 мышат', 25, teal));
  }

  function kangaroo(frame, highlighted) {
    const x0 = 74, y0 = 8, width = 225, height = 225 * 380 / 370;
    // Coordinates of the three junctions in condition-03.svg's viewBox.
    const junctions = [['B', 174, 172, 3], ['C', 172, 342, 1], ['D', 128, 353, 3]];
    let body = image(kangarooFigure, width, height, x0, y0);
    for (let i = 0; i < junctions.length; i++) {
      const [name, x, y, count] = junctions[i];
      const cx = x0 + (x - 30) * width / 370;
      const cy = y0 + (y - 10) * height / 380;
      const ring = `<circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="${amber}" stroke-width="3"/>`;
      const at = 57 + i * 58;
      body += fade(ring + box(368, at - 22, 215, 44, pale) + text(475, at, `${name}: ${count}`, 24), frame, i * .4);
    }
    return body + (highlighted ? answer('Нечётных точек больше двух', frame) : text(475, 225, 'Число ветвей', 19, teal));
  }

  function fractionBars(step, frame) {
    const captions = ['3/10', '1/3', '30% от 1', '0,3', '30/100'];
    let body = '';
    for (let row = 0; row < 5; row++) {
      const y = 25 + row * 45;
      const isThird = row === 1;
      const filled = isThird ? step === 2 ? 10 : 0 : 9;
      const highlight = step === 2 && isThird;
      body += text(104, y + 13, captions[row], 21, highlight ? amber : ink);
      for (let i = 0; i < 30; i++) {
        body += box(175 + i * 11, y, 10, 25, i >= filled ? paper : highlight ? gold : pale,
          i >= filled ? line : highlight ? amber : teal, 1);
      }
      body += fade(text(561, y + 13, filled ? filled + '/30' : '?/30', 20, highlight ? amber : teal), frame, row * .4);
    }
    return body + (step === 2 ? answer('1/3 отличается от 3/10', frame) : '');
  }

  function bags(step, frame) {
    const rows = step === 1 ? 7 : 5;
    const cols = step === 1 ? 3 : 5;
    const start = (640 - cols * 55) / 2;
    let body = text(320, 20, `${rows} осликов · ${cols} ${cols === 3 ? 'дня' : 'дней'}`, 22);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = start + col * 55, y = 40 + row * 27;
        body += fade(box(x + 5, y, 47, 22, row === 0 && col === 0 && step === 1 ? gold : pale, line, 4), frame, row * .35);
      }
    }
    return body + (step === 1 ? text(320, 257, 'Одна клетка — один мешок', 23, teal) : answer('5 × 5 = 25 мешков', frame));
  }

  function digits(step, frame) {
    const chosen = [3, 5, 6].slice(0, step);
    const passed = step === 1 ? [0, 1, 2] : [0, 1, 2, 4];
    const digits = '4921508';
    let body = '';
    for (let i = 0; i < digits.length; i++) {
      const x = 32 + i * 83;
      const selected = chosen.includes(i);
      const discarded = passed.includes(i);
      body += box(x, 44, 68, 70, selected ? pale : paper, selected ? teal : line);
      body += text(x + 34, 79, digits[i], 37, discarded ? '#778886' : ink);
      if (discarded) body += fade(link(x + 15, 96, x + 52, 60, amber), frame, i * .24);
      if (selected) body += text(x + 34, 139, ['сотни', 'десятки', 'единицы'][chosen.indexOf(i)], 16, teal);
    }
    for (let i = 0; i < 3; i++) {
      const x = 209 + i * 78;
      body += box(x, 171, 64, 64, pale);
      if (chosen[i] !== undefined) body += fade(text(x + 32, 203, digits[chosen[i]], 35, teal), frame, i * .42);
    }
    return body + (step === 3 ? answer('Получилось число 108', frame) : '');
  }

  function martians(step, frame) {
    let body = '';
    for (let i = 0; i < 10; i++) {
      const x = 41 + i * 62;
      body += dot(x, 96, 13, pale, teal) + link(x, 113, x, 160, teal, 5);
      body += path(`M${x - 25} 130 L${x} 115 L${x + 25} 130 M${x} 114 L${x + 15} 68`, teal, 4);
      if (i < 9) body += fade(link(x + 25, 130, x + 37, 130, amber, 5), frame, i * .35);
      if (step === 2) {
        body += fade(dot(x + 15, 67, 6, amber), frame, i * .3);
        if (i === 0 || i === 9) body += fade(dot(x + (i === 0 ? -25 : 25), 130, 6, amber), frame);
      }
    }
    body += text(320, 195, step === 1 ? '9 соединений по 2 руки' : '10 верхних рук и 2 крайние', 24, teal);
    return body + (step === 2 ? answer('30 − 18 = 12 свободных рук', frame) : '');
  }

  function bounce(step, frame) {
    let body = link(48, 231, 598, 231, line, 4);
    if (step === 2) {
      body += fade(path('M95 51 Q113 125 180 231', amber, 5) + dot(95, 51, 9, amber), frame);
      body += text(145, 68, '120 см', 22, amber);
    }
    body += path('M180 231 Q280 51 380 231', teal, 5) + path('M380 231 Q475 141 570 231', teal, 5);
    body += fade(dot(280, 141, 8) + text(280, 118, '60 см', 21, teal), frame, .35);
    body += dot(475, 186, 8) + text(475, 161, '30 см', 21, teal);
    return body + (step === 2 ? answer('30 × 2 × 2 = 120 см', frame) : text(320, 269, '30 × 2 = 60 см', 22, teal));
  }

  function net(step, frame) {
    const faces = [['X', 1, 1], ['C', 2, 1], ['D', 2, 2], ['E', 3, 2]];
    const width = 242, height = width * 226 / 286;
    const size = 60 * width / 286;
    const ox = 30, oy = 42;
    let body = image(netFigure, width, height, ox, oy);
    for (const [letter, col, row] of faces) {
      if (letter === 'E' && step === 1) continue;
      const x = ox + (16 / 60 + col) * size, y = oy + (16 / 60 + row) * size;
      const fill = letter === 'E' ? amber : teal;
      body += `<rect x="${x + 1}" y="${y + 1}" width="${size - 2}" height="${size - 2}" fill="${fill}" fill-opacity=".22"/>`;
    }

    const face = (points, fill) => `<polygon points="${points}" fill="${fill}" stroke="${teal}" stroke-width="2"/>`;
    body += face('323,167 458,124 589,166 454,210', pale);
    body += fade(face('323,80 454,122 454,210 323,167', '#e7f0e8'), frame, .25);
    body += fade(face('454,122 589,79 589,166 454,210', '#d1e8df'), frame, .65);
    body += text(389, 144, 'D', 26, teal) + text(518, 145, 'C', 26, teal);
    body += link(454, 210, 468, 224, teal, 2) + text(505, 225, 'X · низ', 18, teal);
    if (step === 2) {
      body += fade(face('323,80 458,36 589,79 454,122', gold) + text(456, 78, 'E', 26, amber), frame);
      body += answer('Грань E напротив грани X', frame);
    }
    return body;
  }

  function hundreds(step, frame) {
    if (step === 2) {
      const words = ['сто', 'сорок', 'семь'];
      let body = '';
      for (let i = 0; i < 3; i++) {
        const x = 93 + i * 155;
        body += fade(box(x, 72, 145, 103, pale) + text(x + 72, 103, '147'[i], 34, teal) +
          text(x + 72, 149, words[i], 23), frame, i * .6);
      }
      return body + answer('Цифра сотен — 1', frame);
    }
    const rows = [
      ['сто', 'сорок, семьдесят'], ['двести', 'девяносто'], ['триста', 'тридцать'],
      ['четыреста', '—'], ['пятьсот', 'пятьдесят'], ['шестьсот', 'шестьдесят'],
      ['семьсот', 'сорок, семьдесят'], ['восемьсот', 'восемьдесят'], ['девятьсот', 'девяносто'],
    ];
    let body = text(172, 23, 'Сотни', 21, teal) + text(440, 23, 'Десятки на ту же букву', 21, teal);
    rows.forEach(([left, right], i) => {
      const y = 39 + i * 26;
      body += fade(box(54, y, 532, 25, i === 0 ? gold : i % 2 ? paper : pale, 'none', 4) +
        text(172, y + 13, left, 17) + text(440, y + 13, right, 17), frame, i * .25);
    });
    return body;
  }

  Object.assign(lessons, {
    1: {
      title: 'Часы в зеркале', short: 'Часы в зеркале', skill: 'Отражение и циферблат',
      question: 'Правильно идущие часы отражаются в зеркале. Который сейчас час?',
      conditionImage: clockFigure,
      choices: ['15.15', '10.15', '10.45', '8.45', '9.45'],
      steps: [intro,
        ['Шаг 1', 'Отрази циферблат обратно', 'Верх и низ сохраняют положение, а левая и правая стороны меняются местами. Минутная стрелка смотрит на 3 в зеркале и на 9 на настоящих часах.'],
        ['Ответ', 'Прочитай час по короткой стрелке', 'На настоящих часах короткая стрелка между 9 и 10, а длинная показывает 45 минут. Сейчас 9:45.']],
      scene(step, frame) {
        if (step === 0) return figure(clockFigure, 220, 236, 'Отражение циферблата, обе стрелки направлены вправо');
        let body = image(clockFigure, 169, 181, 83, 23) + text(167, 225, 'Отражение', 25);
        body += path('M320 39 V217', line, 3, 'stroke-dasharray="9 7"');
        const right = step === 2
          ? `<g transform="translate(946 0) scale(-1 1)">${image(clockFigure, 169, 181, 388.5, 23)}</g>`
          : image(clockMinute, 169, 181, 388.5, 23);
        body += fade(right + text(473, 225, 'Настоящие часы', 25), frame);
        return scene(body + (step === 2 ? answer('9:45', frame) : ''), 'Отражение переводит стрелки с правой стороны циферблата на левую.');
      },
    },
    2: {
      title: 'Мышата в карманах', short: 'Мышата', skill: 'Равные группы',
      question: 'У великана на куртке 585 карманов. В каждом кармане живет по 3 мышки, у каждой мышки по 5 мышат. Сколько мышат обитает в карманах у великана?',
      choices: ['(585 : 3) : 5', '(585 · 3) : 5', '(585 : 3) · 5', '585 · 3 · 5', '585 · (5 + 3)'],
      steps: [intro,
        ['Шаг 1', 'Посчитай мышат в одном кармане', 'Три семейства по пять мышат — это 3 × 5 = 15 мышат в кармане.'],
        ['Ответ', 'Умножь на число карманов', 'Карманов 585, поэтому всего 585 × 3 × 5 = 8 775 мышат. Правильное выражение записано в варианте D.']],
      scene: (step, frame) => step ? scene(pocketGroups(frame, step === 2), 'Три мышиных семейства по пять мышат в каждом кармане.') : '',
    },
    3: {
      title: 'Кенгуру одним росчерком', short: 'Один росчерк', skill: 'Чётность и маршруты',
      question: 'Петя хочет нарисовать кенгуру, не отрывая карандаш от бумаги и не проводя по одной линии дважды. С какой точки он должен начать?',
      conditionImage: kangarooFigure,
      choices: ['A', 'B', 'C', 'D', 'такой точки нет'],
      steps: [intro,
        ['Шаг 1', 'Найди точки с нечётным числом ветвей', 'У точки B и у точки D по три ветви. Точка C — конец одной линии. Уже есть три точки с нечётным числом ветвей.'],
        ['Ответ', 'Проверь, хватает ли концов штриха', 'Если карандаш приходит в точку и уходит из неё, две ветви расходуются парой. Нечётными могут быть только начало и конец. Здесь нечётных точек больше двух, поэтому нарисовать кенгуру одним росчерком нельзя.']],
      scene(step, frame) {
        return step === 0 ? figure(kangarooFigure, 230, 236, 'Контур кенгуру с отмеченными точками A, B, C и D')
          : scene(kangaroo(frame, step === 2), 'В отмеченных точках B, C и D соответственно три, одна и три ветви.');
      },
    },
    4: {
      title: 'Одна дробь отличается', short: 'Сравнение дробей', skill: 'Дроби и проценты',
      question: 'Какое из этих чисел не равно остальным?',
      choices: ['3/10', '1/3', '30% от 1', '0,3', '30/100'],
      steps: [intro,
        ['Шаг 1', 'Приведи числа к одинаковым долям', '30% от 1, 0,3 и 30/100 — это три десятых. Если целое разделить на 30 долей, этим числам и дроби 3/10 соответствуют 9 долей.'],
        ['Ответ', 'Проверь одну треть', 'Одна треть равна 10/30. Это на одну долю больше, чем 9/30. Отличается число 1/3.']],
      scene: (step, frame) => step ? scene(fractionBars(step, frame), 'На полосках из 30 долей видна разница между девятью долями и десятью.') : '',
    },
    5: {
      title: 'Мешки корма', short: 'Корм для осликов', skill: 'Норма за один день',
      question: 'Семь осликов за 3 дня съедают 21 мешок корма. Сколько корма надо пяти осликам на 5 дней?',
      choices: ['25', '20', '15', '10', '5'],
      steps: [intro,
        ['Шаг 1', 'Найди норму на один день', 'Семь осликов за три дня дают 7 × 3 = 21 порцию на одного ослика в день. На каждую порцию приходится один мешок.'],
        ['Ответ', 'Собери новую таблицу порций', 'Пять осликов за пять дней съедят 5 × 5 = 25 мешков.']],
      scene: (step, frame) => step ? scene(bags(step, frame), 'Каждая клетка таблицы соответствует ослику и дню, значит представляет один мешок.') : '',
    },
    6: {
      title: 'Самое маленькое число', short: 'Вычеркнуть цифры', skill: 'Сравнение разрядов',
      question: 'Какие четыре цифры надо вычеркнуть из числа 4921508, чтобы получившееся трехзначное число было как можно меньше?',
      choices: ['4, 9, 2, 1', '4, 9, 2, 5', '1, 5, 0, 8', '4, 2, 1, 0', '4, 9, 5, 8'],
      steps: [intro,
        ['Шаг 1', 'Выбери сотни', 'Первая цифра должна быть ненулевой, а справа должно остаться хотя бы две цифры. Меньшая возможная цифра сотен — 1.'],
        ['Шаг 2', 'Выбери десятки', 'Справа от единицы стоят 5, 0 и 8. Для десятков подходит 0, потому что после него ещё стоит 8.'],
        ['Ответ', 'Запиши оставшиеся цифры', 'Оставляем 1, 0 и 8. Вычеркнуть нужно 4, 9, 2 и 5.']],
      scene: (step, frame) => step ? scene(digits(step, frame), 'В числе 4921508 последовательно выбираются сотни, десятки и единицы.') : '',
    },
    7: {
      title: 'Свободные руки марсиан', short: 'Руки в шеренге', skill: 'Подсчёт связей',
      question: 'У каждого марсианина по 3 руки. Десять марсиан построились в шеренгу, и каждый взял соседа за руку. Сколько рук остались свободными?',
      choices: ['9', '10', '11', '12', '0'],
      steps: [intro,
        ['Шаг 1', 'Сосчитай рукопожатия', 'У десяти марсиан в шеренге девять соседних пар. Каждое рукопожатие занимает две руки. Всего занято 9 × 2 = 18 рук.'],
        ['Ответ', 'Сосчитай свободные руки', 'Всего 10 × 3 = 30 рук. Свободны 30 − 18 = 12 рук: по одной у всех и ещё по одной у крайних.']],
      scene: (step, frame) => step ? scene(martians(step, frame), 'Десять марсиан соединены девятью рукопожатиями.') : '',
    },
    8: {
      title: 'Два прыжка мяча', short: 'Высота отскока', skill: 'Обратные действия',
      question: 'Если мяч бросить на пол, то он подпрыгнет на половину высоты, с которой упал. После того, как мяч бросили, он подпрыгнул, снова упал, а затем подпрыгнул на 30 см. С какой высоты его бросили?',
      choices: ['45 см', '60 см', '90 см', '105 см', '120 см'],
      steps: [intro,
        ['Шаг 1', 'Вернись к первому отскоку', 'Второй отскок высотой 30 см вдвое ниже первого. Первый отскок был высотой 30 × 2 = 60 см.'],
        ['Ответ', 'Удвой ещё раз', 'Первый отскок вдвое ниже высоты броска. Мяч бросили с высоты 60 × 2 = 120 см.']],
      scene: (step, frame) => step ? scene(bounce(step, frame), 'От высоты второго отскока по очереди восстанавливаются предыдущие высоты.') : '',
    },
    9: {
      title: 'Верхняя грань кубика', short: 'Развёртка кубика', skill: 'Складывание развёртки',
      question: 'Из развертки, изображенной на рисунке, склеили кубик и поставили его так, что грань с буквой X оказалась снизу. Какая буква оказалась сверху?',
      conditionImage: netFigure,
      choices: ['A', 'B', 'C', 'D', 'E'],
      steps: [intro,
        ['Шаг 1', 'Подними боковые грани', 'Оставь X на столе. Подними C вокруг общего ребра с X. Затем поверни прилегающую к C грань D: она станет другой боковой стенкой кубика.'],
        ['Ответ', 'Закрой верхнюю грань', 'Свободное ребро D соединено с E на развёртке. Поверни E вокруг этого ребра. Она закрывает куб сверху, напротив X.']],
      scene: (step, frame) => step
        ? scene(net(step, frame), 'Путь по граням X, C, D, E. X внизу, грани C и D сбоку.')
        : figure(netFigure, 286, 226, 'Развёртка куба с гранями A, B, C, D, E, X и клапанами для склейки'),
    },
    10: {
      title: 'Три слова на одну букву', short: 'Название числа', skill: 'Перебор и порядок цифр',
      question: 'Жан-Кристоф изучает русский язык. Он записал некоторое трехзначное число сначала цифрами, а потом – словами по-русски. Оказалось, что все цифры различны и идут в порядке возрастания (слева направо), а все слова начинаются с одной и той же буквы. Чему равна цифра сотен этого числа?',
      choices: ['7', '2', '1', '9', 'такого числа нет'],
      steps: [intro,
        ['Шаг 1', 'Проверь первые буквы сотен и десятков', 'Цифра десятков больше цифры сотен. Подходят «сто сорок», «сто семьдесят» и «двести девяносто». После девятки большую цифру взять нельзя, поэтому сотен должна быть одна.'],
        ['Ответ', 'Подбери единицы и проверь', 'Из названий цифр на «с» начинается «семь». Проверяем: 1 < 4 < 7, а «сто сорок семь» начинается на одну букву. Цифра сотен — 1.']],
      scene: (step, frame) => step ? scene(hundreds(step, frame), step === 1
        ? 'Сопоставление названий сотен и десятков по первой букве.' : 'Сто, сорок, семь. Все три слова начинаются на с.') : '',
    },
  });
})();
