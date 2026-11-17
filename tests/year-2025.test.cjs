'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const dist = path.join(__dirname, '..', 'dist');
const letters = 'АБВГД';
const context = vm.createContext({
  svg: (body, label, viewBox) => `<svg role="img" aria-label="${label}" viewBox="${viewBox}">${body}</svg>`,
});
vm.runInContext(fs.readFileSync(path.join(dist, 'years', '2025.js'), 'utf8'), context);
const year = context.KENGURU_ARCHIVE[2025];
const answers = year.lessons.map(lesson => lesson.choices[lesson.answer]);

function checkPng(file) {
  const data = fs.readFileSync(path.join(dist, file));
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file);
  assert.ok(data.readUInt32BE(16) > 20 && data.readUInt32BE(20) > 20, file);
}

function pairs(values) {
  return values.flatMap((a, i) => values.slice(i + 1).map(b => [a, b]));
}

test('2025 class 3–4 uses the official order, key, point groups and source files', () => {
  assert.equal(year.id, '2025-3-4');
  assert.equal(year.grades.join(','), '3,4');
  assert.equal(year.lessons.length, 24);
  assert.equal(year.scenes.length, 24);
  assert.equal(year.lessons.map(lesson => letters[lesson.answer]).join(''), 'АДДДАБАДДВБББГВДГДБГБВАВ');
  for (const file of ['tasks.pdf', 'answers.pdf', 'solutions.pdf']) {
    assert.equal(fs.readFileSync(path.join(dist, '..', 'sources', '2025', file)).subarray(0, 4).toString(), '%PDF');
  }
  for (const [index, lesson] of year.lessons.entries()) {
    assert.equal(lesson.number, index + 1);
    assert.equal(lesson.points, 3 + Math.floor(index / 8));
    assert.equal(lesson.choices.length, 5);
    assert.ok(lesson.title && lesson.short && lesson.skill && lesson.question);
    assert.equal(lesson.steps[0][0], 'Самостоятельно');
    assert.ok(lesson.steps.length >= 4);
    assert.ok(lesson.steps.every(step => step.length === 3 && step.every(Boolean)));
    checkPng(lesson.originalImage);
    if (lesson.choiceImages) {
      assert.equal(lesson.choiceImages.length, 5);
      lesson.choiceImages.forEach(checkPng);
    }
  }
});

test('all scenes render at fractional frames and reference available artwork', () => {
  const images = new Set();
  for (const [index, lesson] of year.lessons.entries()) {
    const scene = year.scenes[index];
    for (let step = 0; step < lesson.steps.length; step++) {
      const initial = scene(step, 0);
      for (const frame of [0, 0.01, 0.45, 1.23, 2.61, 6.07, 12]) {
        const markup = scene(step, frame);
        assert.ok(markup.length > 25, `task ${lesson.number}, step ${step}`);
        assert.doesNotMatch(markup, /NaN|undefined|Infinity/);
        for (const [, image] of markup.matchAll(/(?:src|href)="(assets\/years\/2025\/[\w-]+\.png)"/g)) images.add(image);
        if (step === 0) {
          assert.equal(markup, initial, `task ${lesson.number} must begin without autoplay or a first move`);
          assert.doesNotMatch(markup, /✓|Правильный|вариант [АБВГД]|-solution|choice-\d+-\d/iu);
        }
      }
    }
    assert.ok(lesson.steps.slice(1).some((_, step) => scene(step + 1, 0) !== scene(step + 1, 1.23)),
      `task ${lesson.number} must include an animated solution scene`);
  }
  for (const image of images) checkPng(image);
});

test('arithmetic choices give the greatest expression, exact purchase and feed split', () => {
  const orders = year.lessons[1].choices.map(choice => choice.split(', ').map(Number));
  const values = orders.map(([a, b, c, d]) => a + b - c + d);
  assert.deepEqual(Array.from(values), [5, 5, 5, 5, 9]);
  assert.equal(year.lessons[1].answer, values.indexOf(Math.max(...values)));
  const prices = [[2, 1], [1, 9], [3, 0], [1, 5], [2, 4]].map(([shells, balls]) => 6 * shells + balls);
  assert.equal(year.lessons[8].answer, prices.indexOf(16));
  assert.equal(+answers[9], (3 + 4 + 5 + 15) / 3 - 3);
  assert.equal(parseInt(answers[11], 10), 210 / (5 + 2) * 2);
});

