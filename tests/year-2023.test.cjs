'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'dist/years/2023.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(script, context);
const archive = context.KENGURU_ARCHIVE[2023];

function checkAnswer(number, answer) {
  const lesson = archive.lessons[number - 1];
  assert.equal(lesson.choices[lesson.answer], answer);
}

function permutations(values) {
  if (values.length === 0) return [[]];
  return values.flatMap((value, i) => permutations(values.filter((_, j) => j !== i)).map((tail) => [value, ...tail]));
}

test('2023: official keys, point groups and source PDFs', () => {
  assert.equal(archive.year, 2023);
  assert.equal(archive.id, '2023-3-4');
  assert.deepEqual(Array.from(archive.grades), [3, 4]);
  assert.equal(archive.lessons.length, 24);
  assert.equal(archive.scenes.length, 24);
  assert.equal(archive.lessons.map((lesson) => 'АБВГД'[lesson.answer]).join(''), 'ГВБВВДВДААДГАГБАВБББГБГД');
  [3, 4, 5].forEach((points) => assert.equal(archive.lessons.filter((lesson) => lesson.points === points).length, 8));
  const names = {tasksUrl: 'class_3-4', answersUrl: 'answers', solutionUrl: 'solution'};
  for (const [name, suffix] of Object.entries(names)) {
    assert.equal(archive.sources[name], `https://ipokengu.ru/public/task/kenguru_2023_${suffix}.pdf`);
  }
  for (const file of ['tasks.pdf', 'answers.pdf', 'solutions.pdf']) {
    assert.equal(fs.readFileSync(path.join(root, 'sources/2023', file)).subarray(0, 4).toString(), '%PDF');
  }
});

test('2023: native conditions, separate original figures and animated scenes', () => {
  const textAndChoicesOnly = new Set([2, 11, 12, 16, 18, 19, 24]);
  function checkVector(file) {
    const asset = fs.readFileSync(path.join(root, 'dist', file), 'utf8');
    assert.match(asset, /<svg[^>]+viewBox=/u, file);
    assert.doesNotMatch(asset, /<image|<text/u, file);
  }
  context.svg = (body, label, box) => `<svg role="img" aria-label="${label}" viewBox="${box}">${body}</svg>`;
  archive.lessons.forEach((lesson, i) => {
    assert.equal(lesson.number, i + 1);
    assert.equal(lesson.choices.length, 5);
    assert.ok(lesson.steps.length >= 3);
    assert.equal(lesson.steps[0][0], 'Условие');
    assert.equal(lesson.steps.at(-1)[0], 'Решение');
    assert.ok(lesson.question.trim());
    const original = fs.readFileSync(path.join(root, 'dist', lesson.originalImage));
    assert.equal(original.subarray(1, 4).toString(), 'PNG', lesson.originalImage);
    assert.ok(original.readUInt32BE(16) > 50 && original.readUInt32BE(20) > 50, lesson.originalImage);
    if (lesson.choiceImages) {
      assert.equal(lesson.choiceImages.length, 5);
      lesson.choiceImages.forEach(checkVector);
    }
    const introduction = archive.scenes[i](0, 8.75);
    assert.equal(introduction, archive.scenes[i](0, 0));
    if (textAndChoicesOnly.has(lesson.number)) {
      assert.equal(introduction, '');
      assert.equal(lesson.conditionImage, undefined);
    } else {
      assert.match(introduction, /^<img .* alt="[^"]+"/u);
      assert.ok(introduction.includes(lesson.conditionImage));
      assert.ok(!introduction.includes(lesson.originalImage));
      assert.doesNotMatch(introduction, /Ответ|Решение|<svg/u);
      checkVector(lesson.conditionImage);
    }
    lesson.steps.forEach((step, index) => {
      assert.equal(step.length, 3);
      assert.ok(step.every((part) => typeof part === 'string' && part.length > 0));
      if (index === 0) return;
      for (const frame of [0, 0.01, 0.25, 0.9, 1.5, 2.25, 5, 7.5, 10.83, 40]) {
        const markup = archive.scenes[i](index, frame);
        assert.match(markup, /^<svg role="img" aria-label="[^"]+"/);
        assert.doesNotMatch(markup, /NaN|undefined|Infinity/);
        for (const image of markup.matchAll(/<image href="([^"]+)"/g)) {
          assert.ok(fs.existsSync(path.join(root, 'dist', image[1])));
        }
      }
    });
  });
  assert.doesNotMatch(script, /догад/iu);
  assert.match(archive.lessons[1].question, /20 \+ 10 \+ 10 \+ \? \+ \? \+ 1 = 51/u);
});

