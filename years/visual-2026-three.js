'use strict';

(() => {
  const V = globalThis.KenguruVisual;
  const lessons = (globalThis.KenguruVisualLessons ??= {})[2026] ??= {};
  const ink = '#172e34', teal = '#237e79', orange = '#b94c31', gold = '#efc466';
  const pale = '#eaf0e6', white = '#fffdf7', muted = '#586e70', blue = '#c1dfdb';
  const letters = ['А', 'Б', 'В', 'Г', 'Д'];
  const pictures = (noun) => letters.map((letter) => `${noun} ${letter}`);
  const line = (x1, y1, x2, y2, stroke = ink, width = 2, attrs = '') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" ${attrs}/>`;
  const rect = (x, y, w, h, fill = white, stroke = ink, radius = 0, sw = 1.6) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const circle = (x, y, r, fill = white, stroke = ink, sw = 1.7) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const path = (d, fill = 'none', stroke = ink, sw = 2, extra = '') =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
  const polygon = (points, fill = white, stroke = ink, sw = 1.6) =>
    `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  const label = (x, y, text, size = 18, fill = ink) =>
    `<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}" font-size="${size}" font-weight="700">${V.escape(text)}</text>`;
  const group = (body, attrs = '') => `<g ${attrs}>${body}</g>`;
  const placed = (body, x, y, scale = 1) => group(body, `transform="translate(${x} ${y}) scale(${scale})"`);
  const opacity = (body, value) => group(body, `opacity="${value}"`);
  const fadeIn = (body, frame, delay = 0) => opacity(body, .2 + .8 * V.reveal(frame, delay));
  const svg = (body, description) => V.svg(body, description, '0 0 640 300');
  const arrow = (x1, y1, x2, y2, color = teal) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const tip = (offset) => [x2 - 9 * Math.cos(angle + offset), y2 - 9 * Math.sin(angle + offset)];
    return line(x1, y1, x2, y2, color, 2.8) + path(`M${tip(-.5).join(' ')} L${x2} ${y2} L${tip(.5).join(' ')}`, 'none', color, 2.8);
  };
  const mark = (x, y, text, color = orange) =>
    circle(x, y, 12, color, 'none') + label(x, y + 5, text, 14, white);
  const points = (count, radius, innerRadius = radius, start = -90) =>
    Array.from({length: count}, (_, i) => {
      const angle = (start + i * 360 / count) * Math.PI / 180;
      const r = i % 2 ? innerRadius : radius;
      return `${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`;
    }).join(' ');

  const tileOptions = ['TDRSF', 'FDSRT', 'RFTSD', 'STDRF', 'FTSDR'];
  function tile(kind, x, y, size = 46, focus = false) {
    const tileFill = {T: '#a7bbb4', D: white, R: pale, S: muted, F: white};
    let tileMark = '';
    if (kind === 'T') {
      tileMark = rect(-7, -7, 14, 14, white, ink, 0, 1) +
        Array.from({length: 4}, (_, i) => group(polygon('-7,-10 7,-10 0,-21', white, ink, 1), `transform="rotate(${i * 90})"`)).join('');
    } else if (kind === 'D') {
      tileMark = [[-14,-13],[0,-9],[14,-13],[-10,1],[10,1],[-14,13],[0,9],[14,13]]
        .map(([a,b]) => circle(a,b,5,muted,ink,.8)).join('');
    } else if (kind === 'R') {
      tileMark = circle(0,0,16,'none',ink,3) + circle(0,0,8,'none',ink,2.6);
    } else if (kind === 'S') {
      tileMark = polygon(points(10,17,7),white,'none') +
        Array.from({length: 10}, (_, i) => {
          const angle = i * Math.PI / 5;
          return placed(polygon(points(10,2.7,1.2),white,'none'),19 * Math.cos(angle),19 * Math.sin(angle));
        }).join('');
    } else {
      tileMark = Array.from({length: 8}, (_, i) => group(polygon('0,-22 6,-11 0,-4 -6,-11',
        i % 2 ? '#b9c5ba' : muted, ink, .9), `transform="rotate(${i * 45})"`)).join('') + circle(0,0,3,white,ink,.8);
    }
    return placed(rect(-23,-23,46,46,tileFill[kind],ink,0,1.2) + tileMark +
      (focus ? rect(-22,-22,44,44,'none',gold,2,3.4) : ''), x, y, size / 46);
  }
  function phone(frame, step) {
    const photoRows = ['STD','TDR','DRF'];
    let body = rect(213, 25, 214, 112, ink, muted, 17) + rect(225,65,5,35,muted,'none',3) +
      circle(410,81,10,white,muted,2) +
      '<defs><clipPath id="k26-photo"><rect x="242" y="29" width="150" height="103"/></clipPath></defs>';
    let photo = '';
    photoRows.forEach((row, i) => [...row].forEach((kind, j) => {
      const selected = step === 1 && i === 1 || step === 2 && (i === 0 && j <= 1 || i === 2 && j >= 1);
      const x=267 + j*50, y=31+i*50;
      photo += tile(kind,x,y,50) + (selected ? fadeIn(tile(kind,x,y,50,true),frame,j * .35) : '');
    }));
    return body + group(photo, 'clip-path="url(#k26-photo)"');
  }

  const bracelets = ['OOOTSS','TOSSSO','TOSTOO','OTSTOS','OOSSTT'];
  function bracelet(code, i, x, y, frame, step) {
    const angle = i === 0 || i === 3 || i === 4 ? -120 : -90;
    const positions = Array.from({length: 6}, (_, k) => {
      const rad = (angle + k * 60) * Math.PI / 180;
      return [x + 48 * Math.cos(rad), y + 48 * Math.sin(rad)];
    });
    let body = circle(x,y,48,'none',muted,3);
    [...code].forEach((kind,k) => {
      const [a,b] = positions[k], next = (k+1)%6;
      const pairs = (type) => code[k] === type && code[next] === type;
      const focusCircle = (pairs('O') || code[k] === 'O' && code[(k+5)%6] === 'O') && step >= 1;
      const focusSquare = (pairs('S') || code[k] === 'S' && code[(k+5)%6] === 'S') && step >= 2;
      if (step >= 1 && pairs('O') || step >= 2 && pairs('S')) {
        body += fadeIn(path(`M${a} ${b} A48 48 0 0 1 ${positions[next].join(' ')}`, 'none', pairs('O') ? teal : orange, 5),frame,k*.38);
      }
      const bead = (fill) => kind === 'O' ? circle(a,b,11,fill,ink) :
        kind === 'S' ? group(rect(a-10,b-10,20,20,fill), `transform="rotate(${(angle+k*60+360)%90} ${a} ${b})"`) :
          placed(group(polygon('0,-12 12,9 -12,9',fill), `transform="rotate(${angle+k*60+90})"`),a,b);
      body += bead('#d9e2db');
      if (focusCircle || focusSquare) body += fadeIn(bead(focusCircle ? blue : gold),frame,k*.25);
    });
    return body;
  }

  const holeCells = [[1,0],[2,0],[1,1],[1,2],[0,3],[1,3]];
  const patchCodes = [[0,1,1,3,3,2], [2,3,0,2,1,0], [1,0,1,3,2,3], [0,1,2,0,3,2], [1,0,3,1,2,3]];
  const notch = (turn, x, y, color = ink, size = 10) =>
    placed(group(path('M0 0 H10 A10 10 0 1 0 0 10Z',color,'none'),`transform="rotate(${turn*90})"`),x,y,size/10);
  const patchOutline = 'M25 0 H75 V25 H50 V100 H0 V75 H25Z';
  function patch(code, x, y, scale = 1, selected = false) {
    const color = selected ? teal : ink;
    const body = path(patchOutline,selected ? pale : white,color,1.6) +
      holeCells.map(([a,b], k) => notch(code[k],a*25+12.5,b*25+12.5,color)).join('');
    return placed(body,x,y,scale);
  }

  const hull = 'M0 4 H14 L12 6 H2Z';
  const cabin = 'M4 4 V2 H6 V0 H8 V2 H10 V4Z';
  const smallCabin = 'M11 4 V2 H13 V4Z';
  const hullPieces = ['M0 4 H6 L4 6 H2Z','M6 4 H8 L10 6 H4Z','M8 4 H14 L12 6 H10Z'];
  const squareOffsets = [[4,2],[6,0],[6,2],[8,2],[11,2]];
  function ship(x, y, scale, step, frame) {
    const filled = ['#cfe6dd','#f6dfa9','#d6e6dd'];
    const allParts = hull + ' ' + cabin + ' ' + smallCabin;
    let body = path(allParts,white,ink,.07) +
      `<defs><clipPath id="k26-ship"><path d="${allParts}"/></clipPath></defs>`;
    if (step >= 1) hullPieces.forEach((d,i) => {
      body += fadeIn(path(d,filled[i],'none'),frame,i*.7);
    });
    if (step >= 2) body += fadeIn(path(smallCabin,blue,'none'),frame);
    if (step >= 3) squareOffsets.forEach(([a,b],i) => {
      body += fadeIn(rect(a,b,2,2,['#d6e6dd','#b0d4ce','#f6dfa9','#cae1d5','#aed8d3'][i],'none'),frame,i*.45);
    });
    let grid = '';
    for (let i=1; i<14; i++) grid += line(i,0,i,6,muted,.038);
    for (let i=1; i<6; i++) grid += line(0,i,14,i,muted,.038);
    body += group(grid,'clip-path="url(#k26-ship)"') + path(allParts,'none',ink,.072);
    if (step >= 1) body += fadeIn(path(hullPieces.join(' '),'none',teal,.09),frame);
    if (step === 2) {
      const corners = [[4,4],[4,2],[6,0],[8,0],[10,2],[10,4]];
      body += corners.map(([a,b],i) => fadeIn(circle(a,b,.14,gold,orange,.06),frame,i*.55)).join('');
    }
    if (step >= 3) body += fadeIn(squareOffsets.map(([a,b]) =>
      `<rect x="${a}" y="${b}" width="2" height="2" fill="none" stroke="${teal}" stroke-width=".085"/>`).join(''),frame);
    return placed(body,x,y,scale);
  }
  function shipPieces(x,y,scale) {
    const square = path('M-1 -4 H1 V-2 H-1Z M-1 -3 H1 M0 -4 V-2',white,ink,.07);
    const trapezoid = path('M-3 -1 H3 L1 1 H-1Z M-2 0 H2 M-2 -1 V0 M-1 -1 V1 M0 -1 V1 M1 -1 V1 M2 -1 V0',white,ink,.07);
    return placed(square+trapezoid,x,y,scale);
  }

  const cubeFaces = ['M0 -70 L65 -36 L0 0 L-65 -36Z','M-65 -36 L0 0 V73 L-65 38Z','M0 0 L65 -36 V38 L0 73Z'];
  function die(x,y,scale,values,fill=[pale,white,blue]) {
    const positions=[[0,-32],[-33,25],[33,25]];
    const sides=cubeFaces.map((d,i)=>
      path(d,fill[i],ink,2.7) + (values[i] ? label(positions[i][0],positions[i][1],values[i],31,ink) : '')
    ).join('');
    return placed(sides,x,y,scale);
  }

  Object.assign(lessons, {
    1: {
      question: "Пол выложен плитками пяти разных видов. При этом они образуют повторяющийся узор. Женя сфотографировала часть пола на телефон, и у неё получилась фотография, как на рисунке справа. Какой повторяющийся узор образуют плитки?",
      title: 'Плитки на фотографии',
      short: 'Найди повторяющуюся последовательность по её фрагменту.',
      skill: 'Повторяющиеся узоры',
      choices: pictures('Узор'),
      steps: [
        ['Условие','Рассмотри фотографию','На экране виден только фрагмент пола. Плитки за краями фотографии продолжают тот же узор.'],
        ['Центр','Найди три плитки подряд','Посередине видны плитки с треугольниками, точками и кольцами. Именно так они идут подряд в вариантах А и Г.'],
        ['Края','Рассмотри соседние плитки','В верхнем ряду перед треугольниками видна звезда. В нижнем ряду сразу после колец видна плитка с цветком.'],
        ['Ответ','Проверь все пять плиток','Звезда, треугольники, точки, кольца, цветок. Обе крайние плитки стоят на своих местах только в варианте Г. Ответ Г.'],
      ],
      scene(step, frame) {
        let body = phone(frame, step);
        tileOptions.forEach((row,i) => {
          const x = i < 3 ? 32 + i*205 : 134 + (i-3)*205, y = i<3 ? 180 : 243;
          const dim = step >= 1 && i !== 0 && i !== 3 || step >= 3 && i === 0;
          const correct = step >= 3 && i === 3;
          const marked = step >= 1 && (i===0 || i===3);
          const strip = [...row].map((kind,k) => tile(kind,x+38+k*31,y,31)).join('');
          body += opacity(label(x+8,y+6,letters[i],16) + strip,dim ? .35 : 1);
          if (marked && !dim) {
            const start = row.indexOf('TDR');
            const all = step >= 3 || step===2 && i===3;
            body += fadeIn(rect(x+22+(all ? 0 : start*31),y-16,all ? 156 : 94,32,'none',correct ? teal : orange,3,2.7),frame);
          }
        });
        if (step >= 3) body += fadeIn(label(320,286,'Звезда → треугольники → точки → кольца → цветок',17,teal),frame);
        return svg(body,'На экране телефона три ряда плиток. Ниже показаны пять вариантов повторяющегося узора');
      },
    },
    2: {
      question: "Браслет Лены сделан из бусин трёх разных форм. Известно, что в её браслете есть две расположенные рядом круглые бусины. Но в нём нет двух расположенных рядом квадратных бусин. Какой из следующих браслетов может быть браслетом Лены?",
      title: 'Браслет Лены',
      short: 'Проверь соседство бусин по кругу.',
      skill: 'Отбор по двум условиям',
      choices: pictures('Браслет'),
      steps: [
        ['Условие','Рассмотри бусины по кругу','У каждой бусины здесь два соседа: один по часовой стрелке, другой против часовой.'],
        ['Круглые','Выдели соседние круглые бусины','Такая пара есть в браслетах А, В и Д. В двух других браслетах круглые бусины разделены фигурами.'],
        ['Квадратные','Проверь оставшиеся браслеты','У А и Д найдётся пара соседних квадратных бусин. Они нарушают второе условие.'],
        ['Ответ','Совмести оба условия','Только в браслете В рядом есть две круглые бусины и при этом нет соседних квадратных. Ответ В.'],
      ],
      scene(step,frame) {
        let body = '';
        bracelets.forEach((code,i) => {
          const x = i<3 ? 110+i*210 : 214+(i-3)*212, y=i<3?68:209;
          const chosen=step===3 && i===2, possible=i===0 || i===2 || i===4;
          const excluded=step>=1 && !possible || step>=2 && (i===0 || i===4);
          body += opacity(bracelet(code,i,x,y,frame,step) + label(x,y+77,letters[i],17),excluded && step!==2 ? .36 : 1);
          if (step>=2 && (i===0 || i===4)) body += fadeIn(mark(x,y,'×'),frame);
          if (chosen) body += fadeIn(circle(x,y,66,'none',teal,3)+mark(x,y,'✓',teal),frame);
        });
        return svg(body,'Пять замкнутых браслетов с круглыми, квадратными и треугольными бусинами');
      },
    },
    3: {
      question: "Какую из деталей ниже следует использовать для правильного завершения узора?",
      title: 'Заплатка для узора',
      short: 'Вставь деталь, продолжая поворот каждого знака.',
      skill: 'Закономерности на сетке',
      choices: pictures('Деталь'),
      steps: [
        ['Условие','Рассмотри узор вокруг отверстия','В каждом круге отсутствует четверть. У соседних кругов вырез может оказаться в другом углу.'],
        ['Ряды','Сравни верхний и нижний ряды','Ориентации значков чередуются в каждом ряду. Первый ряд совпадает с третьим, второй — с четвёртым.'],
        ['Повороты','Продолжи последовательность в пустых клетках','Сверь пропущенные повороты с пятью деталями. Можно начать с двух соседних клеток вверху и двух внизу.'],
        ['Ответ','Совмести совпадающую деталь с отверстием','Вставка Г продолжает узор во всех четырёх рядах. Ответ Г.'],
      ],
      scene(step,frame) {
        let body = rect(220,28,200,100,white,ink);
        const missing = new Set(holeCells.map(([col,row]) => `${col+3},${row}`));
        for (let row=0;row<4;row++) for (let col=0;col<8;col++) {
          const empty=missing.has(`${col},${row}`), x=232.5+col*25, y=40.5+row*25;
          const q=row%2===0 ? col%2 : 2+col%2;
          if (empty && step===2) body += fadeIn(notch(q,x,y,teal), frame,(row+col)*.19);
          if (empty) continue;
          if (step===1 && col<2) body += fadeIn(rect(x-11,y-11,22,22,gold,'none',3),frame,row*.4);
          body += notch(q,x,y);
        }
        const shift = step>=3 ? 30*(1-V.reveal(frame)) : 0;
        body += placed(path(patchOutline, 'none', step>=1 ? teal : ink,1.6),295,28);
        if (step>=3) body += fadeIn(patch(patchCodes[3],295+shift,28),frame);
        patchCodes.forEach((code,i) => {
          const x=42+i*122, y=154;
          body += patch(code,x,y,1.06, step>=3 && i===3) + label(x+40,283,letters[i],17);
        });
        return svg(body,'Прямоугольный узор с отверстием из шести клеток. Ниже нарисованы пять вставок');
      },
    },
    4: {
      question: "У Кенгуру есть некоторое количество кусочков бумаги двух форм (рисунок 1). Какое наименьшее количество таких кусочков ему понадобится, чтобы построить корабль, показанный на рисунке 2?",
      title: 'Бумажный корабль',
      short: 'Разложи силуэт на квадраты и трапеции.',
      skill: 'Минимальное разбиение фигуры',
      choices: ['7','8','10','11','12'],
      steps: [
        ['Условие','Рассмотри детали и силуэт','У каждой детали есть клетчатая разметка. По ней можно сравнивать размеры кусочков и частей корабля.'],
        ['Корпус','Закрой острые углы корпуса','В крайних острых углах нужны две трапеции. Между ними у нижней границы остаются ещё два острых угла. Длинная сторона детали может лежать только вдоль основания: по диагонали она вышла бы за силуэт. Оба угла закрывает одна перевёрнутая трапеция.'],
        ['Надстройки','Посчитай площадь и углы','Малая надстройка занимает один квадрат. Большая занимает 16 клеток и имеет шесть выпуклых прямых углов. Квадрат закрывает самое большее два таких угла. Если закрывать угол трапециями, нужно совместить два их острых угла.'],
        ['Ответ','Выложи корабль восемью деталями','Площадь трапеции — 8 клеток, квадрата — 4. Из двух или трёх деталей площадь большой надстройки набирается двумя трапециями или трапецией и двумя квадратами. Ни один набор не закрывает все шесть углов. Четыре квадрата подходят. Всего нужны три трапеции и пять квадратов. Ответ Б.'],
      ],
      scene(step,frame) {
        let body = label(122,37,'Два вида деталей',18)+shipPieces(121,146,22)+label(451,37,'Корабль',18)+ship(275,60,24,step,frame);
        if (step >= 1) body += fadeIn(label(451,235,'Корпус: 3 трапеции',19,teal),frame);
        if (step===2) body += fadeIn(label(450,267,'Большая надстройка: 6 прямых углов',16,orange),frame);
        if (step>=3) body += fadeIn(label(450,267,'3 трапеции + 5 квадратов = 8',19,orange),frame);
        return svg(body,'Детали в форме квадрата и трапеции, а также корабль, выложенный по клетчатой сетке');
      },
    },
    5: {
      question: "У стандартного игрального кубика имеется шесть граней, пронумерованных от 1 до 6. Сумма чисел на любых противоположных гранях равна 7. Витя посчитал, что сумма чисел на трёх гранях около одной из вершин равна 14. Каковы числа на других трёх гранях?",
      title: 'Три скрытые грани',
      short: 'Вычти сумму открытых граней из суммы всех чисел кубика.',
      skill: 'Сумма и дополнение',
      choices: ['1, 2, 4','3, 5, 6','2, 5, 6','1, 2, 6','2, 3, 4'],
      steps: [
        ['Условие','Посмотри на три грани у вершины','Три видимые грани сходятся в одной вершине. Витя узнал их сумму, но числа по отдельности неизвестны.'],
        ['Все грани','Сложи числа от 1 до 6','По правилу противоположных граней числа разбиваются на пары 1 и 6, 2 и 5, 3 и 4. Каждая пара в сумме даёт 7. Всего получается 21.'],
        ['Разность','Вычти известную сумму','На выбранных трёх гранях сумма равна 14. Тогда три остальные грани дают вместе 21 − 14 = 7.'],
        ['Ответ','Найди тройку разных чисел с суммой 7','Из предложенных вариантов только 1 + 2 + 4 = 7. Эти числа стоят на трёх остальных гранях. Ответ А.'],
      ],
      scene(step,frame) {
        const y=125;
        let body = die(step===0 ? 320 : 169,y,1.12,step===3 ? ['6','5','3'] : ['?','?','?']) +
          label(step===0 ? 320 : 169,234,'Сумма 14',18,teal);
        if (step===1) {
          const pair=['1 + 6','2 + 5','3 + 4'];
          pair.forEach((text,i) => {
            body += fadeIn(rect(318,38+i*56,200,39,pale,teal,8)+label(418,64+i*56,`${text} = 7`,19),frame,i*.6);
          });
          body += fadeIn(label(417,238,'7 + 7 + 7 = 21',19,teal),frame,1.2);
        }
        if (step>=2) {
          const show = V.reveal(frame);
          const colors = step===3 ? [gold,'#f6e4ad','#f8ebc8'] : [pale,white,blue];
          body += fadeIn(die(491,y,1.12,step===3 ? ['1','2','4'] : ['?','?','?'],colors),frame) +
            fadeIn(label(491,234,'Сумма 7',18,orange),frame)+arrow(251,128,251+151*Math.max(.08,show),128);
          body += fadeIn(label(320,278,step===3?'1 + 2 + 4 = 7':'21 − 14 = 7',22,orange),frame);
        }
        return svg(body,'Кубик с тремя гранями у одной вершины и три противоположные грани у другой вершины');
      },
    },
  });

  const lanternOptions = ['OQOO','OHDO','ODSO','ODOH','OTJO'];
  function baseShape(kind, fill, stroke = ink) {
    if (kind==='O') return circle(0,0,20,fill,stroke);
    if (kind==='H') return polygon(points(6,20,20,0),fill,stroke);
    if (kind==='J') return polygon(points(6,20,20,11),fill,stroke);
    if (kind==='D') return polygon(points(4,23,23,0),fill,stroke);
    if (kind==='T') return polygon(points(3,23,23,7),fill,stroke);
    const square=rect(-16,-16,32,32,fill,stroke);
    return kind==='Q' ? group(square,'transform="rotate(16)"') : square;
  }
  function hangingLantern(kind) {
    if (kind==='O') return path('M-25 -26 V16 C-24 30 24 30 25 16 V-26Z',blue,ink)+
      '<ellipse cx="0" cy="-26" rx="25" ry="8" fill="#a8c5bf" stroke="#172e34" stroke-width="1.8"/>';
    if (kind==='H') return polygon('-24,-33 -10,-41 12,-41 24,-33 24,19 12,27 -10,27 -24,19',pale,ink)+
      polygon('-24,-33 -10,-25 12,-25 24,-33 12,-41 -10,-41','#a8c5bf',ink)+
      line(-10,-25,-10,27,ink,1.4)+line(12,-25,12,27,ink,1.4);
    if (kind==='D') return polygon('-23,-18 0,-27 23,-18 23,19 0,28 -23,19',blue,ink)+
      polygon('-23,-18 0,-27 23,-18 0,-10','#a8c5bf',ink)+line(0,-10,0,28,ink,1.4);
    return path('M0 -45 L24 17 C28 30 -28 30 -24 17Z',pale,ink);
  }

  const flowerColors = ['#d9e4dc','#b8dbd5','#eac8a7','#efd17f'];
  function blossom(x,y,scale,covered = [],options = {}) {
    const {guides = false, missing = false, frame = 12} = options;
    let body = '';
    const positions = Array.from({length: 6}, (_,i) => {
      const angle = i*Math.PI/3;
      return [46*Math.cos(angle),46*Math.sin(angle)];
    });
    positions.forEach(([a,b],i) => {
      const index=covered.findLastIndex((pair)=>pair.includes(i));
      body += line(a*.11,b*.11,a*.40,b*.40,ink,7);
      if (index>=0) {
        const tint=covered.length===1 ? flowerColors[0] : flowerColors[index];
        body += line(a*.35,b*.35,a*.7,b*.7,ink,4.5) +
          fadeIn(circle(a,b,20,tint,ink,2),frame,index*.7);
      } else if (guides) {
        body += `<circle cx="${a}" cy="${b}" r="20" fill="${missing ? '#fbefd1' : 'none'}" stroke="${missing ? orange : muted}" stroke-width="2.1" stroke-dasharray="5 4"/>`;
      }
    });
    return placed(body + polygon(points(12,16,8,0),ink,'none'),x,y,scale);
  }

  // Each line is [x1, y1, x2, y2, isFold] in template coordinates.
  const templates = [
    [[1,1,3,1],[3,1,4,1,1],[1,1,1,2,1],[1,2,1,4],[1,2,3,2],[3,1,3,4],[4,1,4,4],[1,4,3,4,1],[3,4,4,4]],
    [[1,1,2,1],[2,1,3,1,1],[3,1,4,1],[1,1,1,4],[2,1,2,4],[3,1,3,4],[4,1,4,4],[1,4,2,4,1],[2,4,3,4],[3,4,4,4,1]],
    [[1,1,3,1],[3,1,4,1,1],[1,1,1,2,1],[1,2,1,4],[2,2,2,4],[3,1,3,3],[4,1,4,3],[4,3,4,4,1],[1,2,3,2],[2,3,4,3],[1,4,2,4,1],[2,4,4,4]],
    [[2,1,4,1],[2,1,2,2],[4,1,4,2,1],[1,2,4,2],[1,2,1,3,1],[1,3,1,4],[3,2,3,3],[1,3,4,3],[2,3,2,4],[4,3,4,4,1],[2,4,4,4]],
    [[1,1,3,1],[3,1,4,1,1],[1,1,1,2,1],[3,1,3,2],[4,1,4,2],[1,2,4,2],[1,2,1,4],[2,2,2,4],[4,2,4,4,1],[1,4,2,4,1],[2,4,4,4]],
  ];
  function template(index,x,y,unit,step,frame) {
    let body=rect(0,0,5,5,white,ink,0,.052);
    for(let i=1;i<5;i++) body += line(i,0,i,5,muted,.035)+line(0,i,5,i,muted,.035);
    if(step>=2 && index===4) body += fadeIn(rect(2,2,2,2,'#f8e4af','none'),frame);
    if(step>=2 && index===2) body += fadeIn(rect(2,3,2,1,'#f8e4af','none'),frame);
    body += templates[index].map(([a,b,c,d,fold]) => {
      const color=step===0 ? ink : fold ? teal : orange;
      return fadeIn(line(a,b,c,d,color,fold?.10:.12,fold?'stroke-dasharray=".15 .12"':''),step>0?frame:12);
    }).join('');
    body += group(path('M1 4 L.62 4.64 M1 4 L1.20 4.63','none',ink,.055)+
      circle(.59,4.7,.10,'none',ink,.055)+circle(1.25,4.67,.10,'none',ink,.055));
    return placed(body,x,y,unit);
  }
  const panels = [
    {start:[1,1], span:[0,1], normal:[1,0], width:1, height:2},
    {start:[3,1], span:[1,0], normal:[0,1], width:1, height:1},
    {start:[4,2], span:[0,1], normal:[-1,0], width:2, height:2},
    {start:[1,4], span:[1,0], normal:[0,-1], width:1, height:2},
  ];
  function foldedPaper(x,y,scale,amount,focus) {
    const project = (a,b,h=0)=>[26*(a+b),12*(b-a)-29*h];
    const shape = (coords, fill, stroke = ink) => polygon(coords.map((v)=>project(...v).join(',')).join(' '),fill,stroke,1.65);
    let body='';
    for(let row=0;row<5;row++) for(let col=0;col<5;col++) {
      if (row===1 && col>=1 && col<=3 || (row===2 || row===3) && col>=1 && col<=3) continue;
      body+=shape([[col,row],[col+1,row],[col+1,row+1],[col,row+1]],pale,ink);
    }
    const theta=amount*Math.PI/2;
    for (const [idx,panel] of panels.entries()) {
      const {start,span,normal,width,height}=panel;
      const color=focus && idx===2 ? '#f5d68c' : idx%2 ? '#dce8da' : '#c4ddd6';
      const vertex = (u,v) => [
        start[0]+u*span[0]+v*normal[0]*Math.cos(theta),
        start[1]+u*span[1]+v*normal[1]*Math.cos(theta),
        v*Math.sin(theta),
      ];
      for (let v=0;v<height;v++) for(let u=0;u<width;u++) {
        body+=shape([vertex(u,v),vertex(u+1,v),vertex(u+1,v+1),vertex(u,v+1)],color);
      }
    }
    return placed(body,x,y,scale);
  }

  function slice(index,x,y,distance,fill,stroke=ink) {
    const start=(index*45-90)*Math.PI/180, end=start+Math.PI/4, middle=(start+end)/2;
    const local=(r,theta)=>[r*Math.cos(theta),r*Math.sin(theta)].join(' ');
    const piece=path(`M0 0 L${local(78,start)} A78 78 0 0 1 ${local(78,end)}Z`,fill,stroke,2.3);
    const crust=path(`M${local(70,start)} A70 70 0 0 1 ${local(70,end)}`,'none','#c18a5a',4.3);
    const topping = [34,57].map((r,i)=>circle(r*Math.cos(middle+(i===0?.12:-.12)),r*Math.sin(middle+(i===0?.12:-.12)),4.5,stroke==='none'?ink:'#a84c34','none')).join('');
    return placed(piece+crust+topping,x+distance*Math.cos(middle),y+distance*Math.sin(middle));
  }

  function transparentDrawing(x,y,scale,mode='source',flip=1) {
    const horizontal = mode==='А' || mode==='В';
    const variantB = mode==='Б';
    const defaultDots = [[79,26],[59,37],[79,49]];
    const dots = variantB ? [[70,53],[91,40],[70,30]] : defaultDots;
    const rotation = mode==='Д' ? 'translate(110 0) scale(-1 1)' : mode==='В' ? 'translate(110 0) scale(-1 1)' : '';
    const paperFlip = `translate(0 35) scale(1 ${flip}) translate(0 -35)`;
    let body = rect(0,0,110,70,white,ink,0,1.4)+polygon('0,0 85,0 34,34',ink,ink,1.2);
    body += line(0,0,70,70,ink,1.4)+line(85,0,110,44,ink,1.4);
    if(horizontal) {
      for(let v=13;v<=60;v+=12) body+=line(0,v,v,v,ink,1.1);
    } else {
      for(let v=13;v<=60;v+=13) body+=line(v,v,v,70,ink,1.1);
    }
    body += dots.map(([a,b])=>circle(a,b,5.7,white,ink,1.3)).join('');
    return placed(group(group(body,`transform="${rotation}"`),`transform="${paperFlip}"`),x,y,scale);
  }

  Object.assign(lessons, {
    6: {
      question: "На фестивале Боря увидел фонарики разных форм, висящие, как показано на рисунке справа. Боря встал прямо под фонариками. Какими он видит их снизу?",
      title: 'Фонарики снизу',
      short: 'У каждого фонарика ищем форму основания.',
      skill: 'Вид снизу',
      choices: pictures('Вид'),
      steps: [
        ['Условие','Рассмотри фонарики сбоку','Четыре фонарика висят в ряд. Боря меняет положение, но порядок фонариков остаётся прежним.'],
        ['Круги','Определи крайние основания','У левого цилиндра и правого конуса основание круглое. Значит, вид снизу начинается и заканчивается кругом.'],
        ['Середина','Посмотри под средние фонарики','Основание второго фонарика — шестиугольник. У третьего оно квадратное, а на рисунке квадрат повёрнут углом набок.'],
        ['Ответ','Прочитай формы слева направо','Круг, шестиугольник, повёрнутый квадрат, круг. Так они идут только в варианте Б. Ответ Б.'],
      ],
      scene(step,frame) {
        let body=line(141,29,499,29,ink,6);
        const solids=['O','H','D','C'];
        solids.forEach((kind,i)=>{
          const x=178+i*95;
          body+=line(x,30,x,kind==='C'?45:kind==='H'?50:kind==='D'?62:64,muted,1.5)+placed(hangingLantern(kind),x,90);
          const visible=step>=2 || step>=1&&(i===0||i===3);
          if (visible) {
            const lift=17*(1-V.reveal(frame,i*.4));
            body+=fadeIn(arrow(x,121,x,141)+placed(baseShape('OHDO'[i],i===0||i===3?gold:blue),x,161-lift,.72),frame,i*.4);
          }
        });
        lanternOptions.forEach((row,i)=>{
          const x=i<3?39+i*210:144+(i-3)*210, y=i<3?213:263;
          const win=step===3&&i===1, dim=step===3&&!win;
          const option=rect(x,y-20,164,41,win?pale:white,win?teal:muted,8)+label(x+15,y+5,letters[i],15)+
            [...row].map((kind,k)=>placed(baseShape(kind,win?gold:'#d4dfd9'),x+43+k*32,y,.58)).join('');
          body+=opacity(option,dim?.36:1);
          if(win) body+=fadeIn(mark(x+154,y-15,'✓',teal),frame);
        });
        return svg(body,'Четыре подвешенных фонарика. Ниже пять вариантов вида снизу');
      },
    },
    7: {
      question: "Из нескольких деталей вот такой формы Аня хочет составить цветок, как на рисунке справа. Детали могут перекрывать друг друга. Какое наименьшее количество деталей ей потребуется?",
      title: 'Цветок из деталей',
      short: 'Два лепестка одной детали разделены одним пустым местом.',
      skill: 'Покрытие и минимум',
      choices: ['2','3','4','5','6'],
      steps: [
        ['Условие','Сравни деталь и целый цветок','У одной детали два лепестка. Она кладётся на цветок так, что между её лепестками есть ещё одна позиция.'],
        ['Две детали','Закрой место между первыми лепестками','Положим вторую деталь так, чтобы один её лепесток попал ровно в этот промежуток. После двух деталей можно покрыть четыре позиции.'],
        ['Нижняя граница','Раздели позиции через одну','Каждая деталь покрывает только две позиции одного цвета, если раскрасить лепестки по очереди. На три места каждого цвета нужно по две детали.'],
        ['Ответ','Покрой все шесть четырьмя деталями','Добавь по детали для каждого из двух оставшихся мест. Их вторые лепестки могут перекрывать уже закрытые места. Достаточно четырёх деталей. Ответ В.'],
      ],
      scene(step,frame) {
        let body='';
        if(step===0) {
          body=blossom(175,129,1.25,[[4,0]])+blossom(467,129,1.25,[[0,1,2,3,4,5]])+
            label(175,247,'Одна деталь',18)+label(467,247,'Готовый цветок',18);
        } else if(step===1) {
          body=blossom(171,132,1.25,[[4,0]],{guides:true})+
            arrow(262,132,371,132)+blossom(466,132,1.25,[[4,0],[3,5]],{guides:true,missing:true,frame})+
            fadeIn(label(466,249,'Два места ещё открыты',18,orange),frame);
        } else if(step===2) {
          body=blossom(320,135,1.3,[[0,2,4],[1,3,5]],{frame})+
            fadeIn(label(130,124,'3 места',19,teal)+label(130,151,'2 детали',18,teal),frame)+
            fadeIn(label(511,124,'3 места',19,teal)+label(511,151,'2 детали',18,teal),frame,1)+
            fadeIn(label(320,263,'В каждой группе позиции чередуются',19,orange),frame);
        } else {
          body=blossom(170,131,1.2,[[4,0],[3,5]],{guides:true,missing:true,frame:12})+
            arrow(261,131,370,131)+blossom(467,131,1.22,[[4,0],[3,5],[1,3],[0,2]],{frame})+
            fadeIn(label(468,252,'2 + 2 = 4 детали',21,orange),frame);
        }
        return svg(body,'Деталь с двумя лепестками и цветок из шести лепестков. Разные цвета показывают размещение деталей');
      },
    },
    8: {
      question: "На шаблоне пунктирные линии обозначают место сгиба, а сплошные — место разреза. Какой из шаблонов был использован для создания фигуры на рисунке справа?",
      title: 'Бумажная фигура',
      short: 'Проверь линии разреза, сгибы и размеры поднятых стенок.',
      skill: 'Переход от чертежа к объёму',
      choices: pictures('Шаблон'),
      steps: [
        ['Условие','Сравни пять шаблонов с фигурой','Разрез отделяет край стенки, а на пунктире стенка остаётся соединённой с основанием.'],
        ['Сгибы','Найди четыре опоры у стенок','У фигуры четыре поднятые части, по одному сгибу на каждую. Подходящие по числу сгибов шаблоны В и Д.'],
        ['Размер','Проверь самую широкую стенку','Дальняя стенка имеет ширину две клетки и высоту две клетки. У шаблона В соответствующий боковой сгиб длиной в одну клетку. У шаблона Д по нему поднимается квадрат 2 × 2.'],
        ['Ответ','Подними стенки по пунктиру','Поднимем четыре части шаблона Д. Получаются две узкие высокие стенки, одна маленькая и дальняя стенка 2 × 2. Ответ Д.'],
      ],
      scene(step,frame) {
        let body=foldedPaper(215,93,.80,1,step===2)+label(320,21,'Сложенная фигура',17);
        if(step===1) body+=fadeIn(label(493,91,'4 линии сгиба',17,teal),frame);
        if(step===2) body+=fadeIn(label(497,89,'Дальняя стенка 2 × 2',16,orange)+arrow(429,99,385,79,orange),frame);
        if(step===3) {
          body=foldedPaper(75,99,.66,1,false)+foldedPaper(408,99,.66,V.reveal(frame),true)+
            label(160,21,'Цель',17)+label(496,21,'Сгибаем Д',17,teal)+arrow(287,96,351,96);
        }
        templates.forEach((_,i)=>{
          const x=28+i*118,y=172;
          const selected=step>=1&&(i===2||i===4), dim=step===1&&!selected||step>=2&&i!==2&&i!==4||step===3&&i!==4;
          body+=opacity(template(i,x,y,19,step,frame)+label(x+48,288,letters[i],16),dim?.38:1);
          if(step===1 && selected || step===3&&i===4) body+=fadeIn(rect(x-3,y-3,101,101,'none',teal,2,2.4),frame);
        });
        return svg(body,'Изометрическая фигура с четырьмя стенками и пять клетчатых шаблонов с линиями разреза и сгиба');
      },
    },
    9: {
      question: "Пиццу разрезали на 8 равных кусков. Максим съел четвёртую часть пиццы, а Галя — половину оставшейся части пиццы. Сколько кусков осталось?",
      title: 'Куски пиццы',
      short: 'Сначала найди четверть целой пиццы, затем половину остатка.',
      skill: 'Доли от разных количеств',
      choices: ['1','2','3','4','5'],
      steps: [
        ['Условие','Начни с восьми равных кусков','Максим ест первым. Галя делит пополам только то, что останется после Максима.'],
        ['Максим','Найди четверть от восьми','В каждой из четырёх равных частей по 8 ÷ 4 = 2 куска. Максим съел два. Теперь кусков шесть.'],
        ['Галя','Найди половину от шести','Половина оставшейся пиццы — это 6 ÷ 2 = 3 куска. Их съела Галя.'],
        ['Ответ','Посчитай остаток','Из шести кусков после Максима осталось 6 − 3 = 3. Ответ В.'],
      ],
      scene(step,frame) {
        const x=step===0?320:204,y=140;
        let body=circle(x,y,105,pale,'#c5d8cc',2);
        for(let n=0;n<8;n++) {
          const max=step>=1&&n<2, galya=step>=2&&n>=2&&n<5, removed=max||galya;
          const progress=step===3?1:V.reveal(frame,n*.32);
          const color=max?'#e3ad70':galya?'#c5dcd3':step>=3?gold:'#efce8a';
          body+=opacity(slice(n,x,y,removed?37*progress:4,color),removed ? 1-.80*progress : 1);
        }
        if(step>=1) {
          body+=fadeIn(rect(392,62,181,44,'#f6e0b5',orange,8)+label(482,91,'Максим: 8 ÷ 4 = 2',17),frame);
          if(step===1) body+=fadeIn(label(482,168,'8 − 2 = 6 кусков',20,teal),frame,1);
        }
        if(step>=2) body+=fadeIn(rect(392,119,181,44,blue,teal,8)+label(482,148,'Галя: 6 ÷ 2 = 3',17),frame,.65);
        if(step>=3) body+=fadeIn(rect(389,179,188,49,gold,orange,8)+label(483,211,'6 − 3 = 3 куска',20),frame,1.3);
        if(step===0) body+=label(320,270,'8 равных кусков',20);
        return svg(body,'Пицца из восьми равных кусков. Сначала убираются два куска Максима, затем три куска Гали');
      },
    },
    10: {
      question: "Даша нарисовала на прозрачном листе картинку, показанную справа. Какое изображение можно увидеть на обратной стороне этого листа?",
      title: 'Прозрачный лист',
      short: 'При перевороте листа рисунок отражается зеркально.',
      skill: 'Отражение и поворот',
      choices: pictures('Рисунок'),
      steps: [
        ['Условие','Рассмотри рисунок с лицевой стороны','Запомни направление полос и то, какие кружки расположены ближе к чёрной области.'],
        ['Ось','Переверни лист вокруг длинной стороны','При перевороте верх и низ меняются местами. Полосы остаются параллельны короткой стороне листа, поэтому А и В отпадают.'],
        ['Кружки','Сохрани соседство фигур','Два кружка расположены рядом с чёрной областью, один дальше. В варианте Б этот порядок меняется.'],
        ['Ответ','Сравни отражение с поворотом','Рисунок Д получается, если повернуть лист в его плоскости. На обратной стороне чёрный угол и полосы расположены как в варианте Г. Ответ Г.'],
      ],
      scene(step,frame) {
        let body=transparentDrawing(step===0?252:112,44,1.23);
        if(step===0) body+=label(320,28,'Лицевая сторона',17);
        if(step>0) {
          const flip=step===1?Math.cos(Math.PI*V.reveal(frame)):-1;
          body+=label(180,28,'Лицевая сторона',17)+label(464,28,'Обратная сторона',17)+
            arrow(276,86,365,86)+transparentDrawing(397,44,1.23,'source',flip)+
            fadeIn(line(390,87,538,87,teal,1.4,'stroke-dasharray="4 5"'),frame);
          if(step===2) {
            body+=fadeIn(circle(471,84,9,'none',orange,2.4)+circle(494,98,9,'none',orange,2.4),frame);
          }
        }
        letters.forEach((letter,i)=>{
          const x=18+i*123,y=181;
          const dim1=step>=1&&(i===0||i===2),dim2=step>=2&&i===1,win=step===3&&i===3;
          const art=transparentDrawing(x,y,.92,letter,i===2?1:-1)+label(x+51,270,letter,17);
          body+=opacity(art,dim1||dim2||step===3&&i===4?.34:1);
          if(win)body+=fadeIn(rect(x-4,y-4,109,73,'none',teal,3,3)+mark(x+101,y+1,'✓',teal),frame);
        });
        return svg(body,'Геометрический рисунок на прозрачном листе, его отражение и пять вариантов ответа');
      },
    },
  });
})();
