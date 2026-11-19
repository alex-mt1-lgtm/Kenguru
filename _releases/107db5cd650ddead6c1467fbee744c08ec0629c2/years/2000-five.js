'use strict';

(() => {
  const ink = '#172e34';
  const green = '#285e48';
  const rust = '#a84029';
  const paleGreen = '#e1eee2';
  const paleGold = '#f7eacb';
  const muted = '#496066';
  const paper = '#fffdf6';
  const { svg, text: sharedText, panel } = globalThis.KENGURU_2000_VISUAL;
  const text = (x, y, label, size, fill) =>
    sharedText(x, y, label, size, fill, 'start', 'auto');
  const line = (x1, y1, x2, y2, color = ink, width = 2, extra = '') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
  const centered = (x, y, label, size, fill) =>
    sharedText(x, y - size / 3, label, size, fill);
  const figure = (number, x, y, w, h) =>
    `<image href="assets/years/2000/q${number}-figure.svg" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  const card = (x, y, w, h, label, fill = paleGreen, size = 23) =>
    panel(x, y, w, h, fill) + centered(x + w / 2, y + h / 2 + size / 3, label, size, ink);
  const phase = (frame, length, pace = .8) =>
    Math.min(length - 1, Math.floor(Math.max(0, frame) / pace));

  function inequalities(step, frame) {
    if (step === 0) {
      return svg(card(35, 64, 570, 64, 'А < Б > Р > А > К < А > Д < А < Б > Р > А', paleGreen, 24) +
        card(145, 160, 350, 59, '0, 2, 4, 6, 8', paleGold, 29), 'Исходная цепочка неравенств и пять цифр');
    }
    const order = step === 1 ? ['Б', 'Р', 'А'] : ['Б', 'Р', 'А', 'К / Д'];
    const focus = phase(frame, order.length);
    let body = centered(320, 53, step === 1 ? 'Больше → меньше' : 'Две буквы меньше А', 26, ink);
    for (let i = 0; i < order.length; i++) {
      const x = (step === 1 ? 138 : 66) + i * 128;
      body += card(x, 84, 107, 63, order[i], i === focus ? paleGold : paleGreen, 28);
      if (i < order.length - 1) body += centered(x + 117, 122, '>', 20, ink);
    }
    if (step === 2) body += centered(320, 215, 'А больше и К, и Д. Их порядок пока неизвестен.', 21, muted);
    if (step === 3) {
      for (const [i, value] of ['8', '6', '4', '2 / 0'].entries()) {
        body += card(66 + i * 128, 158, 107, 57, value, i === 1 ? paleGold : paleGreen, 26);
      }
      body += centered(320, 266, 'Р = 6', 29, green);
    }
    return svg(body, 'Сравнение букв и подходящих цифр');
  }

  function dice(step, frame) {
    if (step === 0) return svg(figure(22, 250, 25, 140, 250), 'Три кубика из условия');
    const rows = [
      ['Верхний кубик', '6', '1'],
      ['Средний кубик', '1', '6'],
      ['Нижний кубик', '6', '1']
    ];
    const focus = phase(frame, step);
    let body = figure(22, 52, 26, 124, 226) +
      centered(413, 41, 'Сверху', 18, muted) + centered(514, 41, 'Снизу', 18, muted);
    for (const [i, [name, top, bottom]] of rows.entries()) {
      const y = 57 + i * 60;
      const known = i < step;
      body += text(207, y + 31, name, 19, ink) +
        card(373, y, 79, 44, known ? top : '?', known && i === focus ? paleGold : paleGreen, 23) +
        card(474, y, 79, 44, known ? bottom : '?', known && i === focus ? paleGold : paleGreen, 23);
      if (i < step - 1) {
        body += `<path d="M552 ${y + 23} Q581 ${y + 46} 452 ${y + 78}" fill="none" stroke="${green}" stroke-width="1.8" stroke-dasharray="4 4"/>`;
      }
    }
    body += centered(376, 264, step === 3 ? 'На самой нижней грани 1 точка' : 'На противоположных гранях в сумме 7', 23, green);
    return svg(body, 'Верхние и нижние грани кубиков');
  }

  function handshakes(step, frame) {
    const people = [
      ['A', 96, 142, 1], ['E', 228, 82, 2], ['B', 544, 141, 1], ['C', 386, 77, 2], ['D', 386, 191, 2]
    ];
    const edge = (first, second, color, width, extra) => {
      const [, x1, y1] = people.find(([name]) => name === first);
      const [, x2, y2] = people.find(([name]) => name === second);
      return line(x1, y1, x2, y2, color, width, extra);
    };
    let body = edge('A', 'E', green, 5);
    if (step === 1) {
      body += edge('B', 'E', rust, 4, 'stroke-dasharray="7 8"');
      body += edge('C', 'D', green, phase(frame, 2) ? 5 : 3);
    }
    if (step === 2) {
      const first = phase(frame, 2, 2) === 0;
      body += edge('C', 'D', green, 5) + edge('E', first ? 'C' : 'D', green, 5) +
        edge(first ? 'D' : 'C', 'B', green, 5);
      body += text(297, 130, '×', 26, rust);
    }
    for (const [name, x, y, quantity] of people) {
      const fill = name === 'C' || name === 'D' ? paleGold : paleGreen;
      body += `<circle cx="${x}" cy="${y}" r="25" fill="${fill}" stroke="${ink}" stroke-width="1.3"/>` +
        centered(x, y + 8, name, 24, ink) +
        centered(name === 'C' ? x + 39 : x, name === 'C' ? y + 6 : y + 48, String(quantity), 17, muted);
    }
    const caption = [
      'Число под буквой — сколько рук пожал человек',
      'Если B пожал руку E, у C и D остаются только друг друга',
      'B и E не могли пожать руки'
    ][step];
    return svg(body + centered(320, 271, caption, 20, step === 2 ? green : ink), 'Схема рукопожатий');
  }

  function stamps(step, frame) {
    const countries = ['Французская', 'Немецкая', 'Болгарская', 'Польская'];
    const totals = [40, 45, 44, 27];
    if (step >= 2) {
      const pages = {
        2: ['40 + 45 + 44 + 27 = 156', 'Каждая марка вошла в сумму трижды', '156 ÷ 3 = 52 рубля за все марки'],
        3: ['52 рубля стоят все четыре марки', '27 рублей стоят три марки без польской', '52 − 27 = 25 рублей']
      };
      let body = '';
      for (const [i, statement] of pages[step].entries()) {
        body += card(65, 42 + i * 71, 510, 54, statement, phase(frame, 3) === i ? paleGold : paleGreen, 23);
      }
      return svg(body, pages[step].join('. '));
    }
    let body = text(36, 53, step === 0 ? 'Стоимость без марки' : 'Без марки', 23, ink);
    if (step === 0) {
      for (const [i, country] of countries.entries()) {
        body += text(72, 103 + i * 44, country, 24, ink) + text(429, 103 + i * 44, `${totals[i]} руб.`, 24, ink);
      }
      return svg(body, 'Стоимость покупки без каждой марки');
    }
    for (const [j, prefix] of ['Фр.', 'Нем.', 'Болг.', 'Пол.'].entries()) {
      body += centered(288 + 67 * j, 53, prefix, 17, muted);
    }
    const focus = phase(frame, 4);
    for (const [i, country] of countries.entries()) {
      const y = 82 + 42 * i;
      body += text(39, y + 23, country, 20, ink);
      for (let j = 0; j < countries.length; j++) {
        body += card(263 + 67 * j, y, 50, 32, j === i ? '—' : '✓', j === focus && j !== i ? paleGold : paleGreen, 18);
      }
      body += text(545, y + 23, String(totals[i]), 21, ink);
    }
    return svg(body + centered(320, 272, 'В каждой колонке по три отметки', 21, green), 'Таблица показывает, в каких суммах учтена каждая марка');
  }

  const unit = 28;
  function squarePositions(size, notched) {
    const positions = [];
    for (let row = 0; row <= 4 - size; row++) {
      for (let column = 0; column <= 4 - size; column++) {
        if (!notched || row >= 2 || column + size <= 2) positions.push([column, row]);
      }
    }
    return positions;
  }

  function grid(x, y, notched, size, frame) {
    let body = '';
    for (const [column, row] of squarePositions(1, notched)) {
      body += `<rect x="${x + column * unit}" y="${y + row * unit}" width="${unit}" height="${unit}" fill="${paper}" stroke="${ink}" stroke-width="1.2"/>`;
    }
    const positions = squarePositions(size, notched);
    if (positions.length) {
      const [column, row] = positions[phase(frame, positions.length, .42)];
      body += `<rect x="${x + column * unit}" y="${y + row * unit}" width="${unit * size}" height="${unit * size}" fill="#e1ae43" fill-opacity=".35" stroke="${rust}" stroke-width="2.7"/>`;
    }
    return body;
  }

  function squares(step, frame) {
    if (step === 0) return svg(figure(25, 91, 50, 458, 198), 'Слева квадратная сетка, справа сетка с вырезом');
    const size = [0, 1, 2, 3, 4, 4][step];
    let body = centered(108, 58, 'Левый', 20, ink) + centered(272, 58, 'Правый', 20, ink) +
      grid(52, 74, false, size, frame) + grid(216, 74, true, size, frame);
    body += centered(421, 51, 'Размер', 17, muted) + centered(497, 51, 'Левый', 17, muted) + centered(573, 51, 'Правый', 17, muted);
    for (let row = 1; row <= Math.min(4, step); row++) {
      const y = 64 + 37 * (row - 1);
      body += panel(385, y, 226, 32, row === step ? paleGold : paleGreen) +
        centered(421, y + 22, `${row} × ${row}`, 19, ink) +
        centered(497, y + 22, String(squarePositions(row, false).length), 19, ink) +
        centered(573, y + 22, String(squarePositions(row, true).length), 19, ink);
    }
    if (step === 5) {
      body += centered(421, 238, 'Всего', 17, muted) + centered(497, 238, '30', 22, ink) +
        centered(573, 238, '17', 22, ink) + centered(182, 240, '30 − 17 = 13', 30, green);
    }
    return svg(body, 'Считаем квадраты каждого размера отдельно');
  }

  const locations = [117, 252, 387, 522];
  function road() {
    let body = centered(117, 49, 'Малые Кенгуру', 17, ink) + centered(522, 49, 'Большие Кенгуру', 17, ink);
    for (const [i, x] of locations.entries()) body += centered(x, 81, `${i * 10} км`, 18, muted);
    return body;
  }

  function farmers(step, frame) {
    if (step === 0) {
      let body = centered(117, 57, 'Малые Кенгуру', 21, ink) +
        centered(522, 57, 'Большие Кенгуру', 21, ink) + centered(320, 113, '30 км', 24, green) +
        line(117, 132, 522, 132, green, 4);
      for (const x of [117, 522]) body += `<circle cx="${x}" cy="132" r="5" fill="${green}"/>`;
      body += card(64, 171, 236, 48, '2 велосипеда', paleGreen, 23) +
        card(337, 171, 236, 48, '3 фермера', paleGold, 23) +
        centered(182, 252, '15 км/ч на велосипеде', 20, muted) + centered(455, 252, '5 км/ч пешком', 20, muted);
      return svg(body, 'Деревни в 30 километрах друг от друга, три фермера и два велосипеда');
    }
    if (step <= 2) {
      const labels = step === 1 ?
        ['Вместе фермерам нужно преодолеть 90 км', 'Два велосипеда могут дать до 60 км вперёд', 'На ходьбу остаётся хотя бы 30 км'] :
        ['1 км: 12 мин пешком или 4 мин на велосипеде', '90 × 12 − 60 × 8 = 600 минут на троих', '600 ÷ 3 = 200 минут = 3 ч 20 мин'];
      let body = '';
      for (const [i, label] of labels.entries()) {
        body += card(37, 44 + i * 72, 566, 53, label, phase(frame, 3) === i ? paleGold : paleGreen, 23);
      }
      return svg(body, labels.join('. '));
    }
    const routes = [
      ['А', [[0, 2, true, 0, 80], [2, 3, false, 80, 200]], ['0:00', '', '1:20', '3:20']],
      ['Б', [[0, 1, true, 0, 40], [1, 2, false, 40, 160], [2, 3, true, 160, 200]], ['0:00', '0:40', '2:40', '3:20']],
      ['В', [[0, 1, false, 0, 120], [1, 3, true, 120, 200]], ['0:00', '2:00', '', '3:20']]
    ];
    const elapsed = step === 4 ? 200 : Math.min(200, Math.max(0, frame) * 200 / 6.5);
    const riderRadius = step === 4 ? 7 + Math.min(2, Math.max(0, frame)) : 7;
    let body = road();
    for (const x of locations) body += line(x, 88, x, 248, '#b9c8bd', 1);
    for (const [i, [name, route, times]] of routes.entries()) {
      const y = 114 + i * 56;
      body += centered(69, y + 6, name, 24, ink);
      for (const [start, end, biking] of route) {
        body += line(locations[start], y, locations[end], y, biking ? green : rust, 5,
          biking ? '' : 'stroke-dasharray="5 8"');
      }
      for (const [j, time] of times.entries()) {
        if (time) {
          body += `<circle cx="${locations[j]}" cy="${y}" r="5" fill="${ink}"/>` +
            centered(locations[j], y + 23, time, 17, ink);
        }
      }
      const [start, end, , departure, arrival] = route.find(([, , , , until]) => elapsed <= until);
      const progress = (elapsed - departure) / (arrival - departure);
      const position = locations[start] + (locations[end] - locations[start]) * progress;
      body += `<circle cx="${position}" cy="${y}" r="${riderRadius}" fill="#e1ae43" stroke="${ink}" stroke-width="1"/>`;
    }
    body += line(122, 273, 160, 273, green, 5) + text(173, 279, 'На велосипеде', 18, ink) +
      line(383, 273, 416, 273, rust, 5, 'stroke-dasharray="5 8"') + text(426, 279, 'Пешком', 18, ink);
    return svg(body, 'Маршруты с передачей велосипедов на десятом и двадцатом километрах');
  }

  globalThis.KENGURU_2000_FIVE = [
    {
      number: 21, title: 'Цепочка неравенств', label: 'Неравенства',
      skill: 'Ставим цифры по порядку', answer: 3,
      choices: ['0', '2', '4', '6', '8'],
      question: 'В неравенствах А < Б > Р > А > К < А > Д < А < Б > Р > А каждая буква означает одну из цифр 0, 2, 4, 6, 8. Разным буквам соответствуют разные цифры, а одинаковым — одинаковые. Какая цифра соответствует букве Р?',
      steps: [
        ['Твоё решение', 'Какая цифра скрывается за Р?', 'Посмотри на знаки между буквами. Одна и та же буква везде означает одну и ту же цифру.'],
        ['Цепочка', 'От самой большой к меньшей', 'Из записи Б > Р > А видно, что Б больше Р, а Р больше А.'],
        ['Сравнение', 'Две буквы меньше А', 'А больше К и больше Д. Получается, что Б самая большая из пяти букв, а Р сразу за ней.'],
        ['Ответ', 'Б = 8, Р = 6', 'Самая большая из данных цифр — 8, а вторая по величине — 6. Значит, Р = 6. Ответ D.']
      ],
      scene: inequalities
    },
    {
      number: 22, title: 'Башня из трёх кубиков', label: 'Кубики',
      skill: 'Находим скрытые грани', answer: 0,
      choices: ['1', '6', '5', '2', '3'],
      question: 'Три одинаковых игральных кубика уложены так, как показано на рисунке. Соседние кубики приложены друг к другу одинаковыми гранями. Сколько точек на самой нижней грани?',
      steps: [
        ['Твоё решение', 'Сколько точек в самом низу?', 'Рассмотри три кубика. В местах, где кубики соприкасаются, на двух гранях одинаковое число точек.'],
        ['Верхний кубик', 'Напротив шестёрки стоит единица', 'На самой верхней грани 6 точек. У обычного игрального кубика на противоположных гранях в сумме 7 точек. Снизу у верхнего кубика 7 − 6 = 1 точка.'],
        ['Средний кубик', 'Сверху 1, снизу 6', 'Верхняя грань среднего кубика касается нижней грани верхнего. Поэтому сверху у среднего 1 точка, а снизу 7 − 1 = 6.'],
        ['Ответ', 'Снизу осталась 1 точка', 'Верхняя грань нижнего кубика касается грани с 6 точками. Напротив шестёрки у нижнего кубика 1 точка. Ответ A.']
      ],
      scene: dice
    },
    {
      number: 23, title: 'Рукопожатия в клубе', label: 'Рукопожатия',
      skill: 'Проверяем, возможно ли событие', answer: 3,
      choices: ['C и D', 'C и E', 'B и C', 'B и E', 'B и D'],
      question: 'Джентльмены A, B, C, D и E встретились в клубе. Некоторые из них приветствовали друг друга рукопожатиями. A и B пожали руки по одному разу, а C, D и E — по два. Известно, что A пожал руку E. Какого рукопожатия наверняка не было?',
      steps: [
        ['Твоё решение', 'Какого рукопожатия не было?', 'На схеме уже соединены A и E. Число под каждой буквой показывает, сколько рукопожатий было у этого человека.'],
        ['Проверка', 'Что если B пожал руку E?', 'Тогда A и B сделали по одному рукопожатию, а E — два. Все трое уже закончили. У C и D остаётся только рукопожатие друг с другом, а каждому из них нужно по два. Так быть не может.'],
        ['Ответ', 'B и E точно не пожали руки', 'Две возможные цепочки — A–E–C–D–B и A–E–D–C–B. В каждой у всех нужное число рукопожатий. Вместе цепочки показывают, что остальные пары из вариантов возможны. Ответ D.']
      ],
      scene: handshakes
    },
    {
      number: 24, title: 'Цена польской марки', label: 'Марки',
      skill: 'Складываем неполные суммы', answer: 1,
      choices: ['8 рублей', '25 рублей', '7 рублей', '12 рублей', '30 рублей'],
      question: 'Папа купил для коллекции четыре марки: французскую, немецкую, болгарскую и польскую. Покупка без французской стоит 40 рублей, без немецкой — 45 рублей, без болгарской — 44 рубля, без польской — 27 рублей. Сколько стоит польская марка?',
      steps: [
        ['Твоё решение', 'Сколько стоит польская марка?', 'Каждая известная сумма — цена трёх марок. В каждой строке отсутствует своя марка.'],
        ['Учёт', 'Каждую марку посчитали трижды', 'Каждая марка отсутствует только в одной строке. Во всех остальных строках она есть. Если сложить четыре суммы, цена каждой марки войдёт в итог три раза.'],
        ['Вся покупка', 'За все марки заплатили 52 рубля', 'Складываем 40 + 45 + 44 + 27 и получаем 156 рублей. Делим на 3: вместе четыре марки стоят 52 рубля.'],
        ['Ответ', 'Польская марка стоит 25 рублей', 'Все четыре марки стоят 52 рубля, а без польской — 27. Вычитаем: 52 − 27 = 25 рублей. Ответ B.']
      ],
      scene: stamps
    },
    {
      number: 25, title: 'Квадраты в двух сетках', label: 'Квадраты',
      skill: 'Считаем фигуры по размерам', answer: 3,
      choices: ['10', '11', '12', '13', '14'],
      question: 'На левом рисунке можно увидеть больше квадратиков, чем на правом. На сколько?',
      steps: [
        ['Твоё решение', 'На сколько квадратов больше слева?', 'Сравни левую и правую сетки и выбери один из пяти ответов.'],
        ['Одна клетка', 'Слева 16, справа 12', 'В левой сетке четыре ряда по четыре клетки. В правой два верхних ряда по две клетки и два нижних по четыре.'],
        ['Две клетки', 'Слева 9, справа 5', 'Для квадрата 2 × 2 отметь его левый верхний угол. Слева он может стоять в трёх рядах и в трёх столбцах. Справа для угла есть по одному месту в первых двух рядах и три места в третьем.'],
        ['Три клетки', 'Слева 4, справа 0', 'Слева угол квадрата 3 × 3 может стоять в одном из двух рядов и в одном из двух столбцов. Справа в каждом наборе из трёх рядов есть узкий ряд шириной две клетки.'],
        ['Четыре клетки', 'Слева 1, справа 0', 'Слева вся сетка образует квадрат 4 × 4. Справа не хватает четырёх клеток в верхнем правом углу.'],
        ['Ответ', 'Слева на 13 квадратов больше', 'Слева 16 + 9 + 4 + 1 = 30 квадратов. Справа 12 + 5 = 17 квадратов. Разность 30 − 17 = 13. Ответ D.']
      ],
      scene: squares
    },
    {
      number: 26, title: 'Три фермера и два велосипеда', label: 'Фермеры',
      skill: 'Проверяем маршрут и доказываем минимум', answer: 2,
      choices: ['2 ч 30 мин', '3 часа', '3 ч 20 мин', '3 ч 30 мин', '4 часа'],
      question: 'Три фермера должны добраться из деревни Малые Кенгуру в деревню Большие Кенгуру. Между деревнями 30 км. У фермеров два велосипеда, на каждом может ехать только один человек. Скорость на велосипеде 15 км/ч, а пешком — 5 км/ч. За какое наименьшее время все трое могут добраться до второй деревни?',
      steps: [
        ['Твоё решение', 'За сколько часов доедут все трое?', 'Каждый должен преодолеть 30 км. На велосипеде фермер движется втрое быстрее, чем пешком.'],
        ['Расстояние', 'На велосипедах можно выиграть время на 60 км', 'Троим нужно вместе продвинуться на 90 км. Каждый велосипед может продвинуться к цели на 30 км, оба — на 60 км. Если велосипед везут назад, потом ему придётся снова проехать тот же отрезок вперёд. На это уходит время, а ближе к цели группа не становится. Остальные 30 км или больше фермеры проходят пешком.'],
        ['Минимум', 'Быстрее 3 ч 20 мин не получится', 'Пешком на километр уходит 12 минут, на велосипеде — 4. На каждом километре вперёд велосипед экономит 8 минут. Поездка назад занимает время и уменьшает продвижение к цели. Поэтому из 90 × 12 минут можно сэкономить не больше 60 × 8. Остаётся не меньше 600 минут на троих. Хотя бы одному понадобится 600 ÷ 3 = 200 минут, или 3 ч 20 мин.'],
        ['Маршрут', 'Две передачи на 10-м и 20-м километрах', 'А едет до отметки 20 км за 1 ч 20 мин, оставляет там велосипед и идёт пешком до конца. Б оставляет второй велосипед на отметке 10 км через 40 мин и идёт пешком до отметки 20 км. Там через 2 ч 40 мин он берёт велосипед А и едет до конца. В идёт до отметки 10 км за 2 часа, берёт велосипед Б и едет до конца.'],
        ['Ответ', 'Все трое прибывают через 3 ч 20 мин', 'Каждый прошёл пешком 10 км за 2 часа и проехал на велосипеде 20 км за 1 ч 20 мин. Этот маршрут достигает наименьшего возможного времени. Ответ C.']
      ],
      scene: farmers
    }
  ];
})();