test('1–3: candle heights, repeated number, and rotated clock openings', () => {
  const heights = [71, 90, 84, 99, 63];
  checkAnswer(1, 'ABCDE'[heights.indexOf(Math.max(...heights))]);
  checkAnswer(2, String((51 - 20 - 10 - 10 - 1) / 2));
  const pairs = [[4,9],[5,9],[5,10],[6,9],[7,12]];
  assert.deepEqual(pairs.filter(([a,b]) => [4,8].includes(b-a)), [[5,9]]);
  checkAnswer(3, '5 и 9');
});

test('4–5: complementary cells and exact two-light time slots', () => {
  const occupied = [[0,0],[1,0],[2,0],[3,0],[1,1],[3,1],[3,2],[2,3],[3,3]];
  const fitted = [[0,1],[2,1],[0,2],[1,2],[2,2],[0,3],[1,3]];
  assert.equal(new Set([...occupied, ...fitted].map((cell) => cell.join(':'))).size, 16);
  checkAnswer(4, '1 и 4');
  const intervals = [[[1,5],[6,9]],[[2,6],[7,12]],[[0,3],[5,8],[10,12]]];
  const times = [];
  for (let minute = 1; minute <= 12; minute++) {
    const lit = intervals.filter((lamp) => lamp.some(([start, end]) => start < minute && minute <= end)).length;
    if (lit === 2) times.push(minute);
  }
  assert.deepEqual(times, [2,4,5,6,7,9,11,12]);
  checkAnswer(5, `${times.length} минут`);
});

test('6–7: mirrored segments spell 406 and four choices of omitted disc', () => {
  const reflection = {a:'d',b:'c',c:'b',d:'a',e:'f',f:'e',g:'g'};
  // Standard seven-segment labels: a,d top/bottom; b,c right; e,f left; g middle.
  const digits = {bcfg:'4', abcdef:'0', acdefg:'6'};
  const upperHalves = ['be', 'abc', 'abfg'];
  const sources = ['bg', 'aef', 'af'];
  const merged = upperHalves.map((top, i) => [...new Set([...top].map((segment) => reflection[segment]).concat([...sources[i]]))].sort().join(''));
  checkAnswer(6, merged.map((segments) => digits[segments]).join(''));
  const towers = permutations([1,2,3,4]).map((sequence) => sequence.slice(0, 3)).filter(([a,b,c]) => a < b && b < c);
  assert.equal(new Set(towers.map(String)).size, 4);
  checkAnswer(7, String(towers.length));
});

test('8–9: opposite gray quarters and the point inside a valid tiling', () => {
  const gray = [0, 1, 4, 5];
  for (let start = 0; start < 8; start++) {
    const semicircle = Array.from({length: 4}, (_, i) => (start + i) % 8);
    assert.equal(gray.every((sector) => semicircle.includes(sector)), false);
  }
  checkAnswer(8, 'рисунок Д');

  const target = [[0,3],[4,3],[4,0],[5,0],[5,4],[0,4]];
  const pieces = [
    [[2,3],[4,3],[3,4],[1,4]],
    [[4,0],[5,0],[5,2]],
    [[5,2],[5,4],[3,4]],
    [[4,0],[5,2],[4,3]],
    [[0,3],[2,3],[1,4],[0,4]],
  ];
  function contains(vertices, x, y) {
    let crossings = 0;
    vertices.forEach(([ax,ay], i) => {
      const [bx,by] = vertices[(i + 1) % vertices.length];
      if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) crossings++;
    });
    return crossings % 2 === 1;
  }
  // Offset samples from lattice diagonals so a sample belongs to at most one piece.
  for (let xi = 0; xi < 70; xi++) for (let yi = 0; yi < 56; yi++) {
    const x = (xi + 0.37) / 14;
    const y = (yi + 0.61) / 14;
    const coverage = pieces.filter((piece) => contains(piece, x, y)).length;
    assert.equal(coverage, contains(target, x, y) ? 1 : 0);
  }
  assert.deepEqual(pieces.map((piece) => contains(piece, 3.18, 3.23)), [true,false,false,false,false]);
  checkAnswer(9, 'элемент А');
});

test('10–11: unique balanced arrangement and complete six-length ruler', () => {
  const solutions = [];
  for (let a = 1; a <= 4; a++) for (let b = a + 1; b <= 4; b++) {
    const right = a + b - 1;
    if (right <= 4 && right !== a && right !== b) {
      solutions.push([a, b, right, 10 - a - b - right]);
    }
  }
  assert.deepEqual(solutions, [[2,3,4,1]]);
  checkAnswer(10, `${solutions[0][3]} кг`);

  const marks = [[10,30],[20,40],[30,50],[10,20],[10,40]];
  const complete = marks.flatMap((ruler, i) => {
    const stops = [0, ...ruler, 60];
    const distances = new Set(stops.flatMap((a) => stops.filter((b) => b > a).map((b) => b - a)));
    return [10,20,30,40,50,60].every((length) => distances.has(length)) ? [i] : [];
  });
  assert.deepEqual(complete, [4]);
  checkAnswer(11, 'линейка Д');
});