test('sector colors, visible die faces and grid route pick the depicted choices', () => {
  const reference = 'swbwwb';
  const spinners = ['wbwbsw', 'wbswwb', 'sbwwbw', 'bwwbws', 'bwwbsw'];
  const rotations = [...reference].map((_, i) => reference.slice(i) + reference.slice(0, i));
  assert.deepEqual(spinners.flatMap((spinner, i) => rotations.includes(spinner) ? [i] : []), [year.lessons[3].answer]);
  const dice = [[5, 1, 4], [3, 5, 2], [6, 2, 1], [4, 3, 6], [2, 4, 5]];
  assert.deepEqual(dice.flatMap((faces, i) => pairs(faces).every(([a, b]) => a + b !== 7) ? [i] : []), [year.lessons[4].answer]);
  const zoo = [0, 4];
  const jumps = [[3, 0], [2, -2], [0, -2]];
  const endpoint = jumps.reduce(([x, y], [dx, dy]) => [x + dx, y + dy], zoo);
  const houses = [[5, 0], [7, 0], [9, 0], [10, 1], [10, 3]];
  assert.deepEqual(endpoint, houses[year.lessons[6].answer]);
  assert.match(year.scenes[6](2, 0.75), /<line[^>]+x2="\d+\.\d+"/);
});

test('only patches 1 and 5 match both hole geometry and checkerboard parity', () => {
  const holes = [
    [[3, 1], [2, 2], [3, 2], [4, 2], [2, 3]],
    [[6, 4], [7, 4], [6, 5], [5, 6], [6, 6]],
  ];
  const pieces = [
    [[1, 0, 0], [0, 1, 0], [1, 1, 1], [1, 2, 0], [2, 2, 1]],
    [[0, 0, 0], [1, 0, 1], [1, 1, 0], [1, 2, 1], [2, 2, 0]],
    [[1, 0, 1], [0, 1, 1], [1, 1, 0], [2, 1, 1], [0, 2, 0]],
    [[0, 0, 1], [0, 1, 0], [1, 1, 1], [2, 1, 0], [1, 2, 0]],
    [[0, 0, 1], [0, 1, 0], [1, 1, 1], [2, 1, 0], [2, 2, 1]],
  ];
  const fits = holes.map(hole => {
    const allowed = new Set(hole.map(([x, y]) => [x, y, (x + y) % 2].join(',')));
    return pieces.flatMap((piece, i) => {
      let turned = piece;
      for (let turns = 0; turns < 4; turns++) {
        for (const [x, y] of hole) {
          const [ax, ay] = turned[0];
          if (turned.every(([bx, by, color]) => allowed.has([x + bx - ax, y + by - ay, color].join(',')))) return [i + 1];
        }
        turned = turned.map(([x, y, color]) => [-y, x, color]);
      }
      return [];
    });
  });
  assert.deepEqual(fits, [[1], [5]]);
  assert.equal(answers[12], '1 и 5');
});

test('pizza diameters and the unique chain of sums give the official choices', () => {
  const sectors = [0, 3, 2, 4, 1, 2, 1, 5];
  const halfCounts = [7, 0, 1, 2].map(start =>
    Array.from({length: 4}, (_, i) => sectors[(start + i) % 8]).reduce((a, b) => a + b));
  assert.deepEqual(halfCounts, [10, 9, 10, 9]);
  assert.equal(answers[13], halfCounts.flatMap((n, i) => n === 9 ? [i + 1] : []).join(' и '));
  const solutions = [];
  for (let a = 1; a <= 7; a++) for (let b = 1; b <= 7; b++) for (let c = 1; c <= 7; c++) {
    const row = [6, a, b, c, 6 + a, a + b, b + c];
    if (row.every(n => n <= 7) && new Set(row).size === 7) solutions.push(row);
  }
  assert.deepEqual(solutions, [[6, 1, 3, 2, 7, 4, 5]]);
  assert.equal(+answers[14], solutions[0][5]);
});

