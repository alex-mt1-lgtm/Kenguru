'use strict';

(() => {
  const ink = '#172e34';
  const teal = '#237e79';
  const mint = '#d6ede6';
  const cream = '#fffefa';
  const warm = '#fce2c9';
  const pale = '#eaf0e6';
  const red = '#f4a594';
  const yellow = '#ffe095';
  const slate = '#d0d9d6';

  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const svg = (body, label) =>
    `<svg viewBox="0 0 640 300" role="img" aria-label="${escape(label)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const text = (x, y, title, size = 24, fill = ink) =>
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${fill}" style="font:700 ${size}px Arial,sans-serif">${escape(title)}</text>`;
  const panel = (x, y, width, height, fill = cream, stroke = slate) =>
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  const line = (x1, y1, x2, y2, stroke = ink, width = 3, extra = '') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
  const circle = (x, y, radius, fill, stroke = 'none') =>
    `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  const many = (count, draw) => Array.from({length: count}, (_, index) => draw(index)).join('');
  const progress = (frame, duration = 10, delay = 0) => Math.min(1, Math.max(0, (frame - delay) / duration));
  const reveal = (body, frame, delay = 0) => `<g opacity="${0.72 + 0.28 * progress(frame, 3, delay)}">${body}</g>`;
  const heading = title => text(320, 34, title, 24);
  const caption = (title, fill = mint) => panel(120, 231, 400, 45, fill) + text(320, 254, title, 21);

  function candles(step, frame) {
    const elapsed = step === 1 ? progress(frame, 8) : step >= 2 ? 1 : 0;
    const waxY = 110 + 82 * elapsed;
    const candles = many(10, index => {
      const x = 72 + index * 52;
      const color = [mint, yellow, warm, '#a0cde9', red][index % 5];
      return `<rect x="${x - 11}" y="${waxY}" width="22" height="${196 - waxY}" rx="5" fill="${color}" stroke="${teal}" stroke-width="2"/>`
        + line(x, waxY - 6, x, waxY + 1, ink, 2)
        + (elapsed < 1 ? `<path d="M ${x} ${waxY - 8} q -13 -3 0 -25 q 14 20 0 25" fill="#f09b4d"/>` : '');
    });
    const top = heading(['10 одинаковых свечек', 'Все горят одновременно', 'Погасли в один момент'][step]);
    const base = line(47, 199, 590, 199, teal, 3);
    const time = step === 0 ? caption('Зажгли одновременно', pale)
      : step === 1 ? panel(120, 241, 400, 22, cream) + line(137, 252, 137 + 365 * elapsed, 252, teal, 9)
        + text(320, 279, `${Math.round(20 * elapsed)} мин`, 18)
      : caption('Все погасли через 20 минут');
    return svg(top + candles + base + time, step === 0 ? 'Десять одинаковых зажжённых свечек' : 'Все свечки горят одно и то же время');
  }

  function digitTable(step, frame) {
    const rows = [
      ['112', '1 + 1 + 2 = 4', '1 × 1 × 2 = 2', '2 < 4'],
      ['209', '2 + 0 + 9 = 11', '2 × 0 × 9 = 0', '0 < 11'],
      ['312', '3 + 1 + 2 = 6', '3 × 1 × 2 = 6', '6 = 6'],
      ['212', '2 + 1 + 2 = 5', '2 × 1 × 2 = 4', '4 < 5'],
      ['222', '2 + 2 + 2 = 6', '2 × 2 × 2 = 8', '8 > 6'],
    ];
    const heads = ['Число', 'Сумма', 'Произведение', 'Сравнение'];
    const columns = [77, 225, 412, 561];
    const table = rows.map(([number, sum, product, relation], index) => {
      const y = 45 + index * 47;
      return panel(26, y, 588, 40, step === 3 && index === 4 ? mint : index % 2 === 0 ? cream : pale)
        + text(columns[0], y + 21, number, 22)
        + (step >= 1 ? reveal(text(columns[1], y + 21, sum, 18), frame, step === 1 ? index * 1.4 : 0) : '')
        + (step >= 2 ? reveal(text(columns[2], y + 21, product, 18), frame, step === 2 ? index * 1.4 : 0) : '')
        + (step === 3 ? reveal(text(columns[3], y + 21, relation, 20, index === 4 ? teal : ink), frame, index * 0.6) : '');
    }).join('');
    return svg(heads.map((item, index) => text(columns[index], 24, item, 17)).join('') + table,
      'Таблица сумм и произведений цифр');
  }

  function mouse(x, y, scale, fill) {
    return `<g transform="translate(${x} ${y}) scale(${scale})">
      <path d="M -13 0 C -30 -13 -38 6 -47 -3" fill="none" stroke="${teal}" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="-3" cy="2" rx="18" ry="11" fill="${fill}" stroke="${teal}" stroke-width="2"/>
      <ellipse cx="13" cy="-1" rx="11" ry="8" fill="${fill}" stroke="${teal}" stroke-width="2"/>
      <circle cx="11" cy="-9" r="5" fill="${warm}" stroke="${teal}" stroke-width="2"/>
      <circle cx="17" cy="-2" r="2" fill="${ink}"/>
      </g>`;
  }

  function pockets(step, frame) {
    if (step === 0) {
      const cards = [
        ['585', 'карманов'],
        ['3', 'мышки в кармане'],
        ['5', 'мышат у мышки'],
      ];
      return svg(heading('Куртка великана') + cards.map(([number, label], index) => {
        const x = 38 + index * 192;
        return panel(x, 83, 180, 129, [pale, mint, warm][index])
          + text(x + 90, 123, number, 42) + text(x + 90, 173, label, 15);
      }).join(''), '585 карманов, в каждом по три мышки, у каждой по пять мышат');
    }
    const rows = many(3, index => {
      const y = 90 + index * 52;
      return panel(104, y - 21, 429, 42, index % 2 === 0 ? pale : cream)
        + mouse(160, y, 0.8, mint) + text(232, y, '→', 22)
        + reveal(many(5, baby => mouse(290 + 47 * baby, y, 0.50, warm)), frame, step === 1 ? index * 3 : 0);
    });
    return svg(heading('Один карман') + rows + (step === 1 ? caption('3 × 5 = 15 мышат')
      : reveal(caption('585 × 3 × 5 = 8 775 мышат'), frame, 2)),
    'В одном кармане у трёх мышек по пять мышат');
  }

  function dial(x, y, radius, mirrored, numbered = false) {
    const scale = mirrored ? -1 : 1;
    const center = circle(0, 0, radius, cream, teal);
    const marks = many(12, index => {
      const angle = index * Math.PI / 6;
      const end = radius - 5;
      const start = end - (index % 3 === 0 ? 7 : 4);
      return line(start * Math.sin(angle), -start * Math.cos(angle),
        end * Math.sin(angle), -end * Math.cos(angle), ink, index % 3 === 0 ? 3 : 2);
    });
    const hands = line(0, 0, -radius * .77, 0, teal, 6)
      + line(0, 0, -radius * .51, -radius * .14, ink, 6)
      + circle(0, 0, 4, ink);
    const labels = numbered ? text(-55, 16, '9', 15) + text(-45, -25, '10', 15) : '';
    return `<g transform="translate(${x} ${y}) scale(${scale} 1)">${center}${marks}${text(0, -radius + 23, '12', 16)}${hands}${labels}</g>`;
  }

  function mirrorClock(step, frame) {
    if (step === 0) {
      return svg(heading('Часы в зеркале') + panel(210, 65, 220, 208, '#e8f3ef')
        + dial(320, 169, 83, true), 'Зеркальное отражение часов, длинная стрелка справа, короткая немного выше');
    }
    const mirror = panel(70, 59, 213, 193, '#e8f3ef') + dial(176, 149, 69, true)
      + text(176, 233, 'Отражение', 17);
    const wall = line(320, 68, 320, 231, teal, 2, 'stroke-dasharray="7 8"');
    const trueClock = panel(357, 59, 213, 193, cream) + dial(464, 149, 69, false, step >= 2)
      + text(464, 233, step === 1 ? 'Часы' : step === 2 ? '45 минут' : '9:45', 19);
    const labels = ['Часы в зеркале', 'Меняем правую и левую стороны', 'Длинная стрелка у девятки', 'Короткая стрелка ещё не дошла до 10'];
    const focus = step === 2 ? circle(412, 149, 9, 'none', '#e08b38')
      : step === 3 ? circle(429, 139, 9, 'none', '#e08b38') : '';
    return svg(heading(labels[step]) + mirror + wall + reveal(trueClock + focus, frame, 1),
      'Сравнение отражения и настоящего положения стрелок');
  }

  function busScene(step, frame) {
    const top = heading('Пассажиры в автобусе');
    if (step === 0) {
      const bus = `<g fill="${mint}" stroke="${teal}" stroke-width="3"><path d="M185 160 V108 Q185 85 205 85 H418 L454 120 V160 Z" /></g>`
        + many(4, index => panel(208 + index * 50, 100, 43, 28, cream, teal))
        + circle(224, 162, 14, ink) + circle(413, 162, 14, ink) + text(320, 148, '18 пассажиров', 19);
      return svg(top + bus + panel(117, 210, 190, 43, warm) + text(212, 232, '4 выходят', 19)
        + panel(333, 210, 190, 43, mint) + text(428, 232, '6 входят', 19), 'В автобусе 18 пассажиров, на каждой остановке 4 выходят и 6 входят');
    }
    if (step === 1) {
      return svg(top + panel(81, 83, 210, 86, warm) + text(186, 114, '−4', 35)
        + text(186, 148, 'выходят', 16) + panel(349, 83, 210, 86, mint) + text(454, 114, '+6', 35)
        + text(454, 148, 'входят', 16) + reveal(caption('6 − 4 = 2 пассажира'), frame, 3),
      'На каждой остановке число пассажиров увеличивается на два');
    }
    const stops = many(5, index => {
      const x = 33 + 117 * index;
      return panel(x, 122, 108, 75, index === 4 && step === 3 ? mint : pale)
        + text(x + 54, 143, index === 0 ? 'В начале' : `После ${index}-й`, 16)
        + reveal(text(x + 54, 174, 18 + 2 * index, 29), frame, step === 2 ? index * 1.4 : 0)
        + (index < 4 ? reveal(text(x + 108, 102, '+2', 18, teal), frame, step === 2 ? index * 1.4 + 1 : 0) : '');
    });
    return svg(top + stops + (step === 3 ? reveal(caption('18 + 4 × 2 = 26 пассажиров'), frame, 2) : ''),
      'Число пассажиров после каждой из четырёх остановок');
  }

  function balanceScene(step, frame) {
    const weight = (x, y, width, height, number) => panel(x, y, width, height, '#bdcbc7', teal)
      + circle(x + width / 2, y - 2, 6, '#bdcbc7', teal) + text(x + width / 2, y - 21, `${number} г`, 17);
    const orange = circle(416, 163, 31, '#f4ab52', '#c77b32')
      + `<path d="M416 137 q6 -16 22 -10 q-6 11 -22 10" fill="${teal}"/>`;
    const base = `<path d="M320 215 l-24 42 h48 z" fill="${teal}"/>`
      + line(174, 217, 466, 217, teal, 5) + line(174, 197, 174, 217, teal, 4)
      + line(466, 197, 466, 217, teal, 4) + line(80, 197, 265, 197, ink, 4)
      + line(375, 197, 560, 197, ink, 4);
    const left = weight(90, 115, 97, 80, 200) + weight(208, 160, 47, 35, 5);
    const knownRight = weight(465, 145, 75, 50, 50);
    const subtract = step === 2 ? progress(frame, 8, 1) : step >= 3 ? 1 : 0;
    if (step < 2) {
      const sum = step === 1 ? reveal(text(174, 75, '200 + 5 = 205 г', 20, teal), frame, 2) : '';
      return svg(heading('Весы в равновесии') + sum + base + left + orange + knownRight, 'На левой чаше гири 200 и 5 граммов. На правой апельсин и гиря 50 граммов');
    }
    const captions = step === 2 ? 'Убираем по 50 г с каждой чаши' : 'Апельсин весит 155 г';
    return svg(heading(captions) + base + orange + (step === 2 ? `<g opacity="${1 - subtract}">${knownRight}</g>` : '')
      + panel(86, 130, 175, 63, mint) + text(174, 162, subtract < 1 ? '205 − 50 г' : '155 г', 25)
      + text(320, 277, '205 − 50 = 155', 21, teal),
    'С каждой стороны убрали по 50 граммов, остались 155 граммов и апельсин');
  }

  function parrotScene(step, frame) {
    if (step === 0) {
      const snake = `<path d="M100 144 C148 68 177 203 232 133 S324 72 371 138 S460 199 517 122"
        fill="none" stroke="${teal}" stroke-width="17" stroke-linecap="round"/>`
        + `<ellipse cx="97" cy="140" rx="25" ry="17" fill="${teal}"/>` + circle(88, 137, 4, cream);
      return svg(heading('Длина удава') + panel(55, 62, 530, 133, mint) + snake
        + caption('12 м = 48 попугаев', pale), 'Одна длина удава равна 12 метрам и 48 попугаям');
    }
    const blocks = many(step === 1 ? 12 : 1, index => {
      const x = step === 1 ? 47 + index % 6 * 92 : 188;
      const y = step === 1 ? 77 + Math.floor(index / 6) * 72 : 113;
      const w = step === 1 ? 84 : 264;
      const dots = many(4, place => panel(x + 5 + place * (w - 5) / 4, y + 12, (w - 24) / 4, 28,
        step === 1 ? mint : place === 0 ? yellow : mint, teal));
      return panel(x, y, w, 54, cream) + reveal(dots, frame, step === 1 ? index * 0.55 : 0);
    });
    return svg(heading(step === 1 ? '12 метров, в каждом 4 попугая' : 'Один метр делим на четыре части') + blocks
      + (step === 1 ? caption('48 : 12 = 4 попугая в метре') : caption('100 см : 4 = 25 см')),
    'Делим длину удава на равные части, чтобы найти длину одного попугая');
  }

  function cipherScene(step, frame) {
    const code = '12342562756278';
    const letters = 'МОЙВОПРОСПРОСТ';
    const letterRow = (content, y, highlight = [], fill = mint) => [...content].map((character, index) => {
      const x = 28 + index * 42;
      return panel(x, y, 37, 43, highlight.includes(index) ? fill : cream)
        + text(x + 18.5, y + 22, character, 22);
    }).join('');
    if (step === 0) {
      return svg(heading('Шифровка от Кенгуру') + letterRow(code, 107) + caption('Одинаковая цифра — одна буква', pale),
        'Шифровка 12342562756278');
    }
    if (step === 1) {
      const counts = [13, 13, 13, 14, 14];
      return svg(heading('Сколько букв в каждом варианте?') + letterRow(code, 66)
        + counts.map((count, index) => {
          const x = 42 + index * 113;
          return panel(x, 137, 105, 67, count === 14 ? mint : pale)
            + text(x + 52, 155, 'ABCDE'[index], 17)
            + reveal(text(x + 52, 181, count, 22), frame, index * 1.4);
        }).join('') + caption('В шифровке 14 цифр'),
      'Только два варианта содержат 14 букв');
    }
    const twos = [1, 4, 7, 11];
    const highlights = step === 2 ? [1, 4] : twos;
    return svg(heading(step === 2 ? 'У цифры 2 везде одна буква' : 'Все буквы на своих местах')
      + letterRow(code, 64, highlights)
      + reveal(letterRow(step === 2 ? 'ВПЕРЕДКПОБЕДАМ' : letters, 122, highlights, step === 2 ? warm : mint), frame, 2)
      + (step === 2 ? caption('П и Е заняли места цифры 2', warm)
        : caption('«Мой вопрос прост»')),
    'Проверка одинаковых цифр и букв');
  }

  function tripletsScene(step, frame) {
    const triple = (x, y, fill, label) => panel(x, y, 87, 52, fill) + many(3, index => {
      const head = x + 20 + 23 * index;
      return circle(head, y + 15, 5, teal) + line(head, y + 23, head, y + 34, teal, 8);
    }) + (label ? text(x + 44, y + 70, label, 16) : '');
    if (step === 0) {
      return svg(heading('Ребята идут тройками') + triple(276, 96, mint, 'Маша, Витя и Коля')
        + panel(71, 201, 223, 47, pale) + text(182, 225, 'Седьмая спереди', 19)
        + panel(345, 201, 223, 47, pale) + text(456, 225, 'Пятая сзади', 19),
      'Тройка Маши, Вити и Коли седьмая спереди и пятая сзади');
    }
    const ahead = many(6, index => reveal(triple(41 + 94 * index, 72, pale, ''), frame, step === 1 ? index + 1 : 0));
    const behind = step >= 2 ? many(4, index => reveal(triple(135 + 94 * index, 146, pale, ''), frame, step === 2 ? index + 1 : 0)) : '';
    const title = ['', 'Перед ними шесть троек', 'Четыре тройки сзади', 'В каждой тройке три ученика'][step];
    return svg(heading(title)
      + ahead + triple(41, 146, mint, '') + behind
      + (step === 1 ? caption('7 − 1 = 6 троек впереди')
        : step === 2 ? caption('6 + 1 + 4 = 11 троек')
          : reveal(caption('11 × 3 = 33 ученика'), frame, 2)),
    'Шесть троек впереди, выделенная тройка и четыре тройки сзади');
  }

  function minimumNumber(step, frame) {
    const digits = '4921508';
    const kept = step === 0 ? [] : step === 1 ? [3] : step === 2 ? [3, 5] : [3, 5, 6];
    const dropped = step === 0 ? [] : step === 1 ? [0, 1, 2] : [0, 1, 2, 4];
    const row = [...digits].map((digit, index) => {
      const x = 37 + index * 82;
      const crossed = dropped.includes(index);
      const length = 43 + 16 * progress(frame, 5, index * 0.3);
      return panel(x, 91, 73, 73, kept.includes(index) ? mint : crossed ? warm : cream)
        + text(x + 36, 128, digit, 34)
        + (crossed ? line(x + 7, 135, x + length, 122, '#9a462e', 4) : '');
    }).join('');
    const titles = ['Исходное число', 'Самая маленькая первая цифра — 1',
    'После единицы выбираем 0', 'Последняя оставшаяся цифра — 8'];
    const footer = ['Вычеркни четыре цифры', 'Ноль не годится на первое место', 'Справа от нуля ещё есть восьмёрка', 'Осталось число 108'];
    return svg(heading(titles[step]) + row + caption(footer[step], step === 0 ? pale : mint),
      step === 0 ? 'Число 4 921 508' : 'Выбираем три цифры по порядку, чтобы получить самое маленькое число');
  }

  const lessons = [
    {
      title: 'Десять свечек', label: 'Свечки', skill: 'Сравниваем время одновременных событий',
      answer: 1, choices: ['2 мин.', '20 мин.', '200 мин.', '2 часа', '30 мин.'],
      question: 'Праздничная свечка сгорает за 20 минут. В честь «Кенгуру» зажгли одновременно 10 таких свечек. Сколько времени они будут гореть?',
      steps: [
        ['Твоё решение', 'Сколько времени будут гореть свечки?', 'Все свечки одинаковые. Зажгли их одновременно.'],
        ['Один старт', 'Каждая свечка горит 20 минут', 'Когда проходит одна минута, она проходит сразу для всех десяти свечек. Так же идут и остальные минуты.'],
        ['Ответ', 'Все погаснут через 20 минут', 'Свечки зажгли в один момент. Каждая сгорает за 20 минут, поэтому они погаснут вместе.'],
      ],
      scene: candles,
    },
    {
      title: 'Сумма или произведение', label: 'Цифры', skill: 'Складываем и умножаем цифры',
      answer: 4, choices: ['112', '209', '312', '212', '222'],
      question: 'В каком из следующих чисел произведение цифр больше, чем сумма цифр?',
      steps: [
        ['Твоё решение', 'Какое число подходит?', 'У каждого числа сложи цифры, а потом перемножь их. Сравни два результата.'],
        ['Суммы', 'Складываем цифры каждого числа', 'По порядку получаем суммы 4, 11, 6, 5 и 6.'],
        ['Произведения', 'Умножаем цифры каждого числа', 'Произведения по порядку равны 2, 0, 6, 4 и 8. При умножении на ноль результат равен нулю.'],
        ['Ответ', 'Подходит число 222', 'Только у числа 222 произведение больше суммы. Получилось 8 > 6. У числа 312 результаты равны, поэтому оно не подходит.'],
      ],
      scene: digitTable,
    },
    {
      title: 'Мышата великана', label: 'Карман', skill: 'Находим общее число предметов в группах',
      answer: 3, choices: ['(585 : 3) : 5', '(585 · 3) : 5', '(585 · 5) : 3', '585 · 3 · 5', '585 · (5 + 3)'],
      question: 'У великана на куртке 585 карманов. В каждом кармане живёт по три мышки, а у каждой мышки по пять мышат. Сколько мышат обитает в куртке великана?',
      steps: [
        ['Твоё решение', 'Сколько мышат в куртке?', 'У каждой из трёх мышек в кармане есть свои пять мышат. Выбери выражение для общего числа мышат.'],
        ['Один карман', 'Три группы по пять мышат', 'В одном кармане получается 5 + 5 + 5 = 15 мышат. То же число можно получить умножением 3 × 5.'],
        ['Ответ', 'Умножаем на 585 карманов', 'Во всех карманах одинаковое число мышат. Всего их 585 × (3 × 5) = 8 775. Подходит выражение 585 · 3 · 5.'],
      ],
      scene: pockets,
    },
    {
      title: 'Часы в зеркале', label: 'Часы', skill: 'Читаем часы после отражения',
      answer: 4, choices: ['15.15', '10.15', '14.45', '8.45', '9.45'],
      question: 'Правильно идущие часы отражаются в зеркале. Который сейчас час?',
      steps: [
        ['Твоё решение', 'Какое время показывают часы?', 'На рисунке видны часы в зеркале. Посмотри, куда направлены длинная и короткая стрелки.'],
        ['Отражение', 'Меняем правую и левую стороны', 'Верх и низ остаются на месте. Длинная стрелка переходит с правой стороны циферблата на левую. Короткая оказывается над ней.'],
        ['Минуты', 'Длинная стрелка показывает 45 минут', 'На настоящих часах она смотрит влево, на девятку. Каждый шаг от одной цифры до следующей равен пяти минутам. Девять шагов от 12 дают 45 минут.'],
        ['Ответ', 'Короткая стрелка между 9 и 10', 'Она уже прошла девятку, но ещё не дошла до десятки. Значит, часы показывают 9.45.'],
      ],
      scene: mirrorClock,
    },
    {
      title: 'Четыре остановки', label: 'Автобус', skill: 'Считаем одинаковые прибавления',
      answer: 3, choices: ['42', '28', '36', '26', '20'],
      question: 'В автобусе сначала ехали 18 пассажиров. Потом на каждой остановке выходили 4 человека, а входили 6 человек. Сколько пассажиров ехали в автобусе между четвёртой и пятой остановками?',
      steps: [
        ['Твоё решение', 'Сколько пассажиров после четвёртой остановки?', 'В автобусе в начале 18 человек. На каждой остановке часть пассажиров выходит, а другие входят.'],
        ['Одна остановка', 'Пассажиров становится на два больше', 'Из автобуса выходят четверо. Четверо из шести вошедших занимают их места, и добавляются ещё двое. Получаем 6 − 4 = 2.'],
        ['Четыре остановки', 'Прибавляем по два четыре раза', 'После первой остановки в автобусе 20 пассажиров, после второй 22, после третьей 24, после четвёртой 26. Пятую остановку ещё не проехали.'],
        ['Ответ', 'В автобусе 26 пассажиров', 'За четыре остановки прибавилось 4 × 2 = 8 человек. Между четвёртой и пятой остановками в автобусе едут 18 + 8 = 26 пассажиров.'],
      ],
      scene: busScene,
    },
    {
      title: 'Апельсин на весах', label: 'Весы', skill: 'Убираем одинаковый вес с обеих чаш',
      answer: 2, choices: ['200 г', '205 г', '155 г', '255 г', 'невозможно определить'],
      question: 'Весы на рисунке находятся в равновесии. Сколько весит апельсин?',
      steps: [
        ['Твоё решение', 'Сколько весит апельсин?', 'На левой чаше гири 200 г и 5 г. На правой чаше лежат апельсин и гиря 50 г.'],
        ['Левая чаша', 'Слева всего 205 граммов', 'Весы стоят ровно. Апельсин и гиря справа вместе тоже весят 200 + 5 = 205 г.'],
        ['Убираем гирю', 'Вычитаем по 50 граммов', 'Справа убираем гирю. Чтобы сохранить равенство, вычитаем 50 г и из массы слева. Получаем 205 − 50 = 155 г.'],
        ['Ответ', 'Апельсин весит 155 граммов', 'Проверим. Апельсин и гиря на правой чаше весят 155 + 50 = 205 г, столько же, сколько гири слева.'],
      ],
      scene: balanceScene,
    },
    {
      title: 'Длина в попугаях', label: 'Удав', skill: 'Сравниваем длины и переводим метры в сантиметры',
      answer: 3, choices: ['25 мм', '20 см', '225 мм', '25 см', '20 см 5 мм'],
      question: 'Длина удава — 12 м, или 48 попугаев. Какова длина попугая?',
      steps: [
        ['Твоё решение', 'Какова длина попугая?', 'Одна и та же длина удава измерена в метрах и в попугаях.'],
        ['Один метр', 'В каждом метре четыре попугая', 'Распределим 48 попугаев поровну по 12 метрам. На один метр приходится 48 : 12 = 4 попугая.'],
        ['Ответ', 'Один попугай — 25 сантиметров', 'Один метр равен 100 сантиметрам. Делим их поровну на четыре части. Получаем 100 : 4 = 25 сантиметров.'],
      ],
      scene: parrotScene,
    },
    {
      title: 'Шифровка от Кенгуру', label: 'Шифровка', skill: 'Проверяем длину и повторяющиеся символы',
      answer: 4, choices: ['Думай и трудись', 'Гуляй и отдыхай', 'Привет от Кенги', 'Вперед к победам', 'Мой вопрос прост'],
      question: 'От Кенгуру из Австралии получена шифровка 12342562756278. В ней разные цифры обозначают разные буквы, а одинаковые цифры — одинаковые буквы. Что могло быть написано в шифровке?',
      steps: [
        ['Твоё решение', 'Какая фраза зашифрована?', 'Сравни запись с пятью фразами. Пробелы между словами можно пропустить.'],
        ['Длина', 'Ищем фразы из 14 букв', 'В шифровке 14 цифр. В первых трёх фразах по 13 букв. Остаются «Вперед к победам» и «Мой вопрос прост».'],
        ['Повторы', 'На втором и пятом местах одна цифра', 'На втором месте шифра стоит 2. На пятом тоже 2. Во фразе «Вперед к победам» на этих местах разные буквы П и Е. Она не подходит.'],
        ['Ответ', 'Зашифровано «Мой вопрос прост»', 'Проверим все восемь цифр. 1 — М, 2 — О, 3 — Й, 4 — В, 5 — П, 6 — Р, 7 — С, 8 — Т. Получаем «Мой вопрос прост».'],
      ],
      scene: cipherScene,
    },
    {
      title: 'Тройками в музей', label: 'Тройки', skill: 'Считаем группы с двух концов очереди',
      answer: 3, choices: ['15', '21', '30', '33', '36'],
      question: 'Ученики третьего класса после уроков пошли в музей. Учительница попросила их построиться тройками. Маша, Витя и Коля заметили, что их тройка седьмая спереди и пятая сзади. Сколько учеников пошли в музей?',
      steps: [
        ['Твоё решение', 'Сколько учеников пошли в музей?', 'Ребята стоят по трое. Нашу тройку можно найти как с начала очереди, так и с конца.'],
        ['Спереди', 'Перед тройкой ребят — шесть троек', 'Если считать спереди, Маша, Витя и Коля стоят в седьмой тройке. Значит, впереди 7 − 1 = 6 троек.'],
        ['Сзади', 'За тройкой ребят — четыре тройки', 'Если считать сзади, ребята стоят в пятой тройке. Значит, за ними 5 − 1 = 4 тройки. Добавляем их собственную тройку к тем, что впереди и сзади. Всего 6 + 1 + 4 = 11 троек.'],
        ['Ответ', 'В музей пошли 33 ученика', 'В каждой тройке три человека. Всего 11 × 3 = 33 человека.'],
      ],
      scene: tripletsScene,
    },
    {
      title: 'Вычеркни четыре цифры', label: 'Минимум', skill: 'Выбираем цифры слева направо',
      answer: 3, choices: ['4, 9, 2, 1', '4, 2, 1, 0', '1, 5, 0, 8', '4, 9, 2, 5', '4, 9, 5, 8'],
      question: 'Какие четыре цифры надо вычеркнуть из числа 4 921 508, чтобы получившееся трёхзначное число было как можно меньше?',
      steps: [
        ['Твоё решение', 'Какие цифры нужно вычеркнуть?', 'Вычёркивай цифры, сохраняя порядок остальных. Должно остаться трёхзначное число.'],
        ['Сотни', 'Оставляем 1 цифрой сотен', 'Чем меньше цифра сотен, тем меньше число. Ноль в начале не годится, так как число тогда будет короче. Единица — самая маленькая подходящая цифра. Справа от неё ещё есть три цифры.'],
        ['Десятки', 'Из оставшихся цифр выбираем 0', 'После единицы стоят 5, 0 и 8. Самая маленькая из них — 0, и после неё мы можем оставить 8.'],
        ['Ответ', 'Получилось число 108', 'Остались цифры 1, 0 и 8. Мы вычеркнули 4, 9, 2 и 5.'],
      ],
      scene: minimumNumber,
    },
  ];

  globalThis.KENGURU_2000_THREE = lessons.map((lesson, index) => ({...lesson, number: index + 1}));
})();
