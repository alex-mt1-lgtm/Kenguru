'use strict';

(() => {
  const latin = ['A', 'B', 'C', 'D', 'E'];
  const cyrillic = ['А', 'Б', 'В', 'Г', 'Д'];
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const archive = globalThis.KENGURU_ARCHIVE ??= {};
  const source = 'assets/kenguru';
  const ink = '#173439';
  const teal = '#237e79';
  const mint = '#e5f2ea';
  const muted = '#e8eee8';
  const line = '#b3c6bf';
  const gold = '#f7dda8';

  const text = (x, y, value, size = 27, color = ink, anchor = 'middle') =>
    `<text x="${x}" y="${y}" fill="${color}" font-family="system-ui, sans-serif" font-weight="700" font-size="${size}" text-anchor="${anchor}" dominant-baseline="middle">${escape(value)}</text>`;
  const box = (x, y, w, h, fill, stroke = 'none', radius = 10) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
  const segment = (x1, y1, x2, y2, color, width = 3) =>
    `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  const dot = (x, y, radius, fill) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`;
  const svg = (width, height, label, inside, className = 'legacy-scene') =>
    `<svg class="${className}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(label)}">${inside}</svg>`;
  const image = (url, width, height) => `<image href="${url}" width="${width}" height="${height}"/>`;
  const progress = (frame, end) => Math.max(0, Math.min(1, frame / end));

  function renderOriginal(url, width, height, label, mark, frame) {
    let focus = '';
    if (mark) {
      const [x, y, w, h] = mark;
      const dash = .68 + .32 * progress(frame, 8);
      focus = `<rect x="${x - 4}" y="${y - 2}" width="${w + 8}" height="${h + 4}" rx="4" fill="none" stroke="${teal}" stroke-width="4" pathLength="1" stroke-dasharray="${dash} 1"/>`;
    }
    return svg(width, height, label, image(url, width, height) + focus);
  }

  function crop(url, width, height, [sx, sy, sw, sh], x, y, w, h) {
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}" style="overflow:hidden">${image(url, width, height)}</svg>`;
  }

  function workedScene([height, drawing], label, answer) {
    const size = 720;
    const band = answer ? 51 : 0;
    const badge = answer
      ? box(16, height, size - 32, 42, mint, line) + text(size / 2, height + 21, `Ответ ${answer}`, 24, teal)
      : '';
    return svg(size, height + band, label, drawing + badge, 'legacy-scene legacy-worked-scene');
  }

  // Extract only equations that the author explicitly uses in this step. A
  // space can group thousands, so it must not split their numeric tokens.
  const number = String.raw`[−-]?\d+(?:[ \u00a0\u202f]\d{3}(?!\d))*(?:[.,]\d+)?`;
  const operator = String.raw`[+−–×·⋅*÷:/=<>≤≥-]`;
  const equation = new RegExp(String.raw`${number}(?:\s*${operator}\s*${number})+`, 'gu');
  const tokens = new RegExp(String.raw`^(${number})|(${operator})\s*(${number})`, 'gu');

  function equationsIn(message) {
    return [...message.matchAll(equation)].map(match => match[0])
      .filter(value => /[=<>≤≥]/u.test(value))
      .map(value => [...value.matchAll(tokens)].flatMap(([, first, sign, next]) => first ? [first] : [sign, next]));
  }

  function drawEquations(rows, frame) {
    const drawing = rows.map((parts, row) => {
      const current = Math.min(parts.length - 1, Math.floor(Math.max(0, frame - row * 4) / 2));
      const sizes = parts.map((part, i) => i % 2 ? 32 : Math.max(48, 23 + part.length * 17));
      const width = sizes.reduce((sum, w) => sum + w, 0);
      const factor = Math.min(640 / width, 1);
      let x = (720 - width * factor) / 2;
      const y = 15 + row * 75;
      return box(16, y, 688, 62, '#f6f8f3') + parts.map((part, i) => {
        const w = sizes[i] * factor;
        const highlight = current === i;
        const result = i === parts.length - 1;
        const plate = (i % 2 === 0 || highlight)
          ? box(x + 2, y + 7, w - 4, 48, highlight ? gold : result ? mint : '#fff', result ? teal : 'none') : '';
        const item = plate + text(x + w / 2, y + 31, part, 32 * factor, result ? teal : ink);
        x += w;
        return item;
      }).join('');
    }).join('');
    return [rows.length * 75 + 13, drawing];
  }

  // The checked statement and the worksheet choices are transcribed together.
  // For illustrated choices, the approach below uses the original artwork.
  const authored = {
    '2001/3': {
      question: 'У Йозефа было 7 палочек. Он разломал одну из них пополам. Сколько теперь у него палочек?',
      choices: ['5', '6', '7', '8', '9'],
      draw: drawSticks,
    },
    '2002/2': {
      question: 'Чему равно число 2 + 2 − 2 + 2 − 2 + 2 − 2 + 2 − 2 + 2?',
      choices: ['0', '2', '4', '12', '20'],
      draw: drawPairs,
    },
    '2003/3': {
      question: 'На какой картинке сердечки составляют ровно три четверти от общего числа фигурок?',
      crop: [73, 65, 662, 131],
      illustration: 'Пять рисунков с сердечками, ромбами и треугольниками, варианты от A до E',
      draw: drawHearts,
    },
    '2004/4': {
      question: 'Сережа шел по лестнице, шагая через ступеньку (первую ступеньку он пропустил). При этом он считал шаги: «Один, два, три…». После того, как он сказал «пять», оказалось, что осталась одна ступенька. Сколько всего ступенек на лестнице?',
      choices: ['5', '7', '9', '11', '12'],
      draw: drawStairs,
    },
    '2005/3': {
      illustration: 'Квадратная таблица с восемью кенгуру',
      draw: drawKangaroos,
    },
    '2006/10': {
      question: 'Петя прибавляет различные однозначные числа к числу 96. Сколько раз он получит трехзначное число?',
      choices: ['3', '4', '5', '6', '7'],
      draw: drawNumberLine,
    },
    '2007/1': {
      question: 'Сколько общих букв у слов КЕНГУРУ и МАТЕМАТИКА?',
      choices: ['1', '2', '3', '4', '5'],
      draw: drawLetters,
    },
    '2008/6': {
      question: 'В первом аквариуме на 12 рыбок больше, чем во втором. Сколько рыбок надо переселить из первого аквариума во второй, чтобы рыбок в них стало поровну?',
      choices: ['12', '8', '6', '4', '2'],
      draw: drawAquariums,
    },
    '2009/2': {
      question: '200 × 9 + 200 + 9 = ?',
      choices: ['418', '1909', '2009', '4018', '20009'],
    },
    '2010/2': {
      question: 'Дети измерили шагами длину дорожки. У Ани получилось 17 шагов, у Наташи 15, у Дениса 14, у Вани 13 и у Тани 12. Кто из этих детей имеет самый длинный шаг?',
      choices: ['Аня', 'Наташа', 'Денис', 'Ваня', 'Таня'],
      draw: (step, frame) => drawBars(
        ['Аня', 'Наташа', 'Денис', 'Ваня', 'Таня'], [17, 15, 14, 13, 12], step === 2 ? 4 : -1, frame),
    },
    '2011/3': {
      question: 'Через три с половиной часа отправляется поезд, на котором Сёма поедет к бабушке. Боясь проспать, он проснулся полтора часа назад. За сколько часов до отправления поезда Сёма проснулся?',
      choices: ['за полтора часа', 'за 2 часа', 'за 3 с половиной часа', 'за 4 часа', 'за 5 часов'],
      draw: (step, frame) => drawTimeline(
        ['Пробуждение', 'Сейчас', 'Отправление'], [1.5, 3.5], ['1,5 ч', '3,5 ч'], step === 2 ? '5 часов' : '', frame),
    },
    '2012/4': {
      question: 'Три воздушных шарика стоят на 12 рублей больше, чем один шарик. Сколько стоит один шарик?',
      choices: ['4 руб.', '6 руб.', '8 руб.', '10 руб.', '12 руб.'],
      draw: drawBalloons,
    },
    '2013/4': {
      question: 'Миша измерил длины пяти палочек и записал результаты этих измерений. Какой из результатов А–Д самый большой?',
      choices: ['3 дм 2 см', '3 см 7 мм', '35 мм', '3 см', '302 мм'],
      draw: (step, frame) => step === 1
        ? drawEquations(equationsIn('300 + 20 = 320'), frame)
        : drawBars(['А', 'Б', 'В', 'Г', 'Д'], [320, 37, 35, 30, 302], 0, frame, ' мм'),
    },
    '2014/1': {
      illustration: 'Буквы слова КЕНГУРУ, сложенные из палочек',
      draw: drawStickLetters,
    },
    '2015/2': {
      question: 'Чему равна сумма двадцати сотен и пятнадцати?',
      choices: ['35', '215', '2015', '20015', '200015'],
    },
    '2016/2': {
      question: 'Крошке Ру 17 марта исполняется 7 недель и 3 дня. Когда ему исполнится 9 недель?',
      choices: ['21 марта', '24 марта', '26 марта', '28 марта', '30 марта'],
      draw: (step, frame) => drawTimeline(
        ['17 марта', step === 2 ? '21 марта' : '8 недель', step === 2 ? '28 марта' : '9 недель'],
        [4, 7], ['4 дня', '7 дней'], step === 2 ? '11 дней' : '', frame),
    },
    '2017/1': {
      question: 'Кенга составила пять примеров на сложение. Какая сумма самая большая?',
      choices: ['2 + 0 + 1 + 7', '2 + 0 + 17', '20 + 17', '20 + 1 + 7', '201 + 7'],
      draw: drawSums,
    },
    '2018/3': {
      question: 'В Петербурге 15 марта в 16 часов пошел снег, а 16 марта в 15 часов снегопад закончился. Сколько часов он продолжался?',
      choices: ['11', '12', '23', '24', '25'],
      draw: (step, frame) => drawTimeline(
        step === 1 ? ['15 марта, 16:00', 'Полночь'] : ['15 марта, 16:00', 'Полночь', '16 марта, 15:00'],
        step === 1 ? [8] : [8, 15], step === 1 ? ['8 ч'] : ['8 ч', '15 ч'], step === 2 ? '23 часа' : '', frame, 23),
    },
    '2019/1': {
      question: 'В зоопарке 21 ноября 2018 года родился кенгуренок. Сколько месяцев ему исполнилось 21 марта 2019 года?',
      choices: ['3', '4', '5', '6', '7'],
      draw: (step, frame) => drawTimeline(
        step === 1 ? ['21 нояб.', '21 дек.', '21 янв.'] : ['21 нояб.', '21 дек.', '21 янв.', '21 февр.', '21 марта'],
        step === 1 ? [1, 1] : [1, 1, 1, 1], step === 1 ? ['1 мес.', '1 мес.'] : ['1 мес.', '1 мес.', '1 мес.', '1 мес.'],
        step === 2 ? '4 месяца' : '', frame, 4),
    },
  };

  function drawSticks(step, frame) {
    let drawing = '';
    for (let i = 0; i < 6; i++) drawing += segment(101 + i * 70, 38, 101 + i * 70, 117, teal, 11);
    drawing += text(275, 150, '6 целых', 26);
    const gap = step === 1 ? 0 : 20 + 9 * progress(frame, 8);
    drawing += segment(567 - gap, 38, 567 - gap, 74, '#bc6340', 11);
    drawing += segment(567 + gap, 82, 567 + gap, 117, '#bc6340', 11);
    drawing += text(567, 150, step === 1 ? 'сломанная' : '2 половины', 26);
    return [180, drawing];
  }

  function drawPairs(step, frame) {
    let drawing = box(17, 22, 119, 61, mint) + text(77, 52, '2 + 2', 30);
    const active = Math.min(3, Math.floor(Math.max(0, frame) / 4));
    for (let i = 0; i < 4; i++) {
      const x = 151 + 139 * i;
      drawing += box(x, 22, 130, 61, step === 1 && i === active ? gold : muted);
      drawing += text(x + 65, 52, step === 1 ? '−2 + 2' : '0', 30);
      if (step === 1) drawing += segment(x + 65, 89, x + 65, 111, teal) + text(x + 65, 137, '0', 26, teal);
    }
    if (step === 2) drawing += text(360, 137, '2 + 2 = 4', 33, teal);
    return [173, drawing];
  }

  function drawHearts(step, frame, card) {
    if (step === 1) {
      let drawing = '';
      for (let i = 0; i < 4; i++) {
        const x = 105 + i * 128;
        drawing += box(x, 40, 105, 81, i === 3 ? muted : mint, line);
        drawing += text(x + 52, 80, i === 3 ? '◇' : '♥', 49, i === 3 ? ink : '#a34849');
      }
      return [175, drawing + text(360, 145, '3 из 4', 30, teal)];
    }
    const [url, w, h] = card;
    const choiceImage = globalThis.KENGURU_CHOICE_LAYOUTS?.['2003-3-4/3']?.options[3]?.image;
    const drawing = choiceImage
      ? `<image href="${escape(choiceImage)}" x="251" y="11" width="228" height="240"/>`
      : crop(url, w, h, [493, 66, 76, 80], 251, 11, 228, 240);
    const alpha = .45 + progress(frame, 9) * .55;
    return [260, drawing +
      `<g opacity="${alpha}">` +
      box(256, 15, 216, 158, 'none', '#a34849') + box(256, 176, 216, 73, 'none', teal) +
      text(490, 94, '9 сердец', 27, '#a34849', 'start') +
      text(490, 206, '3 другие фигуры', 23, teal, 'start') + '</g>'];
  }

  function drawStairs(step, frame) {
    let drawing = '';
    for (let i = 1; i <= 11; i++) {
      const x = 26 + 60 * (i - 1);
      const y = 176 - 13 * (i - 1);
      const landed = i % 2 === 0;
      const active = landed && i / 2 === Math.min(5, 1 + Math.floor(Math.max(frame, 0) / 4));
      const remaining = i === 11 && step === 2;
      drawing += box(x, y, 59, 36, active ? gold : remaining || landed ? mint : muted, line, 4);
      if (i < 11 || remaining) drawing += text(x + 30, y + 18, i, 24, landed || remaining ? teal : ink);
      if (landed) drawing += dot(x + 30, y - 15, active ? 8 : 5, teal);
      if (remaining) drawing += text(x + 30, y - 20, '+1', 22, teal);
    }
    return [225, drawing];
  }

  function drawKangaroos(step, frame, figure) {
    const [url, w, h] = figure;
    const locations = [[0, 0], [0, 1], [1, 0], [1, 3], [2, 2], [2, 3], [3, 2], [1, 2]];
    let drawing = '';
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const fill = step === 1 && (row === 1 || col === 2) ? gold
          : row === 3 && col === 1 ? mint : '#fff';
        drawing += box(204 + col * 64, 14 + row * 64, 64, 64, fill, line, 0);
      }
    }
    const moving = step === 2 ? (frame === 0 ? 1 : progress(frame, 10)) : 0;
    if (step === 2 && frame > 0) {
      drawing += `<path d="M364 110 Q230 144 300 238" fill="none" stroke="${teal}" stroke-width="3" stroke-dasharray="7 5"/>`;
    }
    locations.forEach(([row, col], i) => {
      const active = i === locations.length - 1;
      const shift = active ? moving : 0;
      const x = 210 + col * 64 - shift * 64;
      const y = 21 + row * 64 + shift * 128 - 37 * Math.sin(shift * Math.PI);
      if (active) drawing += box(x - 3, y - 3, 58, 57, mint, teal, 7);
      drawing += `<svg x="${x}" y="${y}" width="52" height="50" viewBox="16 21 65 62" style="overflow:hidden;mix-blend-mode:multiply">${image(url, w, h)}</svg>`;
    });
    const counts = moving === 1 ? [2, 2, 2, 2] : moving === 0 ? [2, 3, 2, 1] : [2, 2, 2, 1];
    for (let i = 0; i < 4; i++) {
      drawing += text(489, 46 + i * 64, counts[i], 24, teal);
      drawing += text(236 + i * 64, 296, i === 1 ? counts[3] : i === 2 ? counts[1] : 2, 24, teal);
    }
    return [321, drawing];
  }

  function drawNumberLine(step, frame) {
    let drawing = segment(44, 99, 676, 99, line, 4);
    for (let i = 0; i < 10; i++) {
      const x = 45 + i * 70;
      const marked = i === 4 || (step === 2 && i > 4);
      const active = i === 4 + Math.min(step === 1 ? 0 : 5, Math.floor(Math.max(0, frame) / 3));
      if (marked) drawing += box(x - 28, 53, 56, 44, active ? gold : mint);
      drawing += text(x, 75, 96 + i, 23, marked ? teal : ink) + dot(x, 99, marked ? 6 : 4, marked ? teal : line);
      if (marked) drawing += text(x, 126, '+' + i, 20, teal);
    }
    return [155, drawing];
  }

  function drawLetters(step, frame) {
    const words = ['КЕНГУРУ', 'МАТЕМАТИКА'];
    const active = Math.min(words[0].length - 1, Math.floor(Math.max(0, frame) / 3));
    return [166, words.map((word, row) => [...word].map((letter, i) => {
      const x = 360 - word.length * 32 + i * 64;
      const y = 19 + row * 67;
      const common = step === 2 && 'КЕ'.includes(letter);
      const comparable = step === 1 && (row === 0 ? i === active : letter === words[0][active]);
      return box(x, y, 56, 54, common ? mint : comparable ? gold : muted, common ? teal : line) +
        text(x + 28, y + 27, letter, 30, common ? teal : ink);
    }).join('')).join('')];
  }

  function drawAquariums(step, frame) {
    const moved = step === 1 ? 1 : 6;
    const now = frame === 0 ? moved : Math.min(moved, 1 + Math.floor(frame / 3));
    let drawing = '';
    for (let tank = 0; tank < 2; tank++) {
      const x = 21 + tank * 365;
      drawing += box(x, 18, 313, 128, mint, line);
      drawing += text(x + 156, 40, tank ? 'Второй аквариум' : 'Первый аквариум', 22);
      drawing += text(x + 40, 96, '□ +', 25, teal);
      for (let i = 0; i < (tank ? now : 12 - now); i++) {
        drawing += dot(x + 81 + (i % 6) * 36, 81 + Math.floor(i / 6) * 33, 11, tank ? '#bc6340' : teal);
      }
    }
    drawing += text(360, 82, '→', 27, ink);
    const difference = now === 6 ? '6 = 6' : `${12 - now} − ${now} = ${12 - 2 * now}`;
    drawing += text(360, 174, difference, 29, teal);
    return [197, drawing];
  }

  function drawBars(names, values, highlighted, frame, unit = '') {
    const max = Math.max(...values);
    const active = Math.min(values.length - 1, Math.floor(Math.max(0, frame) / 3));
    let drawing = '';
    for (let i = 0; i < values.length; i++) {
      const y = 12 + i * 46;
      const w = values[i] / max * 450;
      drawing += text(124, y + 17, names[i], 22, ink, 'end');
      drawing += box(146, y, w, 34, i === highlighted ? teal : i === active ? gold : muted, line, 7);
      drawing += text(156 + w, y + 17, values[i] + unit, 22, i === highlighted ? teal : ink, 'start');
    }
    return [values.length * 46 + 6, drawing];
  }

  function drawTimeline(labels, sizes, durations, total, frame, span = sizes.reduce((sum, size) => sum + size, 0)) {
    const active = Math.min(sizes.length - 1, Math.floor(Math.max(0, frame) / 6));
    let x = 103;
    let drawing = '';
    sizes.forEach((size, i) => {
      const end = x + 514 * size / span;
      drawing += segment(x, 65, end, 65, i === active ? '#c07848' : teal, 8);
      drawing += dot(x, 65, 8, teal);
      drawing += text(x, 100, labels[i], 21);
      drawing += text((x + end) / 2, 34, durations[i], 25, teal);
      x = end;
    });
    drawing += dot(x, 65, 8, teal) + text(x, 100, labels.at(-1), 21);
    if (total) drawing += box(103, 129, 514, 40, mint) + text(360, 149, total, 26, teal);
    return [total ? 183 : 128, drawing];
  }

  function drawBalloons(step, frame) {
    const active = Math.min(2, 1 + Math.floor(Math.max(0, frame) / 4));
    let drawing = segment(343, 62, 586, 62, teal, 3) + text(464, 36, '12 руб.', 26, teal);
    for (let i = 0; i < 3; i++) {
      const x = 175 + i * 144;
      const color = i === 0 ? '#a9b9b2' : i === active ? '#bc6340' : teal;
      drawing += dot(x, 118, 38, color);
      drawing += box(x - 6, 151, 12, 12, color, 'none', 0);
      drawing += segment(x, 162, x, 181, color);
      drawing += text(x, 207, i === 0 ? 'вычитаем' : step === 1 ? '?' : '6 руб.', 25, color);
      if (i === 0) drawing += segment(x - 45, 165, x + 45, 77, '#7d4940', 4);
    }
    return [239, drawing];
  }

  function drawStickLetters(step, frame, figure) {
    const [url, w, h] = figure;
    const sources = [[7, 43], [57, 57], [123, 60], [193, 56], [253, 53], [313, 62], [380, 58]];
    const values = [4, 5, 5, 3, 3, 5, 3];
    const active = Math.min(6, Math.floor(Math.max(0, frame) / 3));
    let drawing = '';
    for (let i = 0; i < sources.length; i++) {
      const [sx, sw] = sources[i];
      const x = 24 + i * 98;
      const relevant = step === 2 ? values[i] === 5 : values[i] !== 5;
      drawing += box(x, 21, 85, 126, relevant ? mint : muted, relevant ? teal : line);
      const letterWidth = sw * 77 / 100;
      drawing += crop(url, w, h, [sx, 3, sw, 100], x + (85 - letterWidth) / 2, 30, letterWidth, 77);
      if (relevant) drawing += text(x + 43, 125, values[i], 24, active === i ? '#a24d36' : teal);
    }
    return [167, drawing];
  }

  function drawSums(step, frame) {
    if (step === 2) return drawBars(['А', 'Б', 'В', 'Г', 'Д'], [10, 19, 37, 28, 208], 4, frame);
    const expressions = authored['2017/1'].choices;
    const drawing = expressions.map((value, i) => {
      const x = 12 + i * 140;
      return box(x, 25, 135, 61, i === 4 ? mint : muted, i === 4 ? teal : line) +
        text(x + 67, 55, value, 22, i === 4 ? teal : ink);
    }).join('');
    return [113, drawing];
  }

  for (const [year, label, tasks] of globalThis.KENGURU_LEGACY ?? []) {
    const letters = year < 2008 ? latin : cyrillic;
    const lessons = [];
    const scenes = [];
    for (const [i, [width, height, , marks, key, name, explanation, note]] of tasks.entries()) {
      const number = i + 1;
      const answer = key === '?' ? null : latin.indexOf(key);
      const originalImage = `assets/years/${year}/task-${String(number).padStart(2, '0')}.webp`;
      const card = [originalImage, width, height];
      const authoredTask = authored[year + '/' + number];
      const imported = globalThis.KENGURU_LEGACY_CONDITIONS?.[year]?.[number];
      const native = authoredTask?.question ? authoredTask : imported ?? authoredTask;
      const figure = native === imported && imported?.image
        ? [imported.image, imported.imageWidth, imported.imageHeight] : null;
      const illustration = figure
        ? svg(imported.imageWidth, imported.imageHeight, authoredTask?.illustration ?? 'Рисунки и варианты из условия',
            image(escape(imported.image), imported.imageWidth, imported.imageHeight))
          .replace('<svg ', `<svg style="max-width:${imported.imageWidth}px" `)
        : '';
      const steps = [
        ['Твоё решение', 'Условие задачи', 'Выбери свой вариант ответа.'],
        ...explanation.map(([heading, message], stage) => [
          stage === explanation.length - 1 ? 'Ответ' : 'Шаг ' + (stage + 1), heading, message,
        ]),
      ];
      const formulas = explanation.map(([, message]) => equationsIn(message));
      const choice = answer === null ? '' : letters[answer];
      const description = `Условие и варианты задачи ${number} из оригинала.`;
      lessons.push({
        number,
        title: name,
        short: name,
        skill: '',
        answer,
        choices: native?.choices ?? ['', '', '', '', ''],
        choiceImages: native?.choiceImages,
        question: native?.question ?? '',
        conditionImage: figure?.[0],
        questionNote: note,
        legacyOriginal: true,
        hideIntroText: Boolean(native),
        showCompletedStep: true,
        points: i < 10 ? 3 : i < 20 ? 4 : 5,
        originalImage,
        steps,
      });
      scenes.push((step, frame) => {
        if (step === 0 && authoredTask?.crop) {
          const region = authoredTask.crop;
          const cropHeight = Math.round(720 * region[3] / Math.max(600, region[2]));
          const cropWidth = cropHeight * region[2] / region[3];
          return svg(720, cropHeight, authoredTask.illustration,
            crop(...card, region, (720 - cropWidth) / 2, 0, cropWidth, cropHeight));
        }
        if (step === 0 && native) return illustration;
        const final = step === steps.length - 1;
        const revealed = final ? choice : '';
        const answerLabel = revealed ? ` Ответ ${revealed}.` : '';
        if (step > 0) {
          const content = authoredTask?.draw
            ? authoredTask.draw(step, frame * 3, figure ?? card)
            : formulas[step - 1].length ? drawEquations(formulas[step - 1], frame * 5) : null;
          if (content) return workedScene(content, steps[step][1] + '. ' + steps[step][2] + answerLabel, revealed);
          if (native) {
            if (!revealed) return '';
            return workedScene([0, ''], description + answerLabel, revealed);
          }
        }
        return renderOriginal(...card, description + answerLabel, final ? marks[answer] : null, frame);
      });
    }

    archive[year] = {
      year,
      id: year + '-3-4',
      grades: [3, 4],
      label,
      answerLetters: letters,
      sources: {
        tasksUrl: `${source}/kenguru_${year}_class_3-4.pdf`,
        answersUrl: `${source}/kenguru_${year}_answers${year === 2017 ? '-reviewed' : ''}.pdf`,
        solutionUrl: null,
      },
      lessons,
      scenes,
    };
  }
})();