test('only the 3 by 4 piece tiles a square with the three known rectangles', () => {
  function tile(pieces, side, occupied = new Set()) {
    if (pieces.length === 0) return occupied.size === side * side;
    let first = 0;
    while (occupied.has(first)) first++;
    const x = first % side;
    const y = Math.floor(first / side);
    return pieces.some(([w, h], i) => [[w, h], [h, w]].some(([width, height]) => {
      if (x + width > side || y + height > side) return false;
      const added = Array.from({length: height}, (_, row) =>
        Array.from({length: width}, (_, col) => first + row * side + col)).flat();
      return added.every(cell => !occupied.has(cell))
        && tile(pieces.filter((_, j) => j !== i), side, new Set([...occupied, ...added]));
    }));
  }
  const choices = [[5, 3], [5, 1], [3, 2], [6, 2], [3, 4]];
  const possible = choices.flatMap(([w, h], i) => {
    const side = Math.sqrt(24 + w * h);
    return Number.isInteger(side) && tile([[6, 1], [5, 2], [2, 4], [w, h]], side) ? [i] : [];
  });
  assert.deepEqual(possible, [year.lessons[15].answer]);
});

test('photo frequencies, button inequalities and layer colors agree with the key', () => {
  const photos = [[1, 2, 5], [1, 3, 6], [3, 4, 5]];
  const missing = [1, 2, 3, 4, 5, 6].filter(n => photos.flat().filter(seen => seen === n).length === 1);
  assert.deepEqual(missing, [2, 4, 6]);
  assert.equal(+answers[16], missing.reduce((a, b) => a + b));
  const buttonCounts = [1, 2, 3, 4].map(gray => [gray, 50 - 12 * gray, 11 * gray])
    .filter(([gray, pink, white]) => gray < pink && pink < white);
  assert.deepEqual(buttonCounts, [[3, 14, 33]]);
  assert.equal(+answers[17], buttonCounts[0][2] - buttonCounts[0][1]);
  const colors = Array.from({length: 4}, (_, row) =>
    Array.from({length: 4}, (_, col) => (row + col + 3 - Math.max(row, col)) % 2 ? 'с' : 'з').join(''));
  assert.deepEqual(colors, ['сссс', 'сззз', 'сзсс', 'сзсз']);
  assert.equal(year.lessons[19].answer, 3);
});

test('brick dimensions and positive water volumes determine unique choices', () => {
  const dimensions = year.lessons[20].choices.map(choice => choice.match(/\d+/g).map(Number));
  const matches = dimensions.flatMap(([short, long], i) => short * 6 === 60 && long === short * 4 ? [i] : []);
  assert.deepEqual(Array.from(matches), [year.lessons[20].answer]);
  for (const ballVolume of [0.2, 0.48, 0.9, 1.6, 1.99]) {
    const lower = 6;
    const volumes = [1, 2, 3, 4, 6].map((balls, i) => lower * (i < 3 ? 1 : 2) - balls * ballVolume);
    assert.ok(volumes.every(volume => volume > 0));
    assert.equal(year.lessons[21].answer, volumes.indexOf(Math.min(...volumes)));
  }
});

test('enumeration confirms the missing fruit count and the two scale readings', () => {
  const fruit = [];
  for (let mango = 12; mango <= 46; mango += 10) {
    for (let pear = 11; pear <= 46; pear += 10) {
      const banana = 46 - mango - pear;
      const quantities = [mango, 30, pear, banana, 30];
      if (banana <= 10 || banana % 10 !== 3) continue;
      if (pairs(quantities).some(([a, b]) => a === 2 * b || b === 2 * a)) fruit.push([mango, pear, banana]);
    }
  }
  assert.deepEqual(fruit, [[22, 11, 13]]);
  assert.equal(+answers[22], fruit[0][2]);
  const weights = [];
  for (let star = 1; star <= 5; star++) for (let square = 1; square <= 5; square++) for (let circle = 1; circle <= 5; circle++) {
    if (new Set([star, square, circle]).size === 3 && square > 2 * star && 2 * circle > 3 * square) weights.push([star, square, circle]);
  }
  assert.deepEqual(weights, [[1, 3, 5]]);
  assert.equal(parseInt(answers[23], 10), weights[0][1]);
});