test('12–14: people per car, house groups and the train itinerary', () => {
  assert.deepEqual(Array.from({length:9}, (_, i) => i).filter((two) => two * 2 + (8 - two) * 3 === 19), [5]);
  checkAnswer(12, 'в пяти');
  checkAnswer(13, String(7 + 5 - 8));
  let position = 1, direction = 1;
  const visited = [];
  for (let stop = 1; stop <= 106; stop++) {
    position += direction;
    visited.push('ABCDEF'[position]);
    if (position === 0 || position === 5) direction *= -1;
  }
  assert.deepEqual(visited.slice(0,10), visited.slice(90,100));
  checkAnswer(14, visited[95]);
});

test('15–16: different colors for every joined pair and unique gift matching', () => {
  const edges = [[0,2],[0,3],[1,3],[1,4],[2,5],[3,5],[3,6],[4,6],[5,6]];
  function colorable(count) {
    const values = Array(7).fill(0);
    for (let mask = 0; mask < count ** values.length; mask++) {
      for (let i = 0; i < values.length; i++) values[i] = Math.floor(mask / count ** i) % count;
      if (edges.every(([a,b]) => values[a] !== values[b])) return true;
    }
    return false;
  }
  assert.equal(colorable(2), false);
  assert.equal(colorable(3), true);
  checkAnswer(15, '3');

  const combinations = permutations([0,1,2,3,4]).filter(([ira,valya,nikita,kolya,misha]) =>
    [0,1,4].includes(ira) && [1,3].includes(valya) && nikita === 2 && [2,3].includes(kolya) && [3,4].includes(misha));
  assert.deepEqual(combinations, [[0,1,2,3,4]]);
  checkAnswer(16, 'подарок А');
});

test('17–19: unique animal arrangement, allowed entry orders and ball counts', () => {
  const animals = [];
  for (let a = 1; a <= 8; a++) for (let b = a + 1; b <= 8; b++) {
    const works = Array.from({ length: 6 }, (_, i) => i + 1).every((start) =>
      [a,b].filter((index) => index >= start && index < start + 3).length === 1);
    if (works) animals.push([a,b]);
  }
  assert.deepEqual(animals, [[3,6]]);
  checkAnswer(17, '3');
  const orders = permutations(['Гермиона','Гарри','Рон']).filter(([a,b,c]) => a !== 'Гермиона' && b !== 'Гарри' && c !== 'Рон');
  assert.deepEqual(orders, [['Гарри','Рон','Гермиона'],['Рон','Гермиона','Гарри']]);
  checkAnswer(18, String(orders.length));
  const katyaRed = 9 / 3;
  checkAnswer(19, String(10 - 2 * katyaRed));
});

test('20–22: reflected cut, clock triple and correct machine sequence', () => {
  const originalCut = [[0,0],[0,1],[1,0]];
  const reflected = new Set();
  for (const x of [-1,1]) for (const y of [-1,1]) {
    originalCut.forEach(([a,b]) => reflected.add([x * a,y * b].join(',')));
  }
  assert.deepEqual([...reflected].sort(), ['-1,0','0,-1','0,0','0,1','1,0']);
  checkAnswer(20, 'рисунок Б');

  const times = [6,2,4,3,7];
  const correct = times.filter((hour) => times.includes(hour - 1) && times.includes(hour + 1));
  assert.deepEqual(correct, [3]);
  checkAnswer(21, 'ABCDE'[times.indexOf(correct[0])]);

  const outputs = ['211', '121', '122', '112', '212'].map((order) => {
    let corner = 0, flower = null;
    for (const operation of order) {
      if (operation === '1') {
        corner++;
        if (flower !== null) flower++;
      } else {
        flower = 0;
      }
    }
    return [corner, flower];
  });
  assert.deepEqual(outputs.map(([corner,flower]) => corner === 2 && flower === 1), [false,true,false,false,false]);
  checkAnswer(22, '1 – 2 – 1');
});

test('23–24: unique heptagon solution and four shared cells with every other guess', () => {
  const edge = [8,9,6,9,8,9,7];
  const values = permutations([1,2,3,4,5,6,7]).filter((order) => edge.every((sum, i) => order[i] + order[(i + 1) % 7] === sum));
  assert.deepEqual(values, [[1,7,2,4,5,3,6]]);
  checkAnswer(23, String(values[0][3]));
  const grids = [[2,4,7,10,14],[2,4,7,12,14],[2,7,8,13,14],[1,2,4,7,14],[2,4,7,8,14]];
  const match = grids.flatMap((grid, i) =>
    grids.every((other, j) => i === j || other.filter((cell) => grid.includes(cell)).length === 4) ? [i] : []);
  assert.deepEqual(match, [4]);
  checkAnswer(24, 'рисунок Д');
});
