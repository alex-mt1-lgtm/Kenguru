(() => {
  const V = globalThis.KenguruVisual;
  const lessons = (globalThis.KenguruVisualLessons ??= {})[2024] ??= {};
  const ink = '#172e34', teal = '#237e79', orange = '#c14d2b', gold = '#efc466';
  const pale = '#eaf0e6', white = '#fffdf7', muted = '#586e70';
  const optionLetters = ['А', 'Б', 'В', 'Г', 'Д'];
  const pictureChoices = (noun) => optionLetters.map((letter) => `${noun} ${letter}`);
  const line = (x1, y1, x2, y2, color = ink, width = 2, extra = '') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
  const rect = (x, y, w, h, fill = white, stroke = ink, radius = 0) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
  const path = (d, color = ink, width = 3, extra = '') =>
    `<path d="${d}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none" ${extra}/>`;
  const label = (x, y, value, size = 18, color = ink, extra = '') =>
    `<text x="${x}" y="${y}" text-anchor="middle" fill="${color}" font-size="${size}" font-weight="700" ${extra}>${value}</text>`;
  const group = (body, extra = '') => `<g ${extra}>${body}</g>`;
  const svg = (body, description) => V.svg(body, description, '0 0 640 300');
  const fadeIn = (frame, body) => group(body, `opacity="${0.25 + 0.75 * V.reveal(frame)}"`);
  const arrow = (x1, y1, x2, y2, color = teal, width = 3) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const tip = (side) => [x2 - 10 * Math.cos(angle + side * 0.48), y2 - 10 * Math.sin(angle + side * 0.48)];
    return line(x1, y1, x2, y2, color, width) + path(`M${tip(-1).join(' ')} L${x2} ${y2} L${tip(1).join(' ')}`, color, width);
  };

  const squares = [
    ['.sD', 'Do.', '#.o', 's .'],
    ['  D', 'o o', '  o', '# #'],
    ['.s.', '# D', 's.#', 's#o'],
    ['#  ', 'D #', 'D  ', '  #'],
    ['s#.', '.os', 'soo', '  .'],
  ].map((row) => row.join(' '));
  const star = Array.from({ length: 12 }, (_, i) => {
    const angle = Math.PI * i / 6 - Math.PI / 2;
    const radius = i % 2 ? 6 : 11;
    return `${radius * Math.cos(angle)},${radius * Math.sin(angle)}`;
  }).join(' ');
  function tile(symbol, x, y, fill) {
    const mark = {
      s: `<polygon points="${star}" fill="${white}" stroke="${ink}" stroke-width="1.7"/>`,
      D: `<polygon points="0,-10 6,0 0,10 -6,0" fill="${muted}" stroke="${ink}" stroke-width="1.5"/>`,
      o: `<circle r="8.5" fill="${white}" stroke="${ink}" stroke-width="1.7"/>`,
    }[symbol] ?? '';
    return group(rect(-14, -14, 28, 28, fill ?? (symbol === '#' ? muted : white)) + mark, `transform="translate(${x} ${y})"`);
  }

  const feet = {
    L: `<path d="M-11 8 C-15 5 -16 0 -15 -8 C-15 -12 -10 -15 -7 -13 C-4 -11 -5 -6 -7 -3 C-9 0 -7 3 -8 6 C-8 8 -9 9 -11 8Z" fill="currentColor"/><circle cx="-7" cy="-17" r="2.5" fill="currentColor"/><circle cx="-12" cy="-18" r="1.8" fill="currentColor"/><circle cx="-16" cy="-16.5" r="1.4" fill="currentColor"/>`,
  };
  feet.R = group(feet.L, 'transform="scale(-1 1)"');
  feet.B = feet.L + feet.R;
  const footprint = (x, y, kind, color, scale = 1) =>
    group(feet[kind], `transform="translate(${x} ${y}) scale(${scale})" style="color:${color}"`);

  const glyphs = {
    П: '<circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="20" cy="20" r="2.8" fill="currentColor"/>',
    И: '<path d="M8 7 Q10 33 18 33 Q27 33 31 8"/>',
    Р: '<path d="M18 6 Q15 23 16 34"/>',
    О: '<path d="M7 33 Q8 7 19 7 Q28 7 31 33"/>',
    Г: '<path d="M11 8 L29 32 M10 23 L11 28 M27 12 L30 14"/>',
    Н: '<path d="M15 17 Q9 7 19 6 Q29 7 24 17 Q35 29 22 33 Q7 35 11 23 Q12 19 15 17Z M15 17 Q19 15 24 17"/><circle cx="20" cy="25" r="2.2" fill="currentColor"/>',
    А: '<path d="M11 8 Q20 5 29 8 L12 25Z M27 18 L27 32 L11 32Z"/>',
    Ш: '<path d="M8 8 L27 18 M10 17 L30 27 M11 26 L25 34"/>',
  };
  const glyph = (letter, x, y, color = ink, scale = 1) =>
    group(glyphs[letter], `transform="translate(${x} ${y}) scale(${scale})" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" style="color:${color}"`);
  const cipherOptions = ['ИПШОА', 'НШИОА', 'ПНАИШ', 'АПОИШ', 'ШПИОН'];

  const kiteSegments = {
    gray: 'M265 48 C309 51 346 76 346 127',
    white: 'M383 58 C341 56 294 76 294 127',
    upperLoop: 'M240 127 C240 96 288 94 321 94 C379 94 405 96 400 127',
    lowerLoop: 'M294 184 C294 215 346 215 346 184',
    girl: 'M240 184 Q240 213 264 230',
    boy: 'M400 184 Q400 215 385 230',
  };
  const kitePieces = [
    ['M25 0 C26 26 60 26 89 23 C130 22 183 52 185 0', 'M25 57 C27 19 180 13 185 57', 'M79 0 V57', 'M131 0 V57'],
    ['M25 0 C5 32 79 36 79 57', 'M25 57 C26 11 112 20 145 33 C184 45 186 15 185 0', 'M131 0 V57'],
    ['M25 0 C32 30 124 46 131 0', 'M79 0 C85 36 176 34 185 0', 'M25 57 Q27 17 71 38 Q79 42 79 57', 'M131 57 Q133 17 177 38 Q185 42 185 57'],
    ['M25 0 C25 23 48 29 75 30 C112 31 131 38 131 57', 'M79 0 C79 20 107 28 133 31 C164 34 185 41 185 57', 'M131 0 Q131 30 159 30 Q185 30 185 0', 'M25 57 Q25 34 52 34 Q79 34 79 57'],
    ['M25 0 V57', 'M185 0 V57', 'M79 0 C79 33 131 23 131 57', 'M131 0 C131 33 79 23 79 57'],
  ];
  const piece = (paths, x, y, scale = 1, color = ink, fill = white) =>
    group(rect(0, 0, 210, 57, fill, muted) + paths.map((d) => path(d, color, 2.8)).join(''), `transform="translate(${x} ${y}) scale(${scale})"`);
  const kid = (x, y, skirt = false) =>
    group(`<circle cx="0" cy="-9" r="7" fill="${ink}"/>` +
      (skirt ? `<path d="M-6 0 H6 L11 25 H-11Z" fill="${ink}"/>` : rect(-7, 0, 14, 23, ink, ink, 2)) +
      path('M-5 5 L-13 -5 M5 5 L13 -5 M-4 21 V34 M4 21 V34', ink, 4.5), `transform="translate(${x} ${y})"`);

  const brickColors = ['#798386', '#263237', '#c2c9c9'];
  const brickShapes = [[18, 76], [18, 90], [32, 61]];
  function bricks(mode = 'front', mark = false) {
    const whiteBrick = rect(0, 42, 96, 48, white);
    const upright = (i, center, height = brickShapes[i][1]) => {
      const [width] = brickShapes[i];
      return rect(center - width / 2, 90 - height, width, height, brickColors[i], mark ? teal : ink);
    };
    if (mode === 'front') return upright(0, 79) + upright(2, 28) + upright(1, 28) + whiteBrick;
    if (mode === 'А') return whiteBrick + upright(0, 79) + upright(2, 28) + upright(1, 28);
    if (mode === 'В') return whiteBrick + upright(0, 18) + upright(2, 68) + upright(1, 68);
    if (mode === 'Г') return upright(0, 18) + upright(2, 68) + upright(1, 68) + whiteBrick;
    return whiteBrick + upright(0, 18) + upright(1, 68, mode === 'Д' ? 76 : 90) + upright(2, 68);
  }

  Object.assign(lessons, {
    1: {
      title: 'Рисунок на сгибе',
      short: 'Одна половина листа отражается на другую.',
      skill: 'Осевая симметрия',
      question: 'Алина складывает лист бумаги с картинкой по пунктирной линии. Какой из следующих квадратов наложится на точно такой же квадрат?',
      choices: ['Квадрат со звездой', 'Квадрат с ромбом', 'Светлый пустой квадрат', 'Квадрат с кругом', 'Тёмный квадрат'],
      steps: [
        ['Условие', 'Представь, что лист сложили', 'Какой знак совпадёт со своим отражением по другую сторону пунктира?'],
        ['Соседи', 'Начни с клеток у сгиба', 'Ближайшая строка сверху попадёт на ближайшую снизу. При сгибе клетки остаются в своих столбцах.'],
        ['Дальше', 'Проверь вторую пару строк', 'Вторая строка сверху попадёт на вторую снизу. Нижний край рисунка останется открытым.'],
        ['Совпадение', 'Найди пару одинаковых квадратов', 'Только два квадрата с ромбами в левой стойке цифры 0 лежат в одном столбце на одинаковом расстоянии от сгиба. Ответ Б.'],
      ],
      scene(step, frame) {
        const axis = 122, x = (c) => 112 + c * 29, y = (r) => 78 + r * 29;
        const activeRow = step === 1 ? 1 : 0;
        const active = (r) => step === 1 || step === 2 ? r === activeRow || r === 3 - activeRow : false;
        const progress = V.reveal(frame);
        let marks = '';
        squares.forEach((row, r) => [...row].forEach((symbol, c) => {
          if (symbol === ' ') return;
          const pair = r < 2 && squares[3 - r][c] === symbol;
          const match = step >= 3 && (pair || r === 3 && squares[0][c] === symbol);
          const color = active(r) && symbol !== '#' ? pale : undefined;
          marks += tile(symbol, x(c), y(r), color);
          if (match) marks += fadeIn(frame, tile(symbol, x(c), y(r), gold));
        }));
        if (step === 1 || step === 2) {
          [...squares[activeRow]].forEach((symbol, c) => {
            if (symbol === ' ') return;
            const start = y(activeRow), end = y(3 - activeRow);
            marks += group(tile(symbol, x(c), start + (end - start) * progress, gold), 'opacity=".75"');
          });
        }
        const previews = ['s', 'D', '.', 'o', '#'].map((symbol, i) =>
          tile(symbol, 120 + i * 100, 251, step >= 3 && i === 1 ? gold : undefined) + label(120 + i * 100, 286, optionLetters[i], 15)).join('');
        return svg(label(320, 31, 'Линия сгиба', 19) + marks +
          line(92, axis, 537, axis, orange, 2, 'stroke-dasharray="6 5"') + previews,
        'Клетки на листе по обе стороны пунктирной линии и пять образцов квадратов');
      },
    },
    2: {
      title: 'Прыжки по клеткам',
      short: 'Один и тот же узор повторяется через четыре клетки.',
      skill: 'Периодические последовательности',
      question: 'На рисунке показаны несколько первых движений игры в прыжки. Последовательность изображений повторяется каждые четыре клетки. Мила прыгает, приземляясь на ноги так, как нарисовано в каждой клетке. В какой из следующих клеток Мила приземлится только на правую ногу?',
      choices: ['в 10-й', 'в 15-й', 'в 20-й', 'в 22-й', 'в 23-й'],
      steps: [
        ['Условие', 'Прочитай дорожку от старта', 'Следы показывают, на какую ногу или на какие ноги Мила приземляется.'],
        ['Четыре', 'Выдели один повтор', 'Снизу вверх идут две ноги, левая, две ноги, правая. Только последнее место в этой четвёрке подходит.'],
        ['Повтор', 'Перенеси правую ногу в следующие четвёрки', 'Правая нога стоит в клетках 4, 8, 12, 16, 20, 24 и так далее. Номер каждой такой клетки делится на 4 без остатка.'],
        ['Выбор', 'Раздели номера из вариантов на 4', 'Только 20 делится на 4 без остатка. На двадцатой клетке Мила приземлится только на правую ногу. Ответ В.'],
      ],
      scene(step, frame) {
        const order = ['B', 'L', 'B', 'R'];
        let body = '';
        if (step === 0) {
          for (let i = 0; i < 6; i++) {
            const y = 227 - i * 37;
            body += rect(296, y, 48, 37, white, ink, 2) + footprint(320, y + 24, order[i % 4], ink, 0.87);
          }
          return svg(body + arrow(249, 247, 249, 53) + label(249, 272, 'Старт', 15), 'Мила прыгает снизу вверх по шести клеткам');
        }
        const count = step === 1 ? 4 : 24, cols = step === 1 ? 4 : 8;
        for (let i = 0; i < count; i++) {
          const x = (step === 1 ? 156 : 42) + (i % cols) * (step === 1 ? 87 : 71);
          const y = 52 + Math.floor(i / cols) * 70;
          const highlight = i % 4 === 3;
          const chosen = step >= 3 && i === 19;
          const fill = chosen ? orange : highlight ? gold : white;
          body += group(rect(x, y, 59, 64, fill, highlight ? orange : teal, 8) +
            footprint(x + 29.5, y + 37, order[i % 4], chosen ? white : highlight ? ink : muted, 0.86) +
            label(x + 29.5, y + 56, i + 1, 13, chosen ? white : ink),
          `opacity="${i < 4 ? 1 : 0.15 + 0.85 * V.reveal(frame, Math.floor(i / 4))}"`);
        }
        if (step === 1) body += arrow(161, 151, 161 + 314 * Math.max(.05, V.reveal(frame)), 151) +
          fadeIn(frame, label(320, 190, 'Один повтор', 20, teal));
        if (step === 2) body += label(320, 286, '4 → 8 → 12 → 16 → 20 → 24', 19, teal);
        if (step >= 3) body += fadeIn(frame, label(320, 286, '10  •  15  •  20 = 5 × 4  •  22  •  23', 19, orange));
        return svg(body, 'Следы в последовательных группах из четырёх клеток. Одна правая нога выделена в конце каждой группы');
      },
    },
    3: {
      title: 'Секретный алфавит',
      short: 'У каждой буквы свой знак.',
      skill: 'Подстановка символов',
      question: 'Саша придумал секретный алфавит. Он записал слово ПИРОГ как показано на рисунке, а слово НАШ — как показано рядом. Как он запишет слово ШПИОН?',
      choices: pictureChoices('Шифр'),
      steps: [
        ['Условие', 'Прочитай два образца шифра', 'Один знак заменяет одну букву. Найди среди пяти записей слово ШПИОН.'],
        ['Ключ', 'Найди знак для Ш', 'В слове НАШ буква Ш стоит в конце. Ей соответствуют три наклонные черты.'],
        ['Отбор', 'Посмотри на первые знаки', 'Только вариант Д начинается с трёх наклонных черт. Проверь оставшиеся четыре знака.'],
        ['Проверка', 'Сверь П, И, О и Н', 'Знаки П, И и О берём из слова ПИРОГ, знак Н — из слова НАШ. Получается ШПИОН. Ответ Д.'],
      ],
      scene(step, frame) {
        let body = '';
        const samples = [['ПИРОГ', 115], ['НАШ', 405]];
        samples.forEach(([word, start]) => {
          if (step === 0) body += label(start + (word.length - 1) * 46 / 2 + 20, 33, word, 20);
          [...word].forEach((letter, i) => {
            const x = start + i * 46;
            const focus = (step >= 1 && letter === 'Ш') || (step >= 3 && 'ПИОН'.includes(letter));
            if (step > 0) body += label(x + 20, 33, letter, 20, focus ? orange : muted);
            if (focus) body += fadeIn(frame, rect(x + 1, 43, 38, 43, gold, 'none', 7));
            body += glyph(letter, x, 46);
          });
        });
        for (let i = 0; i < cipherOptions.length; i++) {
          const selected = step >= 2 && i === 4;
          const x = 90 + (i % 3) * 165, y = 112 + Math.floor(i / 3) * 69;
          body += rect(x - 24, y, 157, 59, selected ? pale : white, selected ? teal : muted, 9) +
            label(x - 10, y + 32, optionLetters[i], 14) +
            [...cipherOptions[i]].map((letter, j) => glyph(letter, x + 4 + j * 24, y + 7, selected && (!j || step === 3) ? orange : ink, 0.67)).join('');
          if (step >= 3 && selected) {
            body += [...cipherOptions[i]].map((letter, j) => label(x + 17 + j * 24, y + 51, letter, 13, teal)).join('');
          }
        }
        return svg(body, 'Два закодированных слова и пять вариантов записи слова ШПИОН');
      },
    },
    4: {
      title: 'Чей воздушный змей?',
      short: 'Проследи, куда ведёт каждая верёвочка.',
      skill: 'Трассировка линий',
      question: 'Какое изображение должно стоять вместо белого прямоугольника, чтобы получилась картинка, на которой каждый ребёнок держит своего воздушного змея?',
      choices: pictureChoices('Фрагмент'),
      steps: [
        ['Условие', 'Заполни пропуск на рисунке', 'Верёвочки должны продолжаться через прямоугольник. В местах пересечений продолжай вести пальцем по той же линии.'],
        ['Края', 'Отметь места входа и выхода', 'У верхней и нижней кромок по четыре конца. Вставка должна продолжать все восемь концов. Например, у варианта Б на нижней кромке только три конца.'],
        ['Правый змей', 'Проследи короткий путь', 'Во вставке Г верёвочка белого змея идёт от второго верхнего конца к крайнему правому нижнему. Она попадает к правому ребёнку.'],
        ['Левый змей', 'Проверь вторую верёвочку', 'Верёвочка серого змея проходит по двум наружным петлям и заканчивается у левого ребёнка. Обе верёвочки соединены правильно. Ответ Г.'],
      ],
      scene(step, frame) {
        let body = Object.values(kiteSegments).map((d) => path(d, ink, 2.7)).join('');
        body += `<polygon points="259,25 272,35 265,48 253,38" fill="${muted}" stroke="${ink}" stroke-width="2"/><polygon points="383,58 381,45 397,35 400,49" fill="${white}" stroke="${ink}" stroke-width="2"/>` +
          kid(273, 232, true) + kid(378, 232);
        if (step < 2) {
          body += rect(215, 127, 210, 57, white, muted);
          if (step === 1) {
            for (const x of [240, 294, 346, 400]) {
              body += fadeIn(frame, `<circle cx="${x}" cy="127" r="5" fill="${orange}"/><circle cx="${x}" cy="184" r="5" fill="${teal}"/>`);
            }
          }
        } else {
          body += piece(kitePieces[3], 215, 127, 1, ink, pale);
          body += fadeIn(frame, path(kiteSegments.white, teal, 4.5) + path(kiteSegments.boy, teal, 4.5) +
            group(path(kitePieces[3][1], teal, 4.5), 'transform="translate(215 127)"'));
          if (step >= 3) {
            body += fadeIn(frame, ['gray', 'upperLoop', 'lowerLoop', 'girl'].map((key) => path(kiteSegments[key], orange, 4.5)).join('') +
              group([0, 2, 3].map((i) => path(kitePieces[3][i], orange, 4.5)).join(''), 'transform="translate(215 127)"'));
          }
        }
        kitePieces.forEach((paths, i) => {
          const x = i < 2 ? 24 : 471, y = 76 + (i < 2 ? i : i - 2) * 62;
          const selected = step >= 2 && i === 3;
          body += piece(paths, x, y, 0.64, selected ? teal : ink, selected ? gold : white) +
            label(x + 67, y + 54, optionLetters[i], 15, selected ? teal : ink);
        });
        return svg(body, 'Два воздушных змея, двое детей и пять фрагментов с изгибами верёвочек');
      },
    },
    5: {
      title: 'Вид с обратной стороны',
      short: 'Перейди на другую сторону кирпичной конструкции.',
      skill: 'Пространственное воображение',
      question: 'Дина поставила три бруска на пол, а затем поставила перед ними белый кирпич. Когда она смотрит спереди, конструкция выглядит так, как показано на рисунке. Как выглядит эта конструкция с обратной стороны?',
      choices: pictureChoices('Вид'),
      steps: [
        ['Условие', 'Рассмотри конструкцию спереди', 'Белый кирпич закрывает нижнюю часть трёх брусков. Как они будут выглядеть с противоположной стороны?'],
        ['Глубина', 'Перейди за конструкцию', 'Белый кирпич теперь позади всех брусков, поэтому вариант Г отпадает. Узкий тёмный брусок изначально стоял перед широким светлым, значит сзади широкий светлый частично закроет тёмный.'],
        ['Стороны', 'Поменяй левую и правую стороны', 'Пара брусков, которая спереди была слева, при взгляде сзади окажется справа. Одиночный брусок окажется слева.'],
        ['Высота', 'Сверь высоту тонких брусков', 'Самый высокий брусок тёмный. Только вариант Б одновременно сохраняет высоту, порядок слоёв и стороны.'],
      ],
      scene(step, frame) {
        let body = '';
        if (step === 0) {
          body += label(320, 25, 'Спереди', 19) + group(bricks(), 'transform="translate(258 35) scale(1.28)"');
        } else if (step === 1) {
          body += label(320, 25, 'Сверху', 19);
          body += group(rect(220, 113, 200, 22, white) + rect(265, 84, 18, 18, brickColors[1]) +
            rect(257, 62, 34, 18, brickColors[2]) + rect(366, 75, 18, 19, brickColors[0]) +
            fadeIn(frame, arrow(320, 46, 320, 73) + label(394, 57, 'взгляд сзади', 14, teal)));
        } else {
          body += label(209, 25, 'Спереди', 19) + group(bricks(), 'transform="translate(161 40)"') +
            arrow(282, 84, 361, 84) + label(433, 25, 'Сзади', 19) +
            fadeIn(frame, group(bricks('Б', step >= 3), 'transform="translate(385 40)"'));
          if (step >= 3) body += line(414, 40, 477, 40, orange, 2, 'stroke-dasharray="5 4"');
        }
        optionLetters.forEach((option, i) => {
          const x = 26 + i * 118, y = 161, mark = step >= 3 && option === 'Б';
          body += rect(x, y, 109, 115, mark ? pale : white, mark ? teal : muted, 11) +
            group(bricks(option, mark), `transform="translate(${x + 15} ${y + 10}) scale(.82)"`) +
            label(x + 55, y + 103, option, 17, mark ? teal : ink);
        });
        return svg(body, 'Белый кирпич и три вертикальных бруска. Показаны исходное положение и варианты обратного вида');
      },
    },
  });

  const circle = (x, y, r, fill = white, stroke = ink, width = 1.6) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  const wheelLetters = 'ABCDEFG';
  const cyclic = (index) => ((index % 7) + 7) % 7;
  function wheels(cx, cy, scale, outerTurn = 0, innerTurn = 0, focus = '') {
    const point = (index, radius) => {
      const angle = (index * 360 / 7 - 110) * Math.PI / 180;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    };
    const ring = (radius, values, offset) => {
      let marks = '';
      const points = Array.from({ length: 7 }, (_, i) => point(i + offset, radius));
      const region = `<polygon points="${points.map((p) => p.join(',')).join(' ')}" stroke="${muted}" fill="none" stroke-width="1.4"/>`;
      points.forEach(([x, y], i) => {
        const value = values[i];
        const inner = radius === 52;
        const focusHere = focus.includes(value);
        const ringColor = focusHere ? (value === 'C' || value === '2' ? orange : teal) : ink;
        marks += circle(x, y, inner ? 12 : 13, focusHere ? gold : white, ringColor, focusHere ? 2.6 : 1.5) +
          label(x, y + 5, value, 15, ringColor);
      });
      return region + marks;
    };
    return group(ring(86, '1234567', outerTurn) + ring(52, wheelLetters, innerTurn),
      `transform="translate(${cx} ${cy}) scale(${scale})"`);
  }

  const boxWidth = { A: 50, B: 50, C: 100, D: 23, E: 50, F: 50 };
  const truck = [['A', 23, 0], ['B', 95, 0], ['C', 15, 1], ['D', 122, 1], ['E', 20, 2], ['F', 91, 2]];
  const ground = [
    [['F', 7, 0], ['C', 60, 0], ['E', 7, 1], ['D', 72, 1], ['B', 100, 1], ['A', 32, 2]],
    [['F', 36, 0], ['E', 116, 0], ['D', 57, 1], ['B', 124, 1], ['C', 9, 2], ['A', 124, 2]],
    [['E', 50, 0], ['F', 50, 1], ['C', 22, 2], ['B', 15, 3], ['A', 75, 3], ['D', 32, 4]],
    [['E', 50, 0], ['F', 50, 1], ['C', 22, 2], ['D', 30, 3], ['A', 55, 3], ['B', 41, 4]],
    [['E', 7, 0], ['F', 59, 0], ['D', 114, 0], ['C', 38, 1], ['A', 72, 2], ['B', 72, 3]],
  ];
  function boxes(stack, x, y, scale, focus = '') {
    return group(line(0, 0, 171, 0, ink, 2.8) + stack.map(([name, left, level]) => {
      const width = boxWidth[name], top = -31 * (level + 1);
      const active = focus.includes(name);
      return rect(left, top, width, 31, active ? gold : '#dfe8df', active ? orange : ink, 4) +
        label(left + width / 2, top + 22, name, 19, active ? orange : ink);
    }).join(''), `transform="translate(${x} ${y}) scale(${scale})"`);
  }

  const masses = [500, 200, 200, 100, 50, 20, 20, 5];
  function weight(x, y, value, emphasis = false, scale = 1) {
    const color = emphasis ? orange : teal;
    return group(circle(0, -30, 7, white, color) + rect(-26, -27, 52, 27, emphasis ? gold : pale, color, 6) +
      label(0, -8, value, 16, color), `transform="translate(${x} ${y}) scale(${scale})"`);
  }
  function balance(tilt, loaded) {
    const left = 145 - tilt, right = 145 + tilt;
    const packageDrawing = rect(425, right - 35, 66, 32, '#dec5aa', ink, 3) +
      path(`M425 ${right - 35} l10 -9 H500 v31 l-9 10 M491 ${right - 35} l9 -9`, ink, 1.5) +
      label(458, right - 12, '445 г', 17);
    return path('M288 208 L319 152 L350 208Z', teal, 2, `style="fill:${pale}"`) + line(266, 209, 373, 209, ink, 4) +
      line(170, left + 9, 470, right + 9, ink, 5) +
      line(170, left, 170, left + 9, ink, 3) + line(470, right, 470, right + 9, ink, 3) +
      rect(115, left - 2, 110, 9, pale, teal, 4) + rect(415, right - 2, 150, 9, pale, teal, 4) +
      packageDrawing + (loaded ? weight(168, left - 2, 500, true) +
        weight(520, right - 2, 50, true, 0.67) + weight(550, right - 2, 5, true, 0.47) : '');
  }

  Object.assign(lessons, {
    6: {
      title: 'Один росчерк',
      short: 'Нужно провести все три луча, не отрывая карандаш.',
      skill: 'Кратчайший маршрут',
      question: 'На рисунке изображена фигура из трёх отрезков с указанными длинами. Маша хочет нарисовать эту фигуру, не отрывая карандаш от бумаги. Какова длина наименьшего пути, который Маша должна провести, чтобы это сделать?',
      choices: ['6 см', '7 см', '8 см', '9 см', '10 см'],
      steps: [
        ['Условие', 'Нарисуй все три отрезка', 'Можно повторять часть пути, но нельзя отрывать карандаш. С какой ветки стоит начать?'],
        ['Тупики', 'Обрати внимание на концы', 'У фигуры три конца. Начало и конец пути могут занять самое большее два из них. Если прийти к третьему концу, придётся вернуться к развилке.'],
        ['Короткая ветвь', 'Проведи самый короткий отрезок дважды', 'Все три отрезка вместе имеют длину 6 см. Меньше всего добавит повтор отрезка длиной 1 см.'],
        ['Маршрут', 'Сложи четыре длины', 'Иди по отрезку 3 см к развилке, вниз на 1 см, обратно на 1 см и направо на 2 см. Получается 3 + 1 + 1 + 2 = 7 см. Ответ Б.'],
      ],
      scene(step, frame) {
        const vertices = [[165, 65], [320, 155], [320, 215], [425, 95]];
        const [left, middle, bottom, right] = vertices;
        let body = [left, bottom, right].map(([x, y]) => line(...middle, x, y, ink, 4)).join('') +
          label(226, 87, '3 см', 20, ink, 'transform="rotate(30 226 87)"') +
          label(383, 109, '2 см', 20, ink, 'transform="rotate(-30 383 109)"') + label(278, 194, '1 см', 20);
        if (step >= 1) {
          body += fadeIn(frame, [left, bottom, right].map(([x, y]) =>
            circle(x, y, 8, gold, orange, 2)).join('') + circle(...middle, 7, pale, teal, 2));
        }
        if (step === 1) {
          body += label(320, 262, 'У одного из трёх концов нужен разворот', 19, orange);
        } else if (step === 2) {
          body += fadeIn(frame, arrow(311, 168, 311, 207, orange) + arrow(330, 207, 330, 168, teal) +
            label(320, 262, '3 + 2 + 1 = 6 см, ещё раз проходим 1 см', 19, teal));
        } else if (step >= 3) {
          const traces = [[171, 76, 308, 154], [312, 166, 312, 207], [330, 207, 330, 167], [333, 155, 416, 105]];
          traces.forEach(([x1, y1, x2, y2], i) => {
            const progress = Math.max(.12, V.reveal(frame * 2, i * 2));
            body += arrow(x1, y1, x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress, i % 2 ? orange : teal);
          });
          body += label(320, 264, '3 + 1 + 1 + 2 = 7 см', 23, orange);
        }
        return svg(body, 'Три отрезка длиной 3, 2 и 1 сантиметр сходятся в одной точке');
      },
    },
    7: {
      title: 'Два колеса',
      short: 'Следи, как буквы перемещаются относительно цифр.',
      skill: 'Относительное движение',
      question: 'Два колеса вращаются одновременно в противоположных направлениях, делая полный оборот за 7 минут. В конце каждой минуты каждая буква внутреннего колеса находится точно перед одной из цифр внешнего колеса. На рисунке показаны начальное положение колёс и положение через минуту. В конце некоторой минуты буква С будет перед цифрой 2. Какая цифра окажется в этот момент перед буквой F?',
      choices: ['1', '4', '5', '6', '7'],
      steps: [
        ['Условие', 'Сравни два положения колёс', 'За минуту внешнее колесо сдвигается по часовой стрелке на одну позицию, внутреннее — на одну позицию против часовой.'],
        ['Сдвиг', 'Мысленно останови внешнее колесо', 'Тогда за каждую минуту буквы перемещаются относительно цифр на две позиции против часовой стрелки. За первую минуту C перемещается от 3 к 1.'],
        ['Буква C', 'Доведи C до цифры 2', 'За четыре минуты C проходит позиции 3 → 1 → 6 → 4 → 2.'],
        ['Буква F', 'Сделай столько же шагов для F', 'В то же время F проходит позиции 6 → 4 → 2 → 7 → 5. Когда C оказывается перед цифрой 2, F находится перед цифрой 5. Ответ В.'],
      ],
      scene(step, frame) {
        if (step === 0) {
          return svg(wheels(182, 133, 1.04) + wheels(458, 133, 1.04, 1, -1) +
            label(182, 267, '0 минут', 18) + label(458, 267, '1 минута', 18) + arrow(294, 133, 345, 133),
          'Рядом показаны два положения: начало движения и одна минута спустя');
        }
        const progress = V.reveal(frame), turning = step === 1 ? -2 * progress : step === 2 ? -8 * progress : -8;
        const alignedC = String(cyclic(Math.round(turning) + 2) + 1);
        const focus = step >= 3 ? 'C2F5' : `C${alignedC}`;
        let body = wheels(178, 147, 1.22, 0, turning, focus);
        for (let i = 0; i < 5; i++) {
          const x = 353 + i * 53;
          body += rect(x, 73, 47, 43, white, muted, 8) + label(x + 23.5, 100, i, 17);
          const visible = step !== 1 || i <= 1;
          const opacity = !visible ? .22 : .27 + .73 * V.reveal(frame * 2, i);
          body += group(rect(x, 128, 47, 46, i === 4 && step >= 2 ? gold : pale, orange, 8) +
            label(x + 23.5, 157, visible ? cyclic(2 - 2 * i) + 1 : '·', 20, orange), `opacity="${opacity}"`);
          if (step >= 3) {
            body += group(rect(x, 188, 47, 46, i === 4 ? gold : pale, teal, 8) +
              label(x + 23.5, 217, cyclic(5 - 2 * i) + 1, 20, teal), `opacity="${opacity}"`);
          }
        }
        body += label(475, 53, 'Минуты', 18) + label(335, 157, 'C', 19, orange);
        if (step >= 3) body += label(335, 217, 'F', 19, teal);
        return svg(body, 'Внешняя шкала стоит на месте. Таблица показывает, напротив каких цифр оказываются буквы');
      },
    },
    8: {
      title: 'Разгрузка грузовика',
      short: 'Верхние коробки должны покинуть грузовик первыми.',
      skill: 'Порядок действий',
      question: 'В грузовике находится шесть коробок, составленных так, как показано на рисунке. Грузчик выгружает их на землю по одной коробке за раз. При этом он может брать только ту коробку, на которой не стоит никакая другая коробка, и может ставить коробку или на землю, или на другую коробку. Какой из следующих вариантов грузчик не сможет составить?',
      choices: pictureChoices('Стопка'),
      steps: [
        ['Условие', 'Что можно взять первым?', 'Грузчик переносит по одной свободной сверху коробке. Её сразу нужно поставить в строящуюся стопку.'],
        ['В кузове', 'Найди порядок для B и D', 'В грузовике D стоит на B. Значит, сначала надо снять D, а только потом можно забрать B.'],
        ['На земле', 'Сравни порядок с вариантом В', 'В варианте В коробка D стоит на B. Чтобы собрать его, нужно было бы сначала поставить B на землю или в стопку, а D положить сверху потом.'],
        ['Противоречие', 'Два порядка несовместимы', 'При разгрузке D нужна раньше B, а при сборке варианта В — позже B. Остальные четыре стопки можно собрать в указанном под каждой порядке. Ответ В.'],
      ],
      scene(step, frame) {
        const focus = step > 0 ? 'DB' : '';
        let body = boxes(truck, step >= 2 ? 92 : 247, 133, .94, focus) +
          label(step >= 2 ? 174 : 330, 28, 'В грузовике', 18);
        if (step === 1) body += fadeIn(frame, arrow(429, 69, 429, 125, orange) + label(497, 103, 'D раньше B', 19, orange));
        if (step >= 2) {
          body += fadeIn(frame, arrow(278, 90, 366, 90, orange) + label(304, 71, 'D → B', 18, orange) +
            label(467, 28, 'Стопка В', 18) + boxes(ground[2], 410, 151, .72, focus));
          if (step >= 3) body += label(563, 100, 'B → D', 18, teal);
        }
        const buildOrders = ['F E C D A B', 'F E D C B A', '', 'E F C D A B', 'E F D C A B'];
        ground.forEach((stack, i) => {
          const selected = step >= 2 && i === 2;
          const possible = step >= 3 && !selected;
          const x = 25 + i * 118;
          body += rect(x - 6, 162, 112, 120, selected ? gold : possible ? pale : white,
            selected ? orange : possible ? teal : muted, 7) +
            boxes(stack, x + 2, 260, .55, selected ? focus : '') +
            label(x + 50, 277, optionLetters[i], 15, selected ? orange : ink);
          if (possible) body += label(x + 50, 295, buildOrders[i], 13, teal);
        });
        return svg(body, 'Стопка коробок в грузовике и пять вариантов расположения на земле');
      },
    },
    9: {
      title: 'Посылка на весах',
      short: 'Гири можно ставить на обе чаши.',
      skill: 'Равенство масс',
      question: 'У Пети есть посылка весом 445 г и набор гирь: 500, 200, 200, 100, 50, 20, 20, 5 г. Он кладёт посылку на весы. Какое минимальное количество гирь потребуется, чтобы весы пришли в равновесие?',
      choices: ['2', '3', '4', '5', '6'],
      steps: [
        ['Условие', 'Посмотри на обе чаши', 'На одной чаше лежит посылка массой 445 г. Уравновесь её минимальным количеством гирь. Гири можно добавлять на любую чашу.'],
        ['Единицы', 'Выдели единственную гирю по 5 г', 'Чтобы компенсировать цифру 5 в единицах массы посылки, надо использовать гирю 5 г. Все остальные гири весят целое число десятков граммов.'],
        ['Минимум', 'Проверь, хватит ли двух гирь', 'Если положить 5 г рядом с посылкой, на другой чаше нужно 450 г. Если положить 5 г напротив посылки, остаётся добавить туда 440 г. Ни одной гири такой массы нет.'],
        ['Равновесие', 'Собери равенство из трёх гирь', 'На одну чашу положи 500 г, на другую добавь к посылке 50 г и 5 г. Получится 500 = 445 + 50 + 5. Ответ Б.'],
      ],
      scene(step, frame) {
        let body = '';
        const maxMassX = 565;
        masses.forEach((mass, i) => {
          const x = 75 + (maxMassX - 75) * i / 7;
          const focus = (step >= 1 && i === 7) || (step >= 3 && (i === 0 || i === 4));
          body += weight(x, 56, mass, focus, .94);
        });
        if (step === 2) {
          body += fadeIn(frame, rect(57, 98, 249, 98, pale, teal, 9) + rect(334, 98, 249, 98, pale, teal, 9) +
            label(181, 129, '5 г рядом с посылкой', 17) + label(181, 168, '445 + 5 = 450 г', 22, teal) +
            label(458, 129, '5 г на пустой чаше', 17) + label(458, 168, '445 − 5 = 440 г', 22, teal) +
            label(320, 239, 'Ни 440 г, ни 450 г среди гирь нет', 19, orange));
        } else {
          body += balance(step === 3 ? 19 * (1 - V.reveal(frame)) : 19, step === 3);
          if (step >= 3) body += label(320, 254, '500 = 445 + 50 + 5', 24, orange);
          if (step === 1) body += fadeIn(frame, arrow(565, 62, 565, 103, orange) + label(513, 234, '445 оканчивается на 5', 16, orange));
        }
        return svg(body, 'Набор из восьми гирь, посылка и двухчашечные весы');
      },
    },
    10: {
      title: 'Номера квартир',
      short: 'Посчитай, сколько раз каждая цифра появляется в ряду номеров.',
      skill: 'Подсчёт цифр',
      question: 'Квартиры в доме пронумерованы в порядке возрастания, начиная с 1 (все номера – натуральные числа, ни одно число не пропущено). Кенгуру пересчитал цифры в номерах всех квартир. Он узнал, что цифра 2 встречается 14 раз, а цифра 5 – 3 раза. Какое наибольшее количество квартир может быть в этом доме?',
      choices: ['25', '26', '34', '35', '41'],
      steps: [
        ['Условие', 'Отличай цифры от номеров', 'В каждом номере может быть несколько нужных цифр. Нужно угадать, на каком номере остановился счёт.'],
        ['Цифра 2', 'Отметь каждую двойку', 'Считаем 2, 12, все номера от 20 до 29 и 32. В номере 22 две двойки, поэтому до 32 включительно их уже 14. Следующая была бы в 42.'],
        ['Цифра 5', 'Отметь каждую пятёрку', 'Первые три пятёрки стоят в номерах 5, 15 и 25. Следующая пятёрка появится в 35, поэтому 35 включать нельзя.'],
        ['Граница', 'Остановись перед первым лишним номером', 'До 34 включительно имеется ровно 14 двоек и 3 пятёрки. Номера 35 и 42 дали бы лишние цифры, а 35 идёт раньше. Максимум — 34 квартиры. Ответ В.'],
      ],
      scene(step, frame) {
        let body = '';
        for (let n = 1; n <= 42; n++) {
          const x = 38 + ((n - 1) % 7) * 81, y = 17 + Math.floor((n - 1) / 7) * 36;
          const digits = String(n);
          const hasTwo = step >= 1 && digits.includes('2');
          const hasFive = step >= 2 && digits.includes('5');
          const limit = step >= 3 && n === 34;
          const stop = (step >= 1 && n === 42) || (step >= 2 && n === 35);
          const fill = limit ? gold : hasFive || hasTwo ? pale : white;
          const stroke = limit || stop || hasFive ? orange : hasTwo ? teal : '#b8c6c0';
          let digitMarks = '';
          for (let i = 0; i < digits.length; i++) {
            const digit = digits[i];
            const color = digit === '2' && hasTwo ? teal : digit === '5' && hasFive ? orange : ink;
            digitMarks += label(x + 38 + (i - (digits.length - 1) / 2) * 13, y + 21, digit, 17, color);
          }
          const opacity = (hasTwo || hasFive || limit) ? .4 + .6 * V.reveal(frame * 2, n / 9) : 1;
          body += group(rect(x, y, 76, 30, fill, stroke, 5) + digitMarks, `opacity="${opacity}"`);
        }
        const note = ['', '14 двоек до 32, следующая — в 42', '3 пятёрки до 25, следующая — в 35', 'Последний допустимый номер — 34'][step];
        if (step > 0) body += fadeIn(frame, label(320, 269, note, 20, step >= 2 ? orange : teal));
        return svg(body, 'Последовательные номера квартир с отдельным выделением двоек и пятёрок');
      },
    },
  });
})();
